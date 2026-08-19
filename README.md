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

## What it reads

**Add data** accepts a PDF, a screenshot, a text file, or pasted text, and routes it:

| Source | Recognised as |
|---|---|
| DBS Treasures investment eStatement (PDF) | full portfolio snapshot — assets, loans, FX, income, fees |
| UOB Statement of Account | home-loan balance, deposits, rent credits |
| UOB home-loan screen (screenshot/paste) | balance, rate, instalment, next due date |
| DBS iBanking "Your MRTL loan draw down" | borrowing potential, credit limit, drawn, available |
| DBS app → Portfolio details → Performance | TWRR / MWRR **with its date range** |
| anything else | manual-mapping screen — values are never guessed |

Screenshots go through in-browser OCR (tesseract.js, fetched once from a CDN and then
cached for offline use). **OCR can misread digits** — the review screen makes you check
them. On iPhone the accurate route is Photos → long-press the text → Copy → **Paste text**.

Nothing auto-saves. Every route ends at an editable review screen.

## Monthly routine

1. Download the DBS Investment Statement PDF (iBanking → eStatements).
2. Open Fortress → **Add data** → choose the file.
3. Review the parsed figures against the statement's Portfolio Summary page → Save.
4. Add the UOB home loan the same way — import its statement/screenshot, or type the
   balance in Settings → Home loan. The interest portion is derived as
   *instalment − principal reduction*: arithmetic from your own two figures, never an estimate.
5. Screenshot DBS iBanking → **Your MRTL loan draw down** and import it. This is what
   makes the margin-call number real rather than assumed.
6. Dashboard, Trends and FX tabs update; history accumulates month by month.

## The margin-call number

The DBS *statement* never publishes advance ratios. The DBS *MRTL draw-down screen* does
publish your borrowing potential, which is the same information from the other end — so
importing that screen replaces the illustrative 50/60/70% lines with a real figure.

Where DBS's own "borrowing potential" and "available for drawdown" imply different
capacities, Fortress uses the **smaller** one and flags the discrepancy. A lending value
typed into Settings is kept as a cross-check, not as the headline.

## Returns

The DBS app reports a % that depends on two things at once: the **TWRR/MWRR toggle** and the
**range picker**. A 1Y TWRR and a year-to-date MWRR are different measures over different
windows and must never be read against each other. Fortress therefore refuses to store a
return without its period, and the dashboard prints the window beside every percentage.

- **TWRR** strips your deposits and withdrawals out — it judges the holdings.
- **MWRR** keeps them in — it measures what your own capital earned, and is the right one
  for asking whether your wealth is outgrowing the debt.

## Income

Settings → **Recurring income** tracks rent and similar. Rent is compared directly against
the mortgage instalment, since that is the pairing that decides whether the property funds
itself.

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
