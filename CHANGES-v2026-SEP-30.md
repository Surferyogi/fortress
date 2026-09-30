# Fortress v2026:SEP:30-12:59 — the housing refund and the ERS

Cache: `fortress-v2026-09-30a`. Deploy `index.html` and `sw.js`.
Tests: mcst 74, net 40, car 134, cartab 112, **retire 49** — 409 total.

## Two of the three things you asked for already existed

The Retire tab already projected your balances to 55, already forked FRS against
BRS-with-property-pledge, and already sized the ERS lever — all driven by the
CPF tab's settings so the two tabs can't disagree. **I didn't touch any of it.**
Rebuilding working engines would have been duplication, not progress.

## The real gap: the flat's CPF was missing from the ERS lever

`ersFundable` counted only your projected Ordinary Account. The S$502,500 of CPF
principal in the Atelier, and its accrued interest, were nowhere in it.

Now wired in through `cpfClaimOn()` — the same monthly-accrual, annually-
compounded projection the Property tab uses. **The refund reaches S$531,283.41
by your 55th birthday**, up from S$505,640.64 today, because CPF charges itself
2.5% on the money as though it never left.

## And the answer is: you don't need it

| | |
|---|---|
| ERS headroom above the FRS | S$228,200 |
| Your projected OA alone | S$267,772 |
| **Still short** | **S$0** |

**Your Ordinary Account fills the entire ERS headroom on its own, with S$39,571
to spare.** The refund contributes nothing to it.

So the card says that outright — *"you do not need to sell the flat to reach the
Enhanced Retirement Sum"* — and reframes the refund as what it actually is for
you: **liquidity, not retirement income.** If you sold at or after 55 with the
ERS already full, essentially the whole S$531,283 lands in your OA, withdrawable
on demand.

My first draft of this card assumed a gap and had to be rewritten. There is now
a test driving **both** directions: with your real balances it asserts the
no-sell wording and the *absence* of gap wording; with the OA cut down it
asserts the gap wording appears and the no-sell claim disappears.

## One correction to what I told you on 28 September

That answer assumed **no further CPF contributions** and put OA+SA at 55 around
S$417,500.

**You are contributing.** Your own CPF ledger shows S$2,960/month, ten
observations, most recently 13 Aug 2026 for JUL 2026 — and the app has been
using it all along. With contributions the projection is **RA S$228,200 + OA
S$267,772 = S$495,972**, roughly S$78,000 more than I said. The app was right;
my chat answer was conservative for the wrong reason.

## Still not available

The **2028 retirement sums**. CPF has published nothing past 2027, so the app
flags 2028 as unpublished and falls back to the 2027 figures (FRS S$228,200) as
a labelled reference. Every number above moves when CPF announces.
