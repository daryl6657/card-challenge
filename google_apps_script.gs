/****************************************************************************
 *  THE CARD CHALLENGE  -  Google Apps Script backend  (survey + game)
 *  --------------------------------------------------------------------------
 *  What it does:
 *    - Receives each finished session (POST) from the HTML app
 *    - VALIDATES every submission before saving (see SECURITY below)
 *    - Appends one row of data to a Google Sheet, aligned to the header
 *    - Emails you a readable summary of each result
 *    - Rejects duplicate names at submission time (no queryable name-check)
 *
 *  SECURITY (added after review):
 *    - Field whitelist: unknown fields are DROPPED, so nobody can inject
 *      arbitrary columns into the sheet by POSTing extra keys.
 *    - Payload validation: submissions must be internally consistent
 *      (turn counts, balances, and choice/outcome sequences must agree),
 *      otherwise the row is rejected. This blocks casual Postman forgeries.
 *    - Duplicate rejection: a name that already has a row is rejected.
 *    - Rate limiting: caps on submissions and name-checks per time window,
 *      protecting the sheet and the daily email quota from spam floods.
 *    - Formula-injection defense: cell values starting with = + - @ are
 *      prefixed with ' so they can never execute as spreadsheet formulas.
 *    - Errors return a generic message (no internals leaked).
 *
 *  NOTE: because the study page is public, a determined attacker who studies
 *  the page source can still hand-craft one valid-looking submission. These
 *  measures stop spam, junk data, column injection, and quota exhaustion;
 *  final data should still be screened for outliers before analysis.
 *
 *  Setup: see SETUP_GUIDE.md.  If you edit this file later you must redeploy:
 *  Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.
 *  --------------------------------------------------------------------------
 ****************************************************************************/

// ===== EDIT THIS LINE =====
// Set your real address ONLY inside the Apps Script editor after pasting.
// It is kept as a placeholder here so the public repository never reveals
// the researcher's email address.
var EMAIL = "PASTE_YOUR_EMAIL_HERE";   // where each result is emailed
var SHEET_NAME = "Responses";          // tab name inside the spreadsheet
// ==========================

// Rate limits (per rolling window, whole deployment)
var MAX_POSTS_PER_10MIN  = 30;   // finished sessions
var MAX_EMAILS_PER_HOUR  = 25;   // summary emails (rows are still saved past this)

// Fields stored as JSON text (not spread across columns).
var JSON_FIELDS = ["trials", "practiceTrials"];

// A sensible left-to-right ordering for the columns we know about.
var PREFERRED_ORDER = [
  "timestamp","name","phone","telegram",
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

/* ---------------- Security helpers ---------------- */

// Whitelist: explicit fields above, plus any survey item (sv_*) the page sends.
function isAllowedField_(k) {
  if (PREFERRED_ORDER.indexOf(k) > -1) return true;
  return /^sv_[A-Za-z0-9_]{1,40}$/.test(k);
}

// Rolling-window rate limiter backed by the script cache.
function rateLimit_(key, max, windowSec) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0);
  if (n >= max) return false;
  cache.put(key, String(n + 1), windowSec);
  return true;
}

// Clean a string cell: strip control characters (char codes below 32 and 127),
// cap length, and neutralise anything that Sheets could run as a formula.
function cleanCell_(v, maxLen) {
  v = String(v);
  var out = "";
  for (var i = 0; i < v.length && out.length < maxLen; i++) {
    var code = v.charCodeAt(i);
    if (code > 31 && code !== 127) out += v.charAt(i);
  }
  if (/^[=+\-@]/.test(out)) out = "'" + out;   // formula-injection defense
  return out;
}

function isNum_(v, lo, hi) {
  return typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
}

