# Fortress v2026:SEP:20-10:47

Service worker cache: `fortress-v2026-09-20a`

## Files that CHANGED — these two are the deploy

| File | Change |
|---|---|
| `index.html` | both changes below |
| `sw.js` | cache name bumped, so the browser replaces the old app |

Everything else in this zip is byte-identical to what is already in the repo.
Re-uploading it is harmless; uploading only the two files above is enough.

## Files that are NEW — not deployed, but worth committing

| File | Purpose |
|---|---|
| `mcsttest.js` | 74 checks on the MCST settlement |
| `nettest.js` | 39 checks on the net-worth ledger |

Run either with `node <file>` (needs `npm install playwright`).
They are not referenced by the app and do not affect the deployed site.
The 40 earlier suites were lost because they were never committed — that is
the reason these two are in the zip.

## Change 1 — MCST statement recorded as settled

Knight Frank confirmed S$2,916.00 received on 03/09/2026, which is the whole
of the 02/09/2026 invoice: the 1 Jun – 31 Aug quarter carried forward plus the
1 Sep – 30 Nov quarter, the latter 27 days before its due date.

- The MCST arrears reminder and the 30 Sep due reminder are retired.
- A new reminder marks 1 Dec 2026 — the next quarter — carrying NO amount,
  because that invoice has not been issued.
- The invoice record is unchanged. The payment is a separate dated fact and
  the balance is derived from the two.
- The paying account is not inferred: the transfer confirmation names only the
  receiving bank, so the app says it cannot tell which account funded it.
- Running costs are unchanged at S$486/month.

Source: email thread "Re: MCST4940 Invoice/Statement #07-04", Knight Frank,
4 Sep 2026 10:32, with the bank transfer confirmation of 3 Sep 2026.

## Change 2 — the DBS drawdown loan is now visible on the Summary card

It was never missing from the totals. DBS reports net assets AFTER the loan:
S$2,842,594.24 of portfolio assets less S$549,252.40 drawn = S$2,293,341.84.
It was invisible only because the home loan had a line of its own and this one
did not.

The ledger now opens with three rows, and carries a Total borrowings line:

| | |
|---|---|
| DBS portfolio assets | S$2,842,594.24 |
| DBS drawdown loan (MRTL at 2.15%, matures 1 Dec 2026) | −S$549,252.40 |
| DBS net assets | S$2,293,341.84 |
| UOB cash | +S$17,702.23 |
| UOB home loan | −S$1,334,490.74 |
| **DBS + UOB net assets** | **S$976,553.33** |
| Total borrowings | −S$1,883,743.14 |

**No total moved.** Everything is still S$4,723,659.66. Deducting the loan a
second time would have understated it by S$549,252.40.

All new rows are conditional on a drawn balance, so a cleared facility leaves
the card exactly as it was.

## Deploying

1. github.com/Surferyogi/fortress → Add file → Upload files
2. Drag in `index.html` and `sw.js` (plus the two test files if you want them
   kept), commit to `main`
3. Open the site and hard-refresh once
4. Footer should read **v2026:SEP:20-10:47**
