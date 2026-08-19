# Fortress — Debt & Margin Monitor

Private, on-device PWA covering all your debt in one place: the DBS margin loan
(margin-call headroom, interest vs portfolio gains, currency/FX-forward risk) and the
UOB home loan. Each month you import the DBS eStatement PDF — parsed **entirely in the
browser** (vendored pdf.js, nothing uploaded anywhere) — and type three numbers for the
home loan.

## Deploy to GitHub Pages (same pattern as Ignitus)

1. Create a repo, e.g. `fortress`, on your GitHub account.
2. Copy **all files in this folder** into the repo root and push:
   `index.html, parser.js, pdf.min.js, pdf.worker.min.js, sw.js, manifest.webmanifest, icon-192.png, icon-512.png`
3. Repo → Settings → Pages → Source: `main` branch, `/ (root)`.
4. Open `https://<your-username>.github.io/fortress/` on your phone →
   Share → **Add to Home Screen**. It then works offline and launches like an app.

> Consider making the repo **private** with Pages restricted, or at minimum use an
> unguessable repo name — snapshots stay only in your browser's localStorage, but the
> app shell itself is public on Pages.

## Monthly routine

1. Download the DBS Investment Statement PDF (iBanking → eStatements).
2. Open Fortress → **Import monthly DBS statement (PDF)**.
3. Review the parsed figures against the statement's Portfolio Summary page → Save.
4. Settings → **Home loan** → enter the month, UOB outstanding balance (and cash balance
   if you have the statement). The interest portion is then derived as
   *instalment − principal reduction* — arithmetic from your own two figures, never an estimate.
5. Dashboard, Trends and FX tabs update; history accumulates month by month.

## One-time setup

Ask your Relationship Manager for the portfolio's **lending value / advance ratio**
(the DBS statement does not publish it) and enter it in Settings. Until then the
margin-call lines shown are labelled *illustrative* (50/60/70% arithmetic), not DBS figures.

## Data & backup

All data lives in the browser (`localStorage`). History tab → **Export backup (JSON)**
before clearing browser data or switching phones; **Restore backup** to load it back.

## Optional

Settings → **Property** takes your own estimate of the home's market value. Leave it blank
and mortgage LTV / total net worth simply stay hidden rather than being guessed.

## Notes

- Parser is tested against the 31-Jul-2026 statement format (portfolios S-607522-0/1,
  MRTL loans, FX forwards, indicative FX rates). If DBS changes the layout, the
  review screen will show warnings — don't save a bad parse.
- Data saved by the app's earlier name is migrated automatically on first load.
- Monitoring aid only; not financial advice. Verify against official DBS statements.
