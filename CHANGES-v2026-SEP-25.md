# Fortress v2026:SEP:25-14:06

Service worker cache: `fortress-v2026-09-25a`

## Deploy these two

| File | Change |
|---|---|
| `index.html` | the car purchase, below |
| `sw.js` | cache name bumped so the browser replaces the old app |

Everything else in this zip is byte-identical to what is already in the repo.

## Also worth committing — not deployed

| File | Checks |
|---|---|
| `mcsttest.js` | 74 |
| `nettest.js` | 40 |
| `cartest.js` | 73 (new) |

Run with `node <file>` after `npm install playwright`.

## The car: BYD Seal 6 Premium

Sources: Vehicle Sales Agreement **VSA 1054052** dated 07/09/2026 (E-AUTO, a
division of Vantage Automotive Limited) and the **eVSA 1054052 invoice** dated
24/09/2026. They agree to the cent; Fortress re-runs the arithmetic rather
than trusting it.

| | |
|---|---|
| Retail price | S$246,888.00 |
| Less discount | −S$67,500.00 (27.3%) |
| Options (S$4,000 listed, S$4,000 discounted) | nil |
| **Nett price** | **S$179,388.00** |
| Deposit — paid | −S$16,350.00 |
| Loan — "Bank Financing" | −S$105,000.00 |
| **Balance due before registration** | **S$58,038.00** |

Delivery estimated 30 Sep 2026. Price includes road tax (12 months plus 6 on
the 95kW option), number plates, registration fees and the COE (4 guaranteed
bids against a S$123,000 rebate sum). Excludes insurance premiums.

## How it enters net worth

Three lines, which net to S$16,350 — exactly the deposit already paid:

```
cost 179,388  −  loan 105,000  −  still owed 58,038  =  16,350
```

That is the identity of a part-paid purchase at cost, and the app asserts it.
**Everything moves by S$16,350, not by S$179,388 and not by −S$105,000.**
Total borrowings now counts all three facilities: DBS S$549,252.40 + UOB
S$1,334,490.74 + car S$105,000.00 = S$1,988,743.14.

Two caveats the card states rather than silently adjusting:

1. **"At cost" is not a valuation.** Fortress has no market value for this car
   and does not estimate one.
2. **The deposit left the bank after the 31 Aug statement being read.** If it
   came from a tracked account, the totals run S$16,350 ahead of your real
   balance until the next statement is imported. Fortress does not know which
   account paid it and will not adjust a balance it has not observed.

## NOT AVAILABLE — left blank, not guessed

**The loan terms.** The invoice says only "Bank Financing". The sales
agreement's *Hire Purchase Amount* and *Finance Company* fields are both
blank. So the lender, interest rate, tenor and monthly instalment are all
unknown, and **no instalment is modelled anywhere in the app**. This is the
largest gap in your position — send the hire-purchase agreement and the
instalment, interest and maturity all follow.

**The insurance premium.** The Liberty Pte Limited proposal form is unsigned
and unpriced: premium, period of insurance, NCD and vehicle registration
number are all blank. At least one year must be bought through the dealer
(Liberty, MSIG or Etiqa). The S$3,000 subsidy is *already netted to zero
inside the package price* — a discount you have had, not a credit against the
insurer's bill. The premium is a real cost sitting outside every total.

**Registration.** No registration number, no registration date, no confirmed
COE premium.

## A claim that was drafted and then removed

An earlier draft said Singapore car financing is quoted as a flat rate roughly
double the equivalent effective rate. The MAS primary source returned HTTP 403
and the secondary sources were not good enough to put in a financial app, so
the claim was cut. The card now states only what your own documents support —
that you borrowed 58.5% of the price — and says explicitly that whether a rule
capped that is not on either document.

## Kept off this public page

The NRIC on both documents, the engine and chassis numbers, the home address,
the mobile number, and the dealer's bank account details from the invoice.
Family is referred to by relationship, never by name. All seven are asserted
by `cartest.js` and the build fails if any appears.

## Deploying

1. github.com/Surferyogi/fortress → Add file → Upload files
2. Drag in `index.html` and `sw.js` (plus the three test files)
3. Commit to `main`, open the site, hard-refresh once
4. Footer should read **v2026:SEP:25-14:06**