// Reject anything that is not an internally consistent finished session.
function validatePayload_(d) {
  if (!d || typeof d !== "object") return "bad payload";
  if (typeof d.name !== "string" || d.name.trim().length < 2 || d.name.length > 60) return "bad name";
  if (d.phone !== undefined && (typeof d.phone !== "string" || d.phone.length > 30)) return "bad phone";
  if (d.telegram !== undefined && (typeof d.telegram !== "string" || d.telegram.length > 40)) return "bad telegram";
  if (typeof d.timestamp !== "string" || isNaN(new Date(d.timestamp).getTime())) return "bad timestamp";

  if (!isNum_(d.startBalance, 0, 100000)) return "bad startBalance";
  if (!isNum_(d.finalBalance, -100000, 1000000)) return "bad finalBalance";
  if (!isNum_(d.netResult, -1000000, 1000000)) return "bad netResult";
  if (d.finalBalance - d.startBalance !== d.netResult) return "inconsistent balance";

  if (!isNum_(d.totalTurns, 1, 60)) return "bad totalTurns";
  if (!isNum_(d.wins, 0, 60) || !isNum_(d.losses, 0, 60)) return "bad win/loss";
  if (d.wins + d.losses !== d.totalTurns) return "inconsistent turns";

  if (typeof d.choiceSequence !== "string" || !/^[ABCD]+$/.test(d.choiceSequence) ||
      d.choiceSequence.length !== d.totalTurns) return "bad choiceSequence";
  if (typeof d.outcomeSequence !== "string" || !/^[WL]+$/.test(d.outcomeSequence) ||
      d.outcomeSequence.length !== d.totalTurns) return "bad outcomeSequence";

  var w = (d.outcomeSequence.match(/W/g) || []).length;
  if (w !== d.wins) return "inconsistent outcomes";

  if (!isNum_(d.durationSec, 10, 21600) || !isNum_(d.scoredDurationSec, 5, 21600)) return "bad duration";
  if (!isNum_(d.entries, 0, 10)) return "bad entries";
  return null; // ok
}

function nameExists_(sh, name) {
  var norm = function (s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); };
  var header = getHeader_(sh);
  var nameCol = header.indexOf("name");
  if (nameCol === -1 || sh.getLastRow() < 2) return false;
  var data = sh.getRange(2, nameCol + 1, sh.getLastRow() - 1, 1).getValues();
  var target = norm(name);
  for (var i = 0; i < data.length; i++) {
    var existing = norm(data[i][0]);
    // stored names may carry a leading ' from formula-neutralising
    if (existing.charAt(0) === "'") existing = existing.slice(1);
    if (existing && existing === target) return true;
  }
  return false;
}

/* ---------------- Sheet helpers ---------------- */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

function getHeader_(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(function (h) { return h !== ""; });
}

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
  var deny = function () {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: "rejected" }))
      .setMimeType(ContentService.MimeType.JSON);
  };
  try {
    if (!rateLimit_("rl_post", MAX_POSTS_PER_10MIN, 600)) return deny();

    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 200000) return deny();
    var d = JSON.parse(e.postData.contents);

    var bad = validatePayload_(d);
    if (bad) return deny();

    var sh = getSheet_();
    if (nameExists_(sh, d.name)) return deny();   // one submission per name, enforced server-side

    // Flatten with WHITELIST: unknown keys are dropped, values are cleaned.
    var flat = {};
    Object.keys(d).forEach(function (k) {
      if (!isAllowedField_(k)) return;
      var v = d[k];
      if (JSON_FIELDS.indexOf(k) > -1) { flat[k] = cleanCell_(JSON.stringify(v || []), 50000); }
      else if (typeof v === "object" && v !== null) { flat[k] = cleanCell_(JSON.stringify(v), 5000); }
      else if (typeof v === "string") { flat[k] = cleanCell_(v, 2000); }
      else if (typeof v === "number" && isFinite(v)) { flat[k] = v; }
      else if (typeof v === "boolean") { flat[k] = v; }
      else { flat[k] = ""; }
    });
    if (!flat.timestamp) flat.timestamp = new Date().toISOString();

    var header = ensureColumns_(sh, Object.keys(flat));
    var row = header.map(function (c) { return (flat[c] === undefined) ? "" : flat[c]; });
    sh.appendRow(row);

    // email a readable copy (rate-capped so spam can't burn the daily quota)
    if (rateLimit_("rl_mail", MAX_EMAILS_PER_HOUR, 3600)) {
      var body =
        "New Card Challenge submission\n" +
        "----------------------------------\n" +
        "Name: " + d.name + "\n" +
        "Phone: " + (d.phone || "(none)") + "\n" +
        "Telegram: " + (d.telegram || "(none)") + "\n" +
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
        subject: "Card Challenge - " + String(d.name).slice(0, 60) + " (" + d.finalBalance + " tokens)",
        body: body
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return deny();   // generic: never leak internals
  }
}

/* ---- GET ----
   The name-check lookup was REMOVED on purpose. It allowed anyone with this
   URL to ask whether a named person had taken part in the study, which leaks
   participation status. Duplicates are still blocked: doPost rejects any
   submission whose name already has a row. This stub keeps the JSONP shape
   so any cached old page still works, but it always answers "not played"
   and reveals nothing. */
function doGet(e) {
  var cb = (e.parameter.callback || "callback").replace(/[^a-zA-Z0-9_]/g, "");
  var out = cb + "(" + JSON.stringify({ played: false }) + ");";
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
