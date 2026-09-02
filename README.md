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
**AL** — the Air Liquide employee shareholding: position, price history, the loyalty-bonus
clock, and what a single-employer concentration looks like across salary, shares and CPF.
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

### The four numbers, and what can still be done before 55

The CPF tab opens with **The four numbers that govern your CPF** — the Full Retirement Sum,
the Basic Healthcare Sum, and the two interest rates — each paired with the balance it is
measured against, so the card states a distance rather than a mood. All four were re-read
from cpf.gov.sg on **1 Sep 2026**: OA 2.5%, SA/MediSave/RA 4.0% for 1 Jul – 30 Sep 2026;
BHS $79,000 for 2026, up from $75,500; the FRS series published only to 2027 ($228,200).

Two Full Retirement Sums appear on that card and they are **not the same number**. The sum
set aside at 55 is your *cohort's* — CK turns 55 in 2028 and CPF has not published it, so
the card shows the 2027 figure and says so in bold. The cap on *topping up* the SA before 55
is the **current** year's FRS, $220,400 for 2026. Conflating them is the most common CPF
error and the card separates them explicitly.

Below the rates card, **Maximise your CPF before 55** runs six tests against CK's own
balances on every render. It is deliberately separate from the Retire tab's `retireLevers()`,
which answers "at and after 55"; the card says so and points there rather than repeating it.
Each lever prints the arithmetic that opened or closed it:

| Lever | Result | When that changes | The arithmetic |
| --- | --- | --- | --- |
| Voluntary housing refund | **open** | no deadline | up to the $502,500.00 principal drawn; $3,140.64 accrued so far, growing $1,046.88/month |
| SRS — this year's allowance | **open** | closes in 121 days (31 Dec 2026) | $15,300 cap for 2026 − $1.00 used = **$15,299.00** |
| Put more into the Special Account | closed | reopens only if the FRS catches up — it is not | $220,400 − $310,602.02 = **−$90,202.02** |
| Top up MediSave to the BHS | closed | resets yearly (1 Jan 2027, 122 days) | $79,000 − $79,000.00 = **$0.00** |
| Extra interest on the first $60,000 | closed | improves by $300/yr at 55 | combined balances $466,040.26 — saturated at $600.00/yr |
| CPF Annual Limit headroom | closed | resets 1 Jan 2027 | $22,940 posted + 5 × $2,960 = **$37,740 = the limit exactly** |
| The 4% clock on the Special Account | closed | happens in 726 days (27 Aug 2028) | $82,402.02 excess × 1.5pp = **$1,236.03/yr, permanently** |
| Top up to the Enhanced Retirement Sum | closed | opens in 726 days (27 Aug 2028) | age 55 only; he is 53, and no RA exists until 27 Aug 2028 |

### Open and closed are verdicts for today

A binary verdict answers "can I do this now" and silently implies "and that is the whole
story", which is false for six of the eight rows. Every lever therefore carries a **when**
alongside its verdict, shown on the collapsed row so it is read at the same moment as the
OPEN/closed: a chip under the lever name, and the date itself beside the verdict. The card
header counts them (*"2 of 8 open · 1 needs a fact · 5 dated"*) and names the nearest date
in the lead paragraph.

Six kinds, and the distinction between two of them is the point:

- **deadline** — open now, closes on a date (SRS, 31 Dec 2026)
- **opens** — closed now, opens on a *known* date (the ERS, 27 Aug 2028)
- **conditional** — closed now, and reopening depends on a condition, not a date
- **annual** — resets every year (MediSave, each January)
- **changes** — stays, but its terms move on a date (extra interest, at 55)
- **fires** / **anytime** / **needs** — a dated event; no deadline at all; blocked by a
  missing number rather than by time

`whenBadge()` **structurally refuses** a dateless `opens` and downgrades it to
`conditional`, because "opens later" implies a queue the lever may not be in. The SA row is
the case that forced this: it was first written as `opens`, which quietly promised a
reopening Fortress cannot promise. It is conditional, and the chip names both the condition
and its direction — *"reopens only if the FRS catches up — it is not"* — backed by
arithmetic on published figures only: his SA compounded at the 4% floor with no
contributions against CPF's announced sums gives a gap of **$90,202 for 2026 and $94,826
for 2027, widening**. Beyond 2027 the sums are unpublished and the row stops there rather
than extrapolating. It also notes the hard stop: the route shuts permanently on 27 Aug 2028
when the Special Account is closed.

Adding the timing surfaced something the card had missed entirely: **extra interest gets
better at 55 with no action at all.** Below 55 it is +1% on the first $60,000 = $600.00/yr.
From 55 it becomes +2% on the first $30,000 and +1% on the next $30,000 = $900.00/yr on the
same balances. The one row on the card where doing nothing pays, and it had been described
only as a saturated ceiling.

The card is titled **CPF and SRS**, not CPF alone, and says why: SRS is not CPF but *is* a
before-55 lever — the only tax-relief route still open to him — while the ERS is the
opposite, the thing people expect to find on a list like this which turns out not to exist
before 55. Leaving either off would have been the bigger error.

Five of those deserve a note.

