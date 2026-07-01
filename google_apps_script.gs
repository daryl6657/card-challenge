/****************************************************************************
 *  THE CARD CHALLENGE  —  Google Apps Script backend  (survey + game)
 *  --------------------------------------------------------------------------
 *  What it does:
 *    - Receives each finished session (POST) from the HTML app
 *    - Appends one row of data to a Google Sheet. Columns are handled
 *      DYNAMICALLY: any new field in the payload automatically becomes a new
 *      column, and every row is written aligned to the header. This means the
 *      survey fields (sv_*) and the game fields all land in the right columns
 *      without you editing this file.
 *    - Emails you a readable summary of each result
 *    - Answers a name-check (GET, JSONP) so the same person cannot play twice
 *
 *  Setup: see SETUP_GUIDE.md.  If you edit this file later you must redeploy:
 *  Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.
 *  --------------------------------------------------------------------------
 ****************************************************************************/

// ===== EDIT THIS LINE =====
var EMAIL = "daryl6657@gmail.com";   // where each result is emailed
var SHEET_NAME = "Responses";        // tab name inside the spreadsheet
// ==========================

// Fields stored as JSON text (not spread across columns).
var JSON_FIELDS = ["trials", "practiceTrials"];

// A sensible left-to-right ordering for the columns we know about. Any field
// not listed here is still saved — it just gets appended after these.
var PREFERRED_ORDER = [
  "timestamp","name","phone","telegram","participantId",
  "startBalance","finalBalance","netResult","entries","entriesBase","entriesBonus",
  "totalTurns","durationSec","scoredDurationSec","wins","losses","totalEarned","totalLost","jackpots",
  "riskTaking","jackpotPreference","pRiskyAfterLoss","pRiskyAfterWin","lossChasing",
  "deckCount_A","deckCount_B","deckCount_C","deckCount_D",
  "maxConsecutive_A","maxConsecutive_B","maxConsecutive_C","maxConsecutive_D",
  "maxWinStreak","maxLossStreak","switchedAfterLoss","stayedAfterLoss",
  "switchedAfter2plusLoss","stayedAfter2plusLoss","choiceSequence","outcomeSequence",
  // survey computed scores first, then raw items
  "sv_gamblingExposureScore","sv_gachaExposureScore","sv_totalExposureScore",
  "sv_pgsiTotal","sv_distortionMean","sv_probabilityCorrect",
  "sv_age","sv_gender","sv_education","sv_activities","sv_duration",
  "postExciting","postAttractive","postRiskiest","postStrategy",
  "trials","practiceTrials","userAgent"
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

// Return the current header as an array (row 1). Empty array if sheet is blank.
function getHeader_(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(function (h) { return h !== ""; });
}

// Make sure every key in `keys` exists as a column; returns the full header.
function ensureColumns_(sh, keys) {
  var header = getHeader_(sh);
  var have = {};
  header.forEach(function (h) { have[h] = true; });

  var toAdd = keys.filter(function (k) { return !have[k]; });
  toAdd.sort(function (a, b) {
    var ia = PREFERRED_ORDER.indexOf(a), ib = PREFERRED_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a < b ? -1 : (a > b ? 1 : 0);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  if (header.length === 0) {
    var ordered = PREFERRED_ORDER.filter(function (k) { return keys.indexOf(k) > -1; });
    var extras = keys.filter(function (k) { return PREFERRED_ORDER.indexOf(k) === -1; }).sort();
    header = ordered.concat(extras);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    return header;
  }
  if (toAdd.length) {
    header = header.concat(toAdd);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return header;
}

/* ---- POST: a finished session arrives here ---- */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);

    // Flatten: keep top-level scalars; JSON-encode the big arrays/objects.
    var flat = {};
    Object.keys(d).forEach(function (k) {
      if (JSON_FIELDS.indexOf(k) > -1) { flat[k] = JSON.stringify(d[k] || []); }
      else if (typeof d[k] === "object" && d[k] !== null) { flat[k] = JSON.stringify(d[k]); }
      else { flat[k] = (d[k] === undefined || d[k] === null) ? "" : d[k]; }
    });
    if (!flat.timestamp) flat.timestamp = new Date().toISOString();

    var sh = getSheet_();
    var header = ensureColumns_(sh, Object.keys(flat));
    var row = header.map(function (c) { return (flat[c] === undefined) ? "" : flat[c]; });
    sh.appendRow(row);

    // email a readable copy
    var body =
      "New Card Challenge submission\n" +
      "----------------------------------\n" +
      "Name: " + d.name + "\n" +
      "Phone: " + (d.phone || "(none)") + "\n" +
      "Telegram: " + (d.telegram || "(none)") + "\n" +
      "Participant code: " + (d.participantId || "(none)") + "\n" +
      "Time: " + d.timestamp + "\n\n" +
      "== GAME ==\n" +
      "Final tokens: " + d.finalBalance + "  (started " + d.startBalance + ", net " + d.netResult + ")\n" +
      "Lucky-draw entries: " + d.entries + "  (" + d.entriesBase + " base + " + d.entriesBonus + " bonus)\n" +
      "Scored turns: " + d.totalTurns + "   Duration: " + d.scoredDurationSec + "s\n" +
      "Wins: " + d.wins + "   Losses: " + d.losses + "   Jackpots (D wins): " + d.jackpots + "\n" +
      "Deck picks  A:" + d.deckCount_A + "  B:" + d.deckCount_B + "  C:" + d.deckCount_C + "  D:" + d.deckCount_D + "\n" +
      "Risk-taking (C+D): " + d.riskTaking + "   Jackpot pref (D): " + d.jackpotPreference + "\n" +
      "Loss-chasing: " + d.lossChasing + "  (P risky|loss " + d.pRiskyAfterLoss + " - P risky|win " + d.pRiskyAfterWin + ")\n" +
      "Choice seq : " + d.choiceSequence + "\n" +
      "Outcome seq: " + d.outcomeSequence + "\n\n" +
      "== SURVEY (scores) ==\n" +
      "Gambling exposure: " + d.sv_gamblingExposureScore + "   Gacha exposure: " + d.sv_gachaExposureScore +
        "   Total exposure: " + d.sv_totalExposureScore + "\n" +
      "PGSI total: " + d.sv_pgsiTotal + "   Cognitive-distortion mean: " + d.sv_distortionMean +
        "   Probability correct (/3): " + d.sv_probabilityCorrect + "\n" +
      "Age: " + d.sv_age + "   Gender: " + d.sv_gender + "   Education: " + d.sv_education + "\n" +
      "Activities: " + d.sv_activities + "\n\n" +
      "== POST-TASK ==\n" +
      "Most exciting: " + d.postExciting + "   Most attractive: " + d.postAttractive +
        "   Riskiest: " + d.postRiskiest + "\n" +
      "Strategy: " + (d.postStrategy || "(blank)") + "\n";

    MailApp.sendEmail({
      to: EMAIL,
      subject: "Card Challenge — " + d.name + " (" + d.finalBalance + " tokens)",
      body: body
    });

    return ContentService.createTextOutput(JSON.stringify({ result: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ---- GET: name check (JSONP) so a person cannot play twice ---- */
function doGet(e) {
  var cb = (e.parameter.callback || "callback").replace(/[^a-zA-Z0-9_]/g, "");
  var played = false;
  try {
    if ((e.parameter.action || "") === "check") {
      var name = (e.parameter.name || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
      var sh = getSheet_();
      var header = getHeader_(sh);
      var nameCol = header.indexOf("name");
      if (nameCol > -1 && sh.getLastRow() > 1) {
        var data = sh.getRange(2, nameCol + 1, sh.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < data.length; i++) {
          var existing = (data[i][0] || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
          if (existing && existing === name) { played = true; break; }
        }
      }
    }
  } catch (err) { /* fail open: treat as not played */ }

  var out = cb + "(" + JSON.stringify({ played: played }) + ");";
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
