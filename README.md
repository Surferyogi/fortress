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
| DBS app → Portfolio details → Performance | TWRR **with its date range** |
| UOB "Update to your loan" rate-revision letter | new rate + its date, new instalment + its date, previous rate |
| CPF member dashboard | OA / SA / MediSave balances with their "as at" date |
| CPF Home ownership dashboard | principal withdrawn, accrued interest, properties |
| CPF transaction history (PDF or pasted) | the full ledger — contributions, interest, housing flows, insurance — reconciled against the opening and closing balances |
| anything else | manual-mapping screen — values are never guessed |

Screenshots go through in-browser OCR (tesseract.js, fetched once from a CDN and then
cached for offline use). A photo of a *letter* is often sideways: Fortress reads it as-is
first, and only if no recogniser can place the text does it retry the image rotated 90°,
270° and 180°, keeping whichever pass the recognisers scored highest. **OCR can misread
digits** — the review screen makes you check them, and the unrecognised screen now shows
the raw text it actually read so you can see whether OCR or the format was the problem.
On iPhone the accurate route is Photos → long-press the text → Copy → **Paste text**.

Nothing auto-saves. Every route ends at an editable review screen.

## Tabs

**Dashboard** — the consolidated picture: DBS margin position, total debt across both banks,
margin headroom, returns, and the Fortress strength score.
**Property** — everything about the house in one place: the UOB loan, the rate-revision
letters that reprice it, the CPF drawn into it and what must be refunded on sale, the rent
that services it, the balance and instalment-split charts, your property value, and the
monthly-entry form.
**CPF** — OA / SA / MediSave balances, what they earn under CPF's published rates, and a
year-by-year projection of today's balances.
**Trends** · **FX Risk** · **History** · **Settings** as before.

The dashboard keeps the *consolidated* debt totals (they include the mortgage) — the Property
tab holds the detail behind them.

## Monthly routine

1. Download the DBS Investment Statement PDF (iBanking → eStatements).
2. Open Fortress → **Add data** → choose the file.
3. Review the parsed figures against the statement's Portfolio Summary page → Save.
4. Add the UOB home loan the same way — import its statement/screenshot/rate letter, or type
   the balance in the Property tab's monthly-entry form. The interest portion is derived as
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

The DBS app's % depends on the **range picker**: the same portfolio reads 32.91% over one
year and 20.69% year-to-date, and shifting the endpoints by a single day moved the 1Y figure
by two points. Fortress therefore refuses to store a return without its period, and groups
every reading by window.

Fortress records **TWRR** only — time-weighted, which strips deposits and withdrawals out
and judges the holdings. Set that toggle in the app before taking a reading.

## Floating-rate revisions

A UOB rate letter carries two different dates: the new **rate** bites immediately, while the
new **instalment** starts months later. Fortress stores both legs with their own dates and
labels the card *rate upcoming* / *instalment upcoming* / *in force* accordingly — it never
averages them or assumes they move together. Between the two dates the extra interest comes
out of the principal portion, so the balance falls more slowly than the instalment suggests.

If the letter's "previous rate" disagrees with the rate Fortress already holds for the month
before, it says so and offers a one-tap correction rather than silently picking a winner.

## Making sure you're running the build you published

Fortress installs as an offline PWA, so an old copy can keep running after you publish a new
one. **The version stamp at the top of every screen is the check** — compare it with the
`VERSION` constant in the release you pushed. If it lags, tap the stamp (or Settings → About →
*Check for an update now*): that clears the cached app code, drops the service worker and
reloads from the server. Your data is stored separately and is not affected.

## CPF

Two things, deliberately kept apart.

**The ledger** is the ground truth, and Fortress rebuilds the balance path from it row by row
rather than trusting a summary: the reconstructed curve lands on CPF's own closing balances. Import the printable transaction history and Fortress
checks that opening balances plus every movement equal the closing balances, to the cent. If
they don't, rows were lost in the copy and it refuses to save rather than build totals on a
partial ledger. The ledger also settles questions no dashboard answers: when the housing
withdrawal actually happened, what contributions really run at, and — from CPF's own transfer
entry — which MediSave overflow rule applies.

**Balances** are an asset and count towards net worth — last, and in their own line, because
CPF cannot be pledged, cannot meet a margin call and cannot service either loan. The
projection grows *today's balances only*: no contributions, no top-ups, no withdrawals, and
no forecast of future Basic Healthcare Sums or retirement sums. It applies CPF's published
floor rates (OA 2.5%, SA/MediSave 4%) plus extra interest (+1% on the first $60,000 of
combined balances below 55, at most $20,000 of it from the OA), and it says in the app what
it does not model — including age 55, when the Special Account closes and a Retirement
Account is created at the Full Retirement Sum then in force.

**CPF drawn into the property** is a claim, not an asset. Principal plus accrued interest
must be refunded when the house is sold. Fortress shows it on the Property tab, subtracts it
to give cash-at-completion, and nets its monthly accrual off the mortgage principal to give
the real rate of equity build. It does *not* subtract it from net worth: the refund returns
to your CPF OA, so it costs liquidity, not wealth. Those are different numbers and the app
keeps them different.

Every CPF rate, cap and sum in the app carries its source and the date it was checked.

## Chart scales

Most charts start their axis at zero. The **home-loan balance** chart does not: a 1%
move on a S$1.3M loan is invisible from zero, so that one axis is zoomed to the data's
own range and the card says so in words. Truncating an axis without saying so is how
charts mislead; saying so is the price of showing the slope at all.

The **instalment split** chart labels each bar with its share of the instalment, and lists
the exact principal and interest figures underneath.

## Income

Property → **Rent & recurring income** tracks rent and similar. Rent is compared directly against
the mortgage instalment, since that is the pairing that decides whether the property funds
itself.

## Data & backup

All data lives in the browser (`localStorage`). History tab → **Export backup (JSON)**
before clearing browser data or switching phones; **Restore backup** to load it back.

## Optional

Property → **Property value** takes your own estimate of the home's market value. Leave it blank
and mortgage LTV / total net worth simply stay hidden rather than being guessed.

## Notes

- Parser is tested against the 31-Jul-2026 statement format (portfolios S-607522-0/1,
  MRTL loans, FX forwards, indicative FX rates). If DBS changes the layout, the
  review screen will show warnings — don't save a bad parse.
- Data saved by the app's earlier name is migrated automatically on first load.
- Seeded reference data (reported returns, lending values, rate letters) carries a
  `seedVersion`. New seeds reach devices that already installed an older build through
  additive, idempotent migrations that never overwrite anything you entered.
- Monitoring aid only; not financial advice. Verify against official DBS statements.
