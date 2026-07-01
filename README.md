# The Card Challenge

A browser-based psychology study delivered as a single link. It runs the full
procedure in order: consent → survey → practice round → 50-turn card game →
post-task questions → debrief. The card game is a disguised
Iowa-Gambling-style task, so participants behave naturally rather than guessing
what is being measured. Each completed session is emailed to the researcher and
written to a Google Sheet, and each person can take part only once.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire study (survey + game) in one self-contained page. This is what GitHub Pages hosts. |
| `images/` | Card-game background and side-bar images. Must stay next to `index.html`. |
| `google_apps_script.gs` | Free backend: stores each result in a Google Sheet, emails the researcher, blocks repeat players. |
| `SETUP_GUIDE.md` | Step-by-step setup for the backend and for hosting on GitHub Pages. |

## Hosting (GitHub Pages)

1. Push this folder to a public GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Select branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the study is live at `https://<username>.github.io/<repo>/`.

Full backend and hosting instructions are in `SETUP_GUIDE.md`.
