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