**The housing refund is the only open route, and it is priced against its real alternative.**
Cash put back into CPF earns the OA rate of 2.5%; the same cash used to prepay the mortgage
saves 1.13020%. The spread is +1.370 percentage points — $136.98 a year per $10,000 moved.
Against that, the card quotes CPF verbatim on the lock ("you will not be able to withdraw the
refunded amount … until you meet the CPF withdrawal conditions from age 55"), dates it to
CK's own birthday (726 days, to 27 Aug 2028), and warns that because his combined balances
are $466,040 — far past the $60,000 extra-interest band — a refund earns the plain 2.5% and
**no extra interest**. Fortress will not size the refund: it does not know his cash position
outside DBS and CPF, and says so instead of assuming one.

**Extra interest is a ceiling he is already through.** This is the single most important
thing on the card, because it silently reprices every other lever: he collects the full
$600.00 a year and not one dollar more, whatever he does. Every further dollar into CPF
before 55 earns the base rate only.

**The 4% clock has no defence, and the card says so.** CPF closed the Special Account for
members 55 and above on 19 Jan 2025; the change does not affect anyone below 55, so nothing
happens to CK until 27 Aug 2028. On that day the excess above the retirement sum steps down
from 4% to 2.5%. The "SA shielding" workaround people still describe was removed with the
account itself — a bigger SA today simply means a bigger balance stepping down. The card
prices the step rather than implying something can be done about it, and flags that the
unpublished 2028 sum makes $82,402.02 an *upper* bound on the excess.

**SRS separates the room from the value, and refuses to conflate them.** The room is
arithmetic: $15,299.00 left of the 2026 cap, gone on 31 December, no carry-forward (MOF's
wording quoted). Whether the *relief* is worth anything is a different question, and it
turns on Singapore tax residency and on having Singapore assessable income. **Fortress could
not verify IRAS's rule on personal reliefs for non-residents from a primary source in this
session, and so asserts nothing about it** — the lever says exactly that. It does state the
one piece it holds: rent of $5,800/month, $69,600/year gross, Singapore-source. It does not
hold the deductible expenses, his residency status, or his marginal rate, so it prints the
gross figure and refuses to derive a tax saving. The action is ordered accordingly: confirm
eligibility with IRAS or a tax adviser *first*, decide the amount second — contributing
without the relief locks money up for no tax benefit.

**The ERS is not a before-55 lever, and the card says so rather than quietly omitting it.**
CPF's definition is the whole answer: *"ERS is double the current year's FRS and is the
maximum amount you can top up to your RA if you are aged 55 and above."* The Retirement
Account does not exist until 27 Aug 2028, so there is nothing to top up; the before-55
ceiling is the FRS instead, and that is shut too by $90,202.02. For scale the ERS would be
$456,400 on the last published figures — flagged as **not fixed by cohort**, since it moves
with each year's current FRS. An ERS top-up above the FRS also carries **no tax relief**:
*"Tax relief is only granted up to the current year's FRS."* The card closes with the one
real connection between the two open levers — the ERS transfer at 55 is funded out of
whatever sits in the OA on the day, and the housing refund is the only thing on the card
that increases it.

While adding this, the ERS derivation was changed from `BRS × 4` to `FRS × 2`, which is how
CPF itself states it. The number is identical ($456,400) because FRS = 2 × BRS; `maxtest.js`
now pins both derivations to each other so a future divergence fails loudly instead of the
app silently showing a figure from the wrong rule.

### The Annual Limit stopped being unknown

It was the card's one unknown, on the grounds that "a ledger extract is not a year-to-date
total". That was true of how the ledger was being *read*, not of the ledger. Every `CON` row
carries the **wage month it is for**, and the total divided by the 37% contribution rate
recovers the wage that produced it. Read that way, the ledger answers the question outright.

A fifth card, **"What goes in — the four contribution ceilings"**, now sits under the rates
card:

| Ceiling | 2026 | His position |
| --- | --- | --- |
| Monthly OW ceiling | $8,000 | **at it, all 7 posted months** ($2,960/mo) |
| Annual Salary Ceiling | $102,000 | $62,000 used ($56,000 OW + $6,000 AW) |
| AW ceiling | $6,000 | **fully used** ($6,000 in MAY 2026) |
| CPF Annual Limit | $37,740 | $22,940 so far · **$0 projected room** |

The four interlock, and that is what closes the lever: **37% × $102,000 = $37,740 — the
Annual Limit exactly.** A full year at the Ordinary Wage ceiling consumes the entire limit
on compulsory contributions and leaves nothing voluntary. His ledger: $22,940 for 7 wage
months, plus 5 more at $2,960 = $14,800, giving **$37,740 for the year against a limit of
$37,740**. To the cent.

Three things this required care over:

- **Wage month, not posting date.** The 15 Jan 2026 posting is for DEC 2025 wages and must
  not land in 2026. Seven 2026 rows, not eight; `maxtest.js` asserts the DEC 2025 row is
  excluded.
- **The wages are implied, never told.** Fortress holds no payslip. Each row ÷ 37% recovers
  the wage — every month comes back at exactly $8,000, matching CPF's own published monthly
  maximum of "$2,960". The card says this is *"a floor on your wage, not your wage"*:
  anything above the ceiling produces the same contribution and is invisible.
- **The projection has exactly one assumption, and it is labelled.** The remaining 5 months
  are carried at the ceiling because every posted month has been at it — but Fortress does
  not know his salary. The card states the sensitivity that undoes it: **$370 of room per
  $1,000 of monthly shortfall**. The old "contributions are unknown" gap was retired and
  replaced with a `low` one naming the projected months, so no gap contradicts the card.

### Why MediSave stopped taking its share

The first version of this said *"$703.98 a month is $126.72 a year on a full year of
redirection"*. **Both halves were wrong.** $703.98 was the *partial* transition month — the
top-up that landed MediSave exactly on the cap — not the ongoing monthly redirect. And a
full year of redirection never happens, because every January the cap rises and MediSave
refills. `medisaveCycle()` now derives the mechanism from the ledger instead.

**The mechanism.** MediSave is the only CPF account with a hard ceiling. Contributions split
by fixed allocation rates — for the 50-to-55 band, OA 40.55% / SA 31.08% / MA 28.37% — so a
$8,000 month sends **$839.75** towards MediSave. At the cap that share cannot fit and is
redirected; because his SA is already past the FRS it lands in the **OA at 2.5%, not the SA
at 4%** — a 1.5pp gap.

**Dated off his own ledger.** 12 May 2026 is the month it filled: MediSave took $703.98 of
the $839.75 due — precisely the room left — and the other $135.77 went to the OA, landing
MediSave on $79,000 to the cent. From 11 Jun 2026 the whole share is redirected. 2026 to
date: **$3,284.84 redirected, costing $49.27 a year**, rising $12.60 a year per further
month. The bonus month redirects more than a normal one ($1,469.57), which a flat monthly
figure would have missed.

**A sawtooth, not a cliff.** Room reopens three ways, and the ledger shows all three:

| Source | Amount | Ledger |
| --- | --- | --- |
| Year-end interest sweep to the *old* cap | $2,926.39 out | TFR, 1 Jan 2026, to the OA |
| January rise in the cap | +$3,500 | $75,500 → $79,000 |
| Deductions during the year | $500.00 out | code `MED`, 19 Jan 2026 |

**The reconciliation is the proof.** Room opened = $3,500 + $500 = **$4,000.00**. MediSave
took in **$4,000.00**. They match to the cent, and `maxtest.js` asserts they do — if they
ever stop matching, the explanation is a story fitted to the numbers rather than a reading
of them, and the card says so on its face.

**Why it recurs.** A $3,500 rise absorbs about **4.2 months** of an $839.75 share against a
full-year share of $10,077. Unless the BHS starts rising by more than that, most of every
year is redirected. No forecast of the next rise is made; CPF has published none.

### It is a trade, not a loss — a correction

The first version of this section called the redirect *"forgone interest"* and stopped
there. That was one-sided and the card now says so explicitly. What is given up is 1.5pp a
year. What is gained is liquidity, and CPF's own words settle it: *"MediSave cannot be
withdrawn in cash and are instead paid directly to MediSave-accredited medical
institutions."* MediSave money is healthcare-only for life. The Ordinary Account money it
becomes is — because his Special Account already covers the retirement sum unaided —
**withdrawable in cash from 27 Aug 2028**. So $3,284.84 has moved from an account he could
never take cash from into one he can, at a cost of $49.27 a year.

Whether that is a good trade turns on whether he would ever spend $79,000 of MediSave on
healthcare. Fortress does not know, says it does not know, and declines to weigh the two
sides. It notes the one narrow cash exception CPF publishes (severe disability, $200/month,
age 30+).

Two absolute claims were also narrowed to what is actually true:

- *"MediSave is the only CPF account with a hard ceiling"* → **"of your three accounts, the
  only one with a ceiling on the balance itself"**. The OA and SA have none; the RA's ERS is
  a top-up cap and does not exist before 55.
- *"nothing you can do redirects it back"* → **"money already redirected cannot be moved
  back"**, plus the one real lever on the *flow*: paying an eligible medical bill from
  MediSave rather than in cash reopens that much room, so the next contributions land at 4%
  instead of 2.5% — worth $15.00 a year per $1,000. The card immediately notes this cuts
  against the liquidity point, and states both without picking.

A test in `maxtest.js` had been **pinning the overclaim** (`/nothing you can do redirects it
back/`) rather than testing a fact. A test that locks in a claim is worse than no test. It
was removed and replaced with assertions on the accurate wording.

The allocation rates, previously carried as a constant, were re-read from CPF's published
table on 1 Sep 2026: *"Above 50 – 55"* — OA 0.4055, SA 0.3108, MA 0.2837, summing to 1.
`maxtest.js` now also checks, row by row against the raw ledger rather than against the
engine, that what MediSave lost the OA gained, to the cent.

One deliberate omission: Fortress reports the transaction **codes** (`CSL`, `MED`, `DPS`)
and what each did to the balance, and does not expand them into scheme names. CPF publishes
no code glossary that could be cited, and a plausible expansion is still a guess. A test
asserts no scheme name appears on the card.

`maxtest.js` (206 assertions) covers all of this: every figure, every lever verdict, the
verbatim CPF quotes, plain-English collapse behaviour, no horizontal overflow at 360px, and
a surgical check that `cpfPlan()`, `retireAt55()`, `retireLevers()` and the seed version are
all untouched. One assertion in it was written wrong first — it claimed three of the seven
at-55 levers were open when only two are — and the app was right, not the author. It now
asserts the lever ids rather than a count. A second stale assertion surfaced the same way:
`/Maximise your CPF before 55/` kept passing months after the card was renamed, because a
**gap entry elsewhere on the page quoted the old title**. It was matching stale prose, not
the card. It is now anchored to the card's own `h2` element.

## MCST maintenance

Read straight off the MCST 4940 tax invoice dated 2 Sep 2026 for #07-04 (share unit 6),
managed by Knight Frank. Nothing is derived at the seed:

| | |
| --- | --- |
| Management fund | $1,368.00 a quarter |
| Sinking fund | $90.00 a quarter |
| **Per quarter** | **$1,458.00** (GST shown at 0.00%) |
| Annualised | $5,832 — **$486.00 a month** |
| Share of gross rent | **8.38%** of $69,600 |
| Next due | 30 Sep 2026 |

Three things the card is careful about.

**The annualisation is labelled as one.** Fortress has seen a single invoice, not a year of
them. Contributions are set by the MCST's budget and can be revised at a general meeting, so
$5,832 is the current run rate, not a commitment — and GST is 0.00% *on this invoice*, which
would move the figure if it ever changed.

**The brought-forward line is reported, not interpreted.** The 1 Jun – 31 Aug quarter shows
as $1,458.00 brought forward, so the invoice totals $2,916.00. That may be arrears or it may
be timing: the invoice itself says *"Payments received after 31/08/2026 will not be reflected
in this statement."* Fortress cannot tell the two apart, says so, and **does not assert he is
in arrears**. It states the conditional instead: if it is outstanding, interest has run from
1 Jul 2026 — 30 days from the first day of the billing period, derived from the period rather
than assumed — at $0.48 a day, $14.58 a month.

**12% p.a. is the most expensive money in his structure**, and the card says so plainly:
10.87 points above the 1.130% mortgage and 9.90 points above the 2.10% margin loan. This is
the one bill where paying on the day beats any other use of the cash.

Two reminders come off it: a dated one counting down to 30 Sep, toned by proximity, and a
warn-level one on the brought-forward quarter that asks him to check the account and dismiss it.

### MCST is a cost against the rent, not a footnote

`rentNet()` now takes it off the top, and the conclusion changes:

| | |
| --- | --- |
| Gross rent | $5,800.00/mo |
| Less MCST maintenance | −$486.00/mo |
| **Net rent** | **$5,314.00/mo** |
| Mortgage instalment | $5,485.67/mo |
| **Cover** | **96.9%** — $171.67 short each month |

On gross rent the property reads as self-funding at **105.7%**. It is not. Once the MCST — a
fixed, quarterly, invoiced obligation — comes off, cover is **96.9%** and the property draws
**$171.67 a month, $2,060.04 a year**, from his own cash flow. Both figures are shown together
so the gap between them is the point rather than a footnote, and the card still says this is
the *best* case: property tax, insurance, agent commission, repairs and vacancy remain unknown.

The plain-English summary was carrying the old gross figure and has been corrected the same
way. The card also moved up the Property tab — it now sits below the home loan and above the
rent-cover card it feeds, rather than near the bottom — and the billing periods are `.kv` rows
instead of a table, which could not hold currency columns at 390px.

### A timezone bug his screenshot caught

The arrears banner rendered **30 Jun 2026** on his phone where the test suite asserted 1 Jul.
Both were reading the same code. The trigger was built as `new Date(iso+'T00:00:00')` — parsed
as **local** midnight — then read back with `.toISOString()`, which converts to **UTC**. East
of Greenwich that subtracts hours and lands on the previous day. The test runner is UTC, so it
could never see it; every Singapore phone could.

A calendar date must not round-trip through a timezone. `addDays()` does the arithmetic in UTC
and never leaves it. Two follow-ons:

- `mcsttest.js` now runs its whole browser context at `timezoneId: 'Asia/Singapore'`, so the
  suite reproduces his device rather than the runner's.
- That immediately exposed the *same* flaw in the test's own helper: it computed expected day
  counts in Node (UTC) and compared them against a page running at UTC+8, failing correct code
  by one day. Expectations are now asked of the page, in the same clock as the thing under test.

The Property gap was **narrowed, not closed** — MCST is one running cost of several, and
property tax, insurance, agent commission, repairs and vacancy remain unknown, so net yield is
still overstated, by less than before. The gap still closes properly when the remaining annual
total is entered; an unconditional version of it would have told him a figure was missing
after he had supplied it, and `simpletest.js` caught exactly that.

### A test-quality bug this shipment exposed

Several assertions in `maxtest.js` had **frozen day counts** — `726`, `121`, `122`. Those decay
at midnight, and the suite began failing the next morning with no code change at all. A test
that expires is worse than no test, because it trains you to ignore red. Both `maxtest.js` and
`mcsttest.js` now derive the expected count from the date at run time, so the assertion is that
the app counts the same days the test does — not that the answer is a particular constant. The
reminder-tone assertion was rewritten the same way: it asserts the *rule*
(`≤7 serious, ≤21 warn, else info`) rather than today's output.

`mcsttest.js` — 56 assertions, including no horizontal overflow at 360px and 390px, that the
brought-forward line declines to call arrears, and that nothing else on the Property tab moved.

## What it must sell for to break even

The Option to Purchase closed the tab's oldest major gap — what he paid. Sale price
**$2,450,000**, option granted 10 Feb 2026, expiring 8 Apr 2026, completed 20 May 2026,
sold subject to the existing tenancy (which is where the rent comes from). Option money
$24,500 = 1%; deposit $98,000 = 5% less the option money. Both check out against the price.
The PropNex commission of $29,400 + GST on the OTP is the **vendor's**, and is recorded as
such so it never lands in his costs.

**Stamp duty is computed from the published tiers, not remembered.** BSD on $2,450,000:
$180,000@1% + $180,000@2% + $640,000@3% + $500,000@4% + $950,000@5% = **$92,100.00**. The
bands are printed on the card so the total can be checked by hand.

**SSD is the number that dominates everything.** He acquired in 2026, so the regime is the
one that took effect 4 Jul 2025: a **four-year** holding period at **16 / 12 / 8 / 4%**, not
the older three-year 12 / 8 / 4%.

The break-even solves `P − SSD(P) − commission(P) = what went in − what the property threw
off`, which rearranges to **P = netIn ÷ (1 − SSD − commission)**. It is a division, not a
subtraction, which is the whole point: at 16% he must find 16% *more than* the shortfall,
not 16% of it.

| Sell by | SSD | Break-even (1st property) |
| --- | --- | --- |
| 10 Feb 2027 | 16% | **$2,984,100** (+21.8%) |
| 10 Feb 2028 | 12% | $2,793,172 (+14.0%) |
| 10 Feb 2029 | 8% | $2,618,702 (+6.9%) |
| 10 Feb 2030 | 4% | $2,458,910 (+0.4%) |
| from 10 Feb 2030 | none | $2,360,554 (−3.7%) |

### ABSD — settled by him, and attributed to him

CK confirmed on 2 Sep 2026 that this is his only residential property, so ABSD is the
Singapore Citizen first-property rate: **0%, or $0**. It is stored as `absdSource:
"confirmed by you on 2 Sep 2026"` — his statement, never dressed up as something Fortress
read in a document, because the OTP says nothing about how many properties he owns. Clearing
the setting restores all three citizen scenarios, so a change of circumstance stays
expressible; a test asserts both directions.

### The break-even was defined wrongly, and CK caught it

The first version netted the accumulated rent off the capital and called the result *the*
break-even. That produced **$2,360,554** at the SSD-free date — **below the $2,542,100 he
actually put in**. He challenged it, and he was right. Rent is the **return** on the money,
not a discount on its cost; netting it silently assumes the same $2,450,000 would have
earned nothing anywhere else, which is false on the face of his own portfolio.

The card now computes three figures and leads with the strict one:

- **Capital break-even** (headline) — what a sale must fetch to return the price, BSD, ABSD
  and legal fees, after SSD and commission on the way out. Rent excluded.
- **Cash break-even** (grey, secondary) — the same net of rent collected. Explicitly
  labelled *"the flattering number and not the headline"*, and framed as answering "am I
  down overall", never "what must it fetch".
- **Real break-even** — the capital figure indexed to the sale date at a rate **he** sets.
  Off by default. MAS blocks automated fetching, so Fortress could not verify a current
  Singapore inflation figure and says so rather than seeding one.

| Sell by | SSD | Capital break-even | counting rent |
| --- | --- | --- | --- |
| 10 Feb 2027 | 16% | **$3,074,179** (+25.5%) | $3,031,301 |
| 10 Feb 2028 | 12% | $2,932,335 (+19.7%) | $2,835,315 |
| 10 Feb 2029 | 8% | $2,803,004 (+14.4%) | $2,656,470 |
| 10 Feb 2030 | 4% | $2,684,598 (+9.6%) | $2,492,876 |
| from 10 Feb 2030 | none | **$2,575,791** (+5.1%) | $2,391,839 |

(These include the 1.308% commission derived below. Without it the floor is $2,542,100.)

### The fees: one is documented, two are not

CK asked for the fees from his own purchase. One of the three is genuinely on the paper:

- **Agent commission — 1.308%, documented.** The OTP records the vendor paying PropNex
  **$29,400** on a **$2,450,000** sale = **1.2%**, and **$32,046** with GST, which implies a
  **9%** GST rate. That is now the default in every row, with the derivation printed so it
  can be checked, and overridable.
- **Legal fees, purchase and sale — not available.** Neither appears on any document
  Fortress holds; the OTP names the *vendor's* solicitor and states no fee. Fortress refuses
  to estimate them. What it gives instead is the **sensitivity**: every $1,000 of legal fees
  adds **$1,013** to the break-even once SSD is gone and **$1,209** while it is still 16% —
  because the fee has to be recovered out of a sale that is itself taxed. Both input labels
  read "not available to Fortress".

### The CPF accrued interest — asked about, and deliberately excluded

$502,500 went in; $505,640.64 comes back. **The gap is accrued interest: $502,500.00 +
$3,140.64 = $505,640.64.** CPF charges itself interest on money taken out as though it had
never left — 2.5% a year, **$1,046.88 a month** on this principal, growing whether he sells
or not. The plain-English line and the break-even card now spell that addition out, because
the two figures sitting side by side with no bridge is exactly what prompted the question.

**A modelled number was overriding a documented one.** The first version of `cpfClaimOn()`
re-derived the accrual from the withdrawal date (24 Apr 2026) and produced **$4,470** where
his CPF statement says **$3,140.64**. CPF's figure is exactly *three* months of accrual at
2.5% on the principal — the clock does not start on the withdrawal day the way a naive model
assumes. The statement is the authority: the claim is now **anchored to it** and grown
forward from its own as-of date at the OA rate, compounded annually, which is CPF's stated
basis. `cpfClaimOn(statementDate)` returns CPF's own figure **to the cent**, and a test
asserts that invariant rather than any particular projection.

**None of it is in the break-even, and that is a decision, not an omission.** The refund
leaves the sale proceeds but lands in his own CPF — it moves between his pockets rather than
out of them, so it changes what he *receives*, not what he is *worth*. Adding it would also
**double-count**, because the $502,500 principal already sits inside the $2,450,000 price.

What it does change is the cheque, so the card now shows one: at the 10 Feb 2030 break-even,
gross less SSD less commission less the **amortised** loan balance (projected from today's
$1,334,491 at the current rate and instalment, both floating — not frozen, which would have
understated the cash by four years of principal) less the CPF refund.

### A silent regression, and the guard that hid it

Rewriting `cpfClaimOn()` with a block replace **deleted `mortgageBalanceOn()`** along with
it. There was no error, because the call site was written defensively as
`(typeof mortgageBalanceOn === 'function') ? mortgageBalanceOn(when) : null` with the balance
then defaulting to `0` — so a missing $1.3m mortgage silently became no mortgage at all, and
the cheque overstated the cash by that much. **A guard that substitutes a plausible default
for a missing input is worse than no guard**: it converts a loud failure into a quiet wrong
answer. The function is restored, and the fallback now yields `null`, with the card printing
*"Fortress cannot project the loan balance to that date, so it will not show a cheque rather
than compute one against a zero mortgage."* `betest.js` stubs the projector out and asserts
both the refusal and the message. And the downside has a
floor, quoted from CPF: *"If the selling price after paying your outstanding housing loan is
not enough to cover the required CPF refund, you do not need to top up the shortfall in cash
if you have sold the property at market value."*

The plain-English line he quoted was silent on all of this and now carries the interest, the
monthly growth rate, and the point that it is still his money.

### Two test bugs of mine

- `B.legalSensitivity(...)` was called on a value returned from `page.evaluate` — **functions
  do not survive that serialisation**. The sensitivity is now computed inside the page.
- The 2.5%-inflation floor was pinned to a literal that moved the moment commission entered
  the denominator. It is derived from the row's own inputs now.

### The answer changed with the definition

Under the corrected headline, **no date on the ladder breaks even at today's price.** The
floor — once SSD is gone entirely — is $2,542,100, and the gap to the $2,450,000 the flat is
marked at is **exactly $92,100, the Buyer's Stamp Duty**. That falls straight out of the
arithmetic: the reference value *is* the purchase price, so the shortfall is precisely the
duty paid on top of it. A test asserts the identity rather than the number.

The banner now says the thing that matters: **the price has to move; waiting alone does not
get there.** Waiting only removes the stamp duty sitting on top of the shortfall. At a 2.5%
inflation rate — his input, not Fortress's — the floor becomes $2,787,285, +13.8% on what he
paid.

### A crash the new test caught

Clearing the ABSD selection took the entire Property tab down: the explanatory box read
`floorRow`, which only exists once a profile is chosen. `betest.js` now asserts the tab still
renders with no page errors after clearing, in both directions.

### His own trade, separated from the evidence

CK also confirmed the recorded transaction *is* his purchase. `propertyValue()` now splits
the comparables into `own` and `independent`, and the value card sets his own trade aside to
show what is actually left:

| | | |
| --- | --- | --- |
| His purchase | Feb 2026 | **$2,450,000** |
| Only other 915 sqft sale on file | Jun 2023 | $2,480,000 — 1.2% **above**, 33 months earlier |
| Automated estimate | Aug 2026 | $2,390,000 — 2.4% **below** |

**Neither supports the flat being worth more than he paid**, and the card says so in those
words. The gap was rewritten from a suspicion ("the same number") to a confirmed fact ("the
valuation is your own purchase, confirmed"), sourced to him.

### Two modelling errors caught before shipping

- **The carry was frozen at today.** The first version applied 3.4 months of net carry to a
  sale four years out, understating the carry by years and overstating every distant rung.
  Each row now accrues the carry to its own date. The rate is still held at today's, and the
  card says so: mortgage interest falls as the loan amortises (which would raise the carry),
  the rate floats and the tenancy is not permanent (which could lower it).
- **The SSD-free row was labelled "sell by".** It is a *from* date, not a deadline. Fixed in
  the engine, and asserted.

Every unknown is listed on the card with the direction it pushes: purchase legal fees, sale
legal fees, sale commission, property tax, insurance and repairs all make the real break-even
**higher**, never lower. The SSD clock also starts on the date the Option was *exercised* —
not completion — which Fortress does not hold; the whole ladder can shift by up to the 57-day
option window.

### The valuation was circular, and now says so

Fortress valued the property at $2,450,000 on "the last equivalent transaction". He bought at
$2,450,000. Those are the same number — either it *is* his own caveat or an identical one.
Either way the property shows neither gain nor loss **by construction**, because there is one
data point and it is his own purchase, not because the market has been flat. A high-severity
gap now says this, and the value card carries a banner above the hero figure. Every
break-even percentage on the tab is measured against that same number.

`betest.js` — 129 assertions, at `Asia/Singapore`. Two of them exist because I got the
arithmetic wrong first: the option window is 57 days, not the 58 I asserted from memory, and
it is now derived rather than restated.

### A test that pinned a constant

`maxtest.js` and `mcsttest.js` both asserted `seedVersion === 13`, which broke the moment a
migration was legitimately needed for the purchase seed. They now assert the *relationship* —
that the stored version tracks the app's own `SEED_VERSION` — so a real migration passes and
a missing one still fails.

## Reminders

The Overview tab carries a **Reminders** card in two halves.

**Dated** items count down from documents you imported — the loan maturity from the DBS
statement, the instalment change from the UOB letter, age 55 and the MediSave cap from your
date of birth. A dated item raises a banner only when its date is close and the existing
alert list does not already cover it, so there is one banner stack on that screen, not two.

**Standing** items are rule tests re-run every time the screen draws, never notes typed once.
The SA top-up test computes *FRS − your SA* and reports it closed because that figure is
negative; the day the FRS overtakes your SA it will say open, with the headroom, without
anyone editing anything. The same applies to the MediSave cap, the borrowing-rate-versus-CPF
spread, currency concentration and the property's share of net worth.

Each item carries its source and can be dismissed and brought back. The card ends by saying
plainly that these are prompts and not advice: Fortress does not know your income needs, tax
position, family or retirement date, and the age-55 choice turns on all four.

## Air Liquide

Both the account statement (PDF) and the shareholder portal import through Add data. The
parser handles two traps the documents set: "Sub-total" also contains the word *total*, and
the "Bonus in YYYY" label is printed once per block and vertically centred, so it can appear
above or below the rows it governs. Rows are therefore read block by block, and an import is
refused outright if the lines do not add up to the total the document itself states.

The holding is transcribed line by line from the account statement — nineteen lines across
vintages 2006 to 2025, split between performance shares, employee-savings (ESPP) and ordinary
shares. Fortress derives the totals rather than trusting the summary, and reconciles them
against the shareholder portal: all 15 lines of the largest tranche — type, quantity,
blocked/available status and vintage — match the PDF exactly, and the two different valuations
on the same day are explained by two different closing prices, both of which appear in the
price series to the cent.

Prices are **raw, not adjusted for corporate actions**. The 10 June 2026 free-share
attribution (1 for 10) shows as a step down in the chart, because that is what the quote
actually did — and the card says so, along with the fact that the multi-year percentages
therefore understate the true return.

**Performance-share vesting** is recorded from the portal's History: five plans, each vesting
four years after its late-September attribution, 1,376 shares in total and €203,843.62 of
"capital gain on acquisition". Every row multiplies out to the stated figure to the cent. The
card is explicit that this is an acquisition gain — the full value of a free share at vesting,
the figure tax authorities use — and not a measure of how the shares have done since.

Fortress also **checks the loyalty rule against the share counts themselves**. Two tranches
vested in 2024 and 2025, too recently to have completed two full calendar years, and after the
June 2026 attribution they hold exactly ⌊373 × 1.10⌋ = 410 and ⌊407 × 1.10⌋ = 447 — the plain
entitlement, floored, with no bonus. Older tranches have been through several attributions and
possibly sales, so they are left out rather than reported as anomalies.

The **loyalty bonus** is +10% on dividends and on free-share attributions, for shares held in
registered form for more than two full calendar years. The three ISIN lines are exactly that
clock: one qualifying now, one from 2027, one from 2028. Both future dates are reminders.

**Dividends** are transcribed from all six pages of the payment notices — **2012 to 2026, the
complete record**, thirty payments. Every one reconciles: coupons × unit amount equals the stated
gross to the cent. The second payment each year is the loyalty bonus, and across all fifteen years
its unit is the base amount taken to a tenth and *truncated* to the cent, never rounded up (€2.95 →
€0.29, €2.55 → €0.25). So the headline "+10%" is really 9.8–10.0%. Fifteen years: **€64,103.10
gross, €55,283.57 net, €8,819.53 withheld at source** — a blended 13.76%.

**The withholding rate has moved four ways, and it went down as well as up.**

| Years | Rate | Method |
|---|---|---|
| 2012–2013 | 9.99% | SUBSIDIARY |
| 2014–2016 | 29.93–30.00% | SUBSIDIARY |
| 2017–2019 | 10.00% | BANK TRANSFER |
| 2020–2026 | 12.80% | BANK TRANSFER → SUBSIDIARY (2021) |

The card groups the years by the rate actually charged rather than averaging rates that were never
applied together, and it labels a run as a range when its years disagree. **2014** is singled out: at
29.9268% it does not match the ~30% charged either side of it, and since the coupons and gross
reconcile exactly there, the difference is in the deduction, not the transcription.

What is sourced: 12.80% is France's domestic withholding rate for non-resident individuals, in force
for income paid since 1 January 2018 (PwC Worldwide Tax Summaries), and the France–Singapore treaty
caps portfolio dividends at 15% — *above* it — so the treaty offers nothing to reclaim and the
current deduction looks correct. What is **not** sourced: Fortress could find no source for the
pre-2018 French domestic rate for non-residents, so it does not attribute the ~30% years to any rule,
and it does not guess why 10% applied 2017–2019 and then stopped. The card says so in those words. It
also states that Fortress has **not** verified the Singapore-side treatment of this income.

The costliest stretch is the current one — 12.80% on €46,525 of dividends is €1,305 more than the
~10% years, not because the rate is the highest ever charged but because the sums are far larger now.
The payment route changed twice (2012–2016 subsidiary, 2017–2020 bank transfer, 2021– subsidiary);
of the two route changes and three rate changes only one coincides, in 2017, so the card concludes
the route does not determine the rate — and tests that conclusion rather than asserting it.

**The coupon count has not only gone up.** 2021 fell 49 below 2020; 2022 fell 343 — and 505 on the
bonus line, a larger fall than the base. A second chart plots both series. Fortress records the falls
and states it does not know the reason. Over fourteen years net income grew 804%, but coupons rose
507.6% while the per-share amount rose only 48.0% — **2.84% a year**. It is shares, not dividend.

The run-rate applies the 2026 rate to today's holding — about S$17,122 net — and is labelled a
run-rate, **not a forecast**. The next dividend has not been declared, so Fortress states no rate and
no date; the reminder notes only that all fifteen payments fell in May, between the 13th and the 30th.

## Cost basis

The portal's Performance-shares detail — **all eight tranches, pages 1–2 of 2** — gives an *adjusted
vesting price* per tranche: the original vesting price restated for every free-share attribution
since. **2,164 shares, €254,463.60 of cost, €363,075.92 of value, €108,612.32 unrealised (+42.7%)**,
a blended €117.59 a share. That is 64.5% of the whole Air Liquide holding, and every line is marked
available, so none of it is blocked.

Each line reconciles **three** ways: quantity × adjusted price plus the stated unrealised gain equals
the stated valuation to the cent; the valuation is exactly the quantity at the live quote; and all
eight lines appear in the account statement with the same quantities — a separately-read document.

**The attributions have cost nothing in basis.** On four of the five tranches with a vesting record,
quantity × adjusted price still equals the original outlay: 27/09/2012 93×€94.70 → 153×€57.55 (0.022%
apart), 26/09/2013 137×€109.70 → 227×€66.20, 29/09/2020 373×€175.40 → 410×€159.57, 29/09/2021
407×€176.30 → 447×€160.52. The count grows by exactly the ratio the price shrinks.

**One tranche does not.** The 25/09/2018 attribution vested as 366 shares at €117.02 — €42,829.32 of
basis. Its adjusted price is now €96.07, which everywhere else implies the count should have grown to
about **446**. The portal shows **324**. That is ~122 shares at today's count, roughly 100 of the
original 366, and **€11,702.64 of cost basis** no longer in the account — about €20,438 at today's
quote. It is the only tranche out by more than €2, so it is not rounding and not a flaw in the method.
Fortress says exactly that and no more: a sale, a transfer out, or a plan adjustment all look
identical from the portal, and it will not guess which. A reminder points out that if it *was* a sale
there should be a contract note, worth locating before it is needed.

A second reminder states the unrealised gain and says plainly that Fortress does **not** know what tax
would fall due on a disposal, in France or Singapore, and does not estimate it.

The loyalty clock is read straight off the value codes: 1,307 shares qualify now, 410 from 2027
(FR001400T5U9), 447 from 2028 (FR0014010OO5) — and those three groups account for every share. The
oldest line, 66 shares from the 15/06/2009 attribution, has no entry in the vesting History loaded so
far; the card says so rather than leaving it silently unchecked.

The shares are counted in net worth and **excluded from every margin calculation** — they are
registered with the company, not pledged to DBS, so they cannot raise a lending value or
answer a margin call. Same treatment as CPF.

## The property reference is the last equivalent transaction

The home is carried at **S$2,450,000** — the price a 915 sqft unit in the same project actually sold for
in **Mar 2026**, the same floor area as his. It holds until a newer sale meeting the same test replaces
it: *same project, same floor area*. Nothing else moves the headline.

**It carries no range, and the card says why:** one sale is one sale. That is a property of the method,
not a claim of precision — a single trade says what one buyer paid for one unit on one day, and knows
nothing of floor, facing or condition. Manufacturing a confidence interval around it would be inventing
precision that the evidence does not contain.

The portal's automated estimate (S$2,390,000, Aug 2026, ±10%) is kept as a **cross-check rather than the
headline**. It reads **−2.4%** against the reference, and the card explains the disagreement instead of
hiding it: an algorithm blending five transactions across two floor areas will land under a same-size
trade when the smaller units fetch a lower psf, which is exactly what they do here.

The five transactions span S$2,523–2,718 psf, which on 915 sqft is S$2,308,486–2,486,869. The card shows
that spread as **what the market shows, explicitly not a confidence interval**.

A form on the Property tab takes the next sale — month, floor area, price. It becomes the reference only
if the area matches and the date is newer; anything else is stored as a comparable and says so rather than
silently moving net worth. A gap tracks the reference's age and escalates to high severity past twelve
months.

### Another dead assertion found

`proptest` had a `hero` pattern matching text that only appears when no property value is set. It had been
printing `false` for weeks inside a `console.log` that could not fail. That block now uses real assertions
and exits non-zero — the same fix `cpfuitest` needed.

## Should the Air Liquide shares move to DBS?

A decision card on the AL tab, computed live from the holding so it stays current as the position grows.

The loyalty bonus is **+10% on dividends and +10% on free-share attributions**, and it requires shares held
in registered form for more than two full calendar years. **Bearer shares do not qualify at all.** A transfer
into a broker's custody normally converts registered shares to bearer, so the question is a permanent
recurring income loss weighed against collateral capacity.

| | Per year |
|---|---|
| Dividend loyalty line | S$1,598 |
| Free-share loyalty (34 shares per attribution) | S$4,210 |
| **Forgone by transferring** | **S$5,809 — 0.70% of the position, every year** |

Over 12 years to 65, with **no growth assumed in price or dividend** — a deliberate floor, not a forecast —
the gap is **S$113,298**: 330 fewer shares and €21,383 less income. It compounds, because the extra free
shares themselves earn dividends and further attributions.

Against that, the collateral gain is worth little to *this* holder: S$672,886 of capacity is already undrawn
at 45.7% utilisation. The card shows advance ratios of 40–70% as a **sensitivity and says so** — Fortress
does not know DBS's ratio for this name and refuses to quote one.

The card's strongest argument is not financial. Pledging employer stock creates a **correlation trap**: a
margin call arrives when markets fall, and Air Liquide falls hardest in the scenarios that also threaten the
salary and the CPF contributions it generates. Unpledged, the shares are ring-fenced — and the card says that
the first half of Fortress's own line *"cannot be seized in a margin call, but cannot help you survive one"*
**is a feature**.

It also refuses to close the question, because one fact decides it and Fortress cannot know it: Air Liquide
allows **nominatif administré** — registered in your name but administered by your own institution — which
would keep the bonus. Whether DBS supports it is unanswered, so the card carries the exact wording to put to
DBS (including whether they would take a *pledge* over shares that stay in nominatif pur, the outcome worth
chasing) and to Air Liquide, plus a high-severity gap recording that a S$5,809/yr question is open.

Two constraints it names rather than glosses: 405 shares are blocked under ESPP lock-ups and cannot move at
all, and **transferring is not required in order to sell** — so trimming the 18.1% concentration is a separate
decision that should not be bundled with this one.

## The year you turn 55 is not a setting

Fortress used to offer a dropdown for "Year you turn 55". It shipped with a stored value of 2030
against a date of birth of 27 Aug 1973, which gives 2028 — so the projection moved the Special Account
closure two years late, and every figure downstream of it was wrong.

The first fix was a warning banner and a one-tap correction. That was treating the symptom. **A value
that is arithmetic on a date you already hold should not be settable at all** — the only thing the
selector could ever do was disagree with your own birthday.

The selector is gone. In its place:

- the derived fact, stated as a **date** rather than a year: *"You turn 55 on 27 Aug 2028 — arithmetic
  on your date of birth, not a setting"*, with the countdown beside it;
- an editable **date of birth**, which is the actual input and previously had no UI at all;
- a note explaining why the dropdown disappeared.

`cpfPlan()` now ignores any stored override outright whenever a date of birth exists, a seed migration
(v11) discards a stale one rather than leaving the user to clear it, and `staleOverride` records that it
did. The selector survives only for a member with no date of birth on file, and says it will vanish once
one is entered.

The gap and the warning banner that policed the mismatch are both deleted — the condition they warned
about can no longer occur.

## One projection, two tabs

The CPF tab and the Retire tab both depend on the age-55 transition. They used to compute it
**separately**, and drifted: the CPF tab honoured a manual year-55 override while the Retire tab always
derived the year from the date of birth, so the two tabs could disagree about the most important date
in the app (2030 vs 2028) without either of them noticing. They also ran the projection with different
contribution settings, producing two "Ordinary Account at 55" figures — S$195,678 and S$267,772 — each
presented as the answer.

`cpfPlan()` is now the single source. It resolves the year 55 falls in (and records **where that came
from**: date of birth, a matching override, or a conflicting one), the contributions switch, and the
horizon — then returns the path, the age-55 event, and the same event computed on the *opposite*
contributions setting so the difference can be named rather than hidden.

The boundary between the tabs is now principled rather than institutional:

- **CPF owns what you have, and every input.** Balances, rates, ledger, housing claim — plus the year-55
  selector, the contributions switch and the horizon. The card says so out loud: *"These settings are the
  app's, not this tab's."*
- **Retire owns what you do about it.** Timeline, the age-55 decision, levers, payouts, SRS. It **reads**
  the plan and offers no projection controls of its own; where a setting matters it names the CPF tab and
  states which setting is currently in force.

Contributions now default to **on** — he is working and contributing S$2,960/month — with the off case
shown on the CPF tab as a stress case (*"switch contributions off and that becomes S$195,678, a S$72,094
swing, which is the size of the assumption you are making about working to 55"*) rather than as a rival
headline. The display horizon and the computed path were also separated: a 5-year horizon still computes
the age-55 event for the Retire tab, and the CPF table says when 55 falls outside the window shown.

`agreetest.js` enforces it. It drives **18 combinations** of contributions × horizon × override and
asserts the two tabs land on identical RA and OA figures every time, that the horizon never hides the
transition, that the contributions switch moves both tabs together, that an override still moves both
while remaining flagged as conflicting with the date of birth, and that the Retire tab contains no
`<select>` or checkbox of its own.

## Retire

A tab built on the Singapore CPF framework, with every rule read from a primary source on
26 Aug 2026 and pinned by tests that fail loudly if CPF moves a number.

**The timeline** runs off CK's own birth date: now, 55, 60, the statutory retirement age, 65, the
re-employment age, 70 — each with the exact date, a countdown, what actually changes, and its source.

**The decision at 55** is the heart of it. The Retirement Account is created, the Special Account
closes, and savings transfer SA-first then OA up to the Full Retirement Sum. Because CK's SA alone
(S$310,602) already exceeds his cohort's FRS, none of his Ordinary Account is touched and the SA
remainder joins it. Two levers follow, and they point in opposite directions:

- **Pledge the property** and set aside only the Basic Retirement Sum. Since the FRS is exactly twice
  the BRS, this frees precisely one BRS more into the OA as cash — and permanently gives up 4% for
  life and the monthly payout on that money.
- **Top up to the Enhanced Retirement Sum** (4× the BRS from 2025), swapping 2.5% for 4%. The card
  states plainly that **this earns no tax relief** — relief on cash top-ups stops at the prevailing
  FRS, and CPF's own worked example shows $0 relief once the FRS is reached. Most write-ups get this
  wrong.

Fortress recommends neither, because the answer turns on health, other income and how much certainty
is worth — none of which it holds.

**What you can do now** tests seven levers against CK's live balances. Five are shut: four because he
has already saved more than the schemes are built for (own-CPF top-up, MediSave VC, the Matched
Retirement Savings Scheme, the Budget 2026 senior top-up) and one because he is not yet 55. Each
"closed" prints the computation that closed it, so it is auditable rather than an opinion, and each
reopens itself if the numbers change. Two remain open: top-ups for loved ones, and **SRS** — where
the penalty-free withdrawal age is fixed at the statutory retirement age *prevailing at the first
contribution* and does not follow later increases. That age rose to 64 on 1 July 2026, so a first
contribution now fixes 64 for life. Fortress does not know whether CK has ever contributed, and says
so rather than assuming either way.

**What Fortress will not tell you** is its own card. It refuses to print a monthly CPF LIFE payout —
that depends on plan, cohort mortality tables and the balance at the time, none of which it holds,
and a wrong figure there would be worse than none. It states that it cannot answer whether he can
afford to retire, because that is income against spending and it measures balance sheets. It warns
that every long-dated figure is nominal. And it states no tax rules at all.

### Payout estimates — derived, and labelled as such

CPF publishes a payout illustration for exactly **one** cohort (turning 55 in 2025, 65 in 2035) on
the **Standard Plan** only: five points from S$60,000 to S$426,000. That is the only payout data
Fortress holds, and it is the only thing it will compute from.

The card interpolates *between* CPF's published points and says which two. Above the highest point it
**extrapolates and says so in red**. Below the lowest it flags the same. On CK's figures:

| Choice | Set aside | Estimated monthly from 65 | Basis |
|---|---|---|---|
| Pledge the property (BRS) | S$114,100 | S$914–986 | interpolated |
| Do nothing (FRS) | S$228,200 | S$1,716–1,844 | interpolated |
| Top up to the ERS | S$456,400 | S$3,313–3,558 | **extrapolated** |

The card also explains *why it cannot simply scale one figure*: CPF's own table pays S$900–950 a month
per S$100,000 at the S$60,000 point but only S$728–782 at the S$426,000 point. The rate per dollar
falls as the sum rises, so a straight-line scaling from any single published figure is wrong.

Every caveat travels with the numbers: CK's cohort is 2028 (not 2025), his cohort's retirement sums
are themselves unpublished, the Basic and Escalating plans are not covered at all, and CPF states
payouts may be adjusted for interest rates and life expectancy. The card ends by pointing at CPF's own
planner and says Fortress will not reproduce its output as if it were its own. A test asserts that a
published point reproduces CPF's figures exactly, that estimates rise monotonically, and that the
per-$100k rate falls with size.

### What an untouched balance earns

Every balance the tab shows now carries the published rate beside it, the yearly and monthly interest,
the ten-year compounded total, and the doubling time. The projected S$267,772 left in the Ordinary
Account is annotated **"earns 2.5% — S$6,694/yr, S$558/mo, if you leave it there"**, followed by a
line stating the cost of withdrawing all of it: S$6,694 a year, S$74,999 over ten. The extra-interest
tiers switch automatically at 55 (+2% on the first S$30,000 and +1% on the next, rather than +1% on
the first S$60,000). Compounding is compounded, not multiplied — the test checks that too.

### SRS — the two days that mattered

CK's DBS SRS account is now in Fortress, and the load-bearing fact is not the balance. It is the date.

His **first contribution was 29 June 2026**. The statutory retirement age rose from **63 to 64 on
1 July 2026** — two days later. Because the SRS penalty-free withdrawal age is fixed at the retirement
age *prevailing on the day of the first contribution* and does not follow later increases, his is
**locked at 63 for life**. Penalty-free from 27 August 2036, with the ten-year window running to 2046.
Anyone opening an account today is locked at 64.

Fortress looks the age up against a dated history rather than assuming the current one, and a test
proves a contribution one day later would have locked 64, and that a date before the recorded history
returns nothing rather than a guess. The card notes that a S$1.00 contribution against a S$15,300 cap
is the known way to start the clock — and then says plainly that it cannot tell whether the timing was
deliberate, because intent is not something a bank statement records.

**A correction, made after CK asked what the window date meant.** Fortress originally printed
"Ten-year withdrawal window ends 27 Aug 2046" as though it were a deadline. It is not. The MOF
booklet is explicit: *"The withdrawal period starts when you make your first withdrawal at or after
the statutory retirement age that was prevailing when you made your first SRS contribution."* The
clock starts on the **first withdrawal**, not on the birthday — draw nothing until 68 and the window
runs 68 to 78. The card now shows 2036→2046 labelled **"earliest case only"** and explains that
treating it as a deadline would push a member into drawing money earlier than they need to. It also
adds the two rules that actually matter at the end of the window: 50% of any remaining balance is
deemed withdrawn and taxed in that year, and money used to buy a life annuity is exempt from the
10-year limit entirely.

It also states the S$15,299 of 2026 allowance still unused and that it does not carry forward, and
then refuses to compute the tax saving: that depends on a marginal rate Fortress does not hold. The
uninvested balance gets a note that is honest about its own irrelevance at S$1.00 and about why it
would stop being irrelevant if the room were used.

### A bug the tests caught

The age-55 split originally computed the $5,000 minimum withdrawal as `min(oaAfter, 5000)` — which
returns nothing when the Ordinary Account is empty. The rule is that the $5,000 is **held back from
the transfer**, not taken from whatever the OA happens to hold. A member with S$50,000 total should
see S$45,000 swept into the RA and S$5,000 left withdrawable; the old code left them S$0. Fixed, with
edge cases for a balance under S$5,000 and a zero balance, plus a conservation check proving the
split neither creates nor destroys money.

## Plain English

A **Plain English** toggle sits in the header and is **on by default**. It does two things.

It puts an *In plain English* card at the top of every tab: a one-line headline and four to six
short points, written the way you would say them out loud — "for every $100 of investments, $21 is
borrowed money", "if you sell, S$X goes back to CPF, not to your bank account". Every figure in it is
live, computed from the same functions the detailed cards use, so the plain version cannot drift away
from the numbers underneath it. Where Fortress does not know something, the plain wording says **Not
known** rather than smoothing over it, and each summary ends by counting the open gaps on that tab.

It also folds each card's explanatory prose — the notes and the warning boxes — into a single
**Show the detail** block per card. The numbers, tables and charts stay visible; the reasoning is one
tap away rather than gone. This runs as a pass over the rendered page, so not one of the ~40 cards
had to be rewritten to support it, and turning the toggle off restores the original view exactly.

The mode is remembered. Existing installs are switched on once by a seed migration that only fires
when the setting is undefined, so a deliberate choice to go back to full detail is never overridden.

## What Fortress doesn't know

Every tab ends with a **What Fortress doesn't know** card listing the real holes in the data it
holds — currently 24 across the eight tabs, ranked with the important ones first. Each entry says
three things: what is missing, **what it stops Fortress saying**, and **how to close it**. They are
collapsed by default and computed live, so an item disappears the moment the missing figure is
entered — the tests prove this by entering a purchase price, watching two gaps vanish, clearing it,
and watching them come back.

The list is deliberately unflattering. It says that Fortress sees what CK owns but not what he earns
or spends, and calls that the biggest question it cannot answer. It says the property valuation is
his own figure rather than a valuation. It says unvested Air Liquide grants are invisible, that cost
basis is known for the performance shares only, and that nothing is known about the tax on a
disposal. It counts the missing months in the statement series by name.

A **What the house cost you** form was added to the Property tab so the purchase-price gap can
actually be closed: purchase price, year bought, and annual running costs. Blank fields stay blank —
nothing is estimated, and the form refuses negative or impossible values rather than storing them.

## Currency: wealth versus collateral

The FX tab now opens with a **Euro exposure** card, because the Air Liquide shares are priced in
euros and the rest of the tab could not see them.

The distinction it draws is the whole point. Only pledged collateral can answer a margin call, so
only pledged collateral belongs in the LTV, the buffer and the stress tables — and on that measure
EUR is 0.78% of the book, a rounding error. But the shares are **40× larger** than the euro sitting at
DBS, so at the wealth level a 10% euro move costs about S$85,000 against S$2,100 of collateral
damage. Both statements are true. Fortress keeps them apart deliberately, and says why: folding
unpledged shares into the collateral figures would flatter borrowing capacity with assets DBS cannot
lend against, which is a worse error than understating the currency.

A second chart shows **wealth by currency**, and unlike the collateral chart its bars sum exactly to
net worth — foreign currencies at their asset value, SGD as the residual carrying the house, CPF and
cash *less every liability*, since every liability is SGD. On that basis non-SGD is **66.8%** of net
worth. The test suite asserts that the LTV, the pledged assets and the pledged EUR figure are all
byte-for-byte unchanged by this addition.

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
