# The Card Challenge — Setup Guide

This is your study, delivered as **one link** anyone can open on a phone or laptop. It runs the whole procedure in order: consent → survey → practice round → 50-turn card game → post-task questions → debrief. The card game is a disguised Iowa-Gambling-style task, so participants behave naturally instead of guessing what you are measuring. Each finished session is emailed to you and written to a Google Sheet, and each person can only take part once.

You have these files (all in this `gamble` folder):

| File | What it is |
|---|---|
| `index.html` | The whole study — survey + game in one self-contained file. This is what you host. |
| `google_apps_script.gs` | The free backend: stores each result in a Google Sheet, emails you, and blocks repeat players. |
| `images/` | The card-game background and the side-bar images. Keep this folder next to `index.html`. |
| `SETUP_GUIDE.md` | This guide. |

There are two parts: **(A)** set up the backend, **(B)** put the study online with GitHub Pages. Budget about 20 minutes. Everything is free.

---

## Part A — Backend (Google Sheet + email + repeat-player block)

### A1. Create the spreadsheet
1. Go to <https://sheets.google.com> and create a **blank spreadsheet**. Name it e.g. `Card Challenge Data`.

### A2. Add the script
1. In that sheet's menu: **Extensions → Apps Script**.
2. Delete whatever code is shown.
3. Open `google_apps_script.gs` (from this folder), copy everything, and paste it in.
4. Confirm the top line reads `var EMAIL = "daryl6657@gmail.com";` (change it if you want results sent elsewhere).
5. Click the **Save** icon.

> You do **not** need to list the survey columns anywhere. The script creates the header row automatically the first time a real submission arrives and adds a column for every survey question. If the sheet looks empty after setup, that is expected — it fills in on the first completed session.

