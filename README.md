# The Card Challenge

A browser-based psychology study delivered as a single link. It runs the full
procedure in order: consent → practice round → 50-turn card game → survey →
post-task questions → debrief. The survey deliberately comes after the game so
that gambling-related questions cannot prime behaviour in the card task. The
card game is a disguised Iowa-Gambling-style task with fixed, pre-generated
reinforcement schedules (identical for every participant), so participants
behave naturally and results are comparable across people. Compensation is a
single lucky-draw entry for completion; game score does not affect it. Each
completed session is emailed to the researcher and written to a Google Sheet,
and each person can take part only once.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire study (survey + game) in one self-contained page. This is what GitHub Pages hosts. |
| `images/` | Card-game background image. Must stay next to `index.html`. |
| `google_apps_script.gs` | Free backend: stores each result in a Google Sheet, emails the researcher, blocks repeat players. |
| `SETUP_GUIDE.md` | Step-by-step setup for the backend and for hosting on GitHub Pages. |

## Hosting (GitHub Pages)

1. Push this folder to a public GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Select branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the study is live at `https://<username>.github.io/<repo>/`.

Full backend and hosting instructions are in `SETUP_GUIDE.md`.