### A3. Deploy it as a Web App
1. Top right: **Deploy → New deployment**.
2. Gear next to "Select type" → **Web app**.
3. Set: **Execute as: Me**, **Who has access: Anyone** (this lets participants' browsers reach it).
4. **Deploy**, then **Authorize access**. If you see "Google hasn't verified this app", click **Advanced → Go to (project) → Allow**. Normal for your own script.
5. Copy the **Web app URL**: `https://script.google.com/macros/s/AKfy....../exec`.

### A4. Paste the URL into the game
1. Open `index.html` in a text editor (right-click → Open with → Notepad/TextEdit).
2. Near the bottom find the **CONFIG** block and the line `backendUrl : "..."`.
3. Paste your URL between the quotes. (A working URL is already filled in from your earlier setup — replace it only if you make a new deployment.)
4. While there, change `adminPassword : "psych2026"` to your own.
5. Save the file.

> If you ever edit the `.gs` script later, redeploy: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

---

## Part B — Put it online with GitHub Pages (free, permanent, editable)

GitHub Pages hosts a folder of files at a public URL. Because your study needs `index.html` **and** the `images/` folder, upload the whole `gamble` folder's contents.

### B1. Create the repository
1. Sign in at <https://github.com> (create a free account if needed).
2. Click **+ (top right) → New repository**.
3. Name it e.g. `card-challenge`. Set it **Public**. Click **Create repository**.

### B2. Upload the files
1. On the empty repo page click **uploading an existing file**.
2. Drag in **`index.html`** and the **`images`** folder (keep the folder structure — the game loads `images/background.jpg` etc.).
   - If drag-and-drop of a folder does not work, create the folder by typing `images/background.jpg` as a filename when adding files, or use **Add file → Upload files** and select all images while keeping paths.
3. Scroll down, click **Commit changes**.

### B3. Turn on Pages
1. Repo **Settings → Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. **Branch: `main`**, folder **`/ (root)`**, click **Save**.
4. Wait ~1 minute. Your public link appears at the top of the Pages screen, like:
   `https://YOUR-USERNAME.github.io/card-challenge/`
5. That is the link you share (turn it into a QR code with any free QR generator for posters).

### Updating later
Edit `index.html` on your computer, then in the repo: **Add file → Upload files → drag the new `index.html` → Commit**. The live link updates in about a minute (hard-refresh with Ctrl/Cmd+Shift+R to see changes).

---

## How the anti-cheat works (once per person)
- **Name check across devices:** when someone enters their name, the app asks your backend whether that name is already in the sheet. If so, they are turned away.
- **Device lock same device:** after finishing, that browser is locked and shows a "Thank you" screen if reopened.
- Both are best-effort but plenty for a class study. The optional **participant code** field lets you match a session to any offline record.

---

## What the study collects (per participant)
Every finished session writes **one row** to your sheet and emails you a summary.

**Identity & game:** name, phone, participant code, timestamps, final/started/net tokens, lucky-draw entries (base + bonus), wins, losses, jackpots, per-card pick counts, longest same-card runs, win/loss streaks, switch/stay after losses, full `choiceSequence` and `outcomeSequence`, and a turn-by-turn `trials` log (card, outcome, amount, running balance, reaction time).

**Pre-computed behavioural measures (your DVs):**

| Field | Meaning |
|---|---|
| `riskTaking` | (C + D picks) ÷ 50 scored trials |
| `jackpotPreference` | D picks ÷ 50 scored trials |
| `lossChasing` | P(risky \| previous loss) − P(risky \| previous win) |
| `pRiskyAfterLoss`, `pRiskyAfterWin` | the two halves of loss-chasing |

**Survey (your IVs), each prefixed `sv_`:** demographics; per-activity frequency and spend; computed `sv_gamblingExposureScore`, `sv_gachaExposureScore`, `sv_totalExposureScore`; all 9 PGSI items and `sv_pgsiTotal`; gacha/loot-box engagement items; 3 probability-knowledge items and `sv_probabilityCorrect`; 5 cognitive-distortion items and `sv_distortionMean`; 7 decision-tendency items.

**Post-task:** `postExciting`, `postAttractive`, `postRiskiest`, `postStrategy`.

### The hidden card design (do not show participants)
Probabilities match your proposal exactly. Expected value per turn:

| Card | Win | Lose | Win chance | Expected value/turn | Role |
|---|---|---|---|---|---|
| A ♥ | +50 | −50 | 80% | **+30** | Safe, rational best choice |
| B ♠ | +120 | −100 | 50% | **+10** | Balanced |
| C ♦ | +300 | −150 | 30% | **−15** | Risky |
| D ♣ | +1000 | −150 | 10% | **−35** | Jackpot / gacha trap (worst long-run) |

An economically rational player learns to favour A and avoid D. Someone with gambling-like patterns chases D's +1000 jackpot, keeps picking after losses, and ends with fewer tokens.

---

## Lucky-draw entries (capped, ethical)
Per your proposal, entries are **capped** so the study does not resemble real gambling: everyone who finishes gets **1 base entry**, plus up to **3 bonus entries** for finishing tokens (≥2,600 → +1, ≥3,000 → +2, ≥3,500 → +3), for a maximum of **4**. Adjust the thresholds in the `computeEntries()` function inside `index.html` if you prefer, or set every finisher to a flat 1 entry for a pure participation draw.

---

## Backup export (password protected)
On the final screen, the collapsible **Researcher access** section takes your admin password and downloads a **CSV** or **JSON** of every session stored on *that device* — a safety net if email/sheet ever fails. The Google Sheet stays your master copy.

---

## Test before running for real
1. Open your live link.
2. Complete it with a test name like `zztest`: fill the survey, play the practice + 50 turns, answer post-task.
3. Check a row appeared in your sheet **and** an email arrived, with the survey columns populated.
4. Reopen the link — you should see the "Thank you" lock screen.
5. **Delete the test row before collecting real data.**

## Things you can tweak (CONFIG block in `index.html`)
- `startingBalance` (2500), `practiceTrials` (5), `maxClicks` (50 scored turns), `adminPassword`, `backendUrl`, `lockDeviceAfterPlay`.
