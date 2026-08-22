/* Fortress — text recognizers for non-DBS-statement sources.
 * Every recognizer returns { kind, fields:{...}, confidence, warnings:[], raw }
 * NOTHING here writes to state. The UI always shows an editable review first.
 * Works in browser (window.FortressRecognizers) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FortressRecognizers = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  /* ---------- primitives ---------- */
  function norm(text) {
    return String(text || '')
      .replace(/ /g, ' ')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\r/g, '')
      // OCR often splits thousands groups: "5, 546.93" is one number, not two
      .replace(/(\d),[ \t]+(?=\d{3}(?:\D|$))/g, '$1,');
  }
  // "1,334,490.74" | "1,334,490.<sup>74</sup>" (OCR of UOB's small-cents style) | "1.130200000"
  function toNum(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    if (!t || t === '-' || t === '.') return null;
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  const NUMRE = /-?\d[\d,]*(?:\.\d+)?/g;
  // first number that appears after `label`, searching at most `span` chars ahead
  function after(text, label, span) {
    span = span || 120;
    const i = text.toLowerCase().indexOf(String(label).toLowerCase());
    if (i < 0) return null;
    const win = text.slice(i + String(label).length, i + String(label).length + span);
    const m = win.match(NUMRE);
    return m ? toNum(m[0]) : null;
  }
  function has(text, s) { return text.toLowerCase().includes(String(s).toLowerCase()); }
  // "31 Jul 2026" / "31-JUL-2026" / "01 Sep 2026"
  function dmy(text, label, span) {
    span = span || 140;
    let win = text;
    if (label) {
      const i = text.toLowerCase().indexOf(String(label).toLowerCase());
      if (i < 0) return null;
      win = text.slice(i, i + span);
    }
    const m = win.match(/(\d{1,2})[\s\-]([A-Za-z]{3})[a-z]*[\s\-](\d{4})/);
    if (!m) return null;
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
  }
  const ym = iso => (iso ? iso.slice(0, 7) : null);
  // "04/08/2026" or "4-8-2026" -> ISO. Singapore convention is day-first.
  function numericDate(text, label, span) {
    span = span || 90;
    let win = text;
    if (label) {
      const i = text.toLowerCase().indexOf(String(label).toLowerCase());
      if (i < 0) return null;
      win = text.slice(i + String(label).length, i + String(label).length + span);
    }
    const m = win.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/);
    if (!m) return null;
    const d = +m[1], mo = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  // a percentage that follows a label, e.g. "Revised interest rate : 1.13020%"
  function pctAfter(text, label, span) {
    span = span || 80;
    const i = text.toLowerCase().indexOf(String(label).toLowerCase());
    if (i < 0) return null;
    const win = text.slice(i + String(label).length, i + String(label).length + span);
    const m = win.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) : null;
  }

  /* ---------- 1. UOB Statement of Account (PDF text) ---------- */
  function uobStatement(text) {
    const warnings = [];
    const stmtDate = dmy(text, 'Portfolio Overview as at') || dmy(text, 'Period:');
    const deposits = after(text, 'Deposits', 60);
    const loans = after(text, 'Loans (Total Outstanding Loan Amount)', 80);
    const grand = after(text, 'Total Outstanding Balance (SGD)', 80);

    // rent-style credits in the transaction table
    const rents = [];
    const lines = text.split('\n');
    lines.forEach((ln, i) => {
      if (/inward\s*cr\s*-\s*giro/i.test(ln)) {
        const dateM = ln.match(/^\s*(\d{1,2})\s+([A-Za-z]{3})/);
        // amount lives on the GIRO row itself; drop the leading "11 Jun" before looking
        const row = ln.replace(/^\s*\d{1,2}\s+[A-Za-z]{3}\s*/, '');
        const money = row.match(/\d[\d,]*\.\d{2}\b/g) || [];   // must have cents — day numbers can't match
        const amt = money.length ? toNum(money[0]) : null;
        const detail = lines.slice(i + 1, i + 6);               // payer / reference sit on the rows beneath
        const nameLine = detail.find(l => /^[A-Z][A-Z\s.'-]{6,}$/.test(l.trim()));
        const refLine = detail.map(l => (l.match(/\bSI\s+(.{2,40})/) || [])[1]).find(Boolean);
        const nameM = nameLine ? [null, nameLine] : null;
        const refM = refLine ? [null, refLine.replace(/\s+Total\b.*$/i, '')] : null;
        rents.push({
          amount: amt,
          payer: nameM ? nameM[1].trim() : null,
          reference: refM ? refM[1].trim() : null,
          day: dateM ? +dateM[1] : null,
          month: dateM && MONTHS[dateM[2].toLowerCase()] ? MONTHS[dateM[2].toLowerCase()] : null
        });
      }
    });

    if (loans === null) warnings.push('No "Loans (Total Outstanding Loan Amount)" line found.');
    if (deposits === null) warnings.push('No deposits total found.');

    return {
      kind: 'uobStatement',
      fields: {
        month: ym(stmtDate),
        statementDate: stmtDate,
        deposits: deposits,
        mortgageBalance: loans !== null ? loans : grand,
        rentCredits: rents
      },
      warnings, confidence: (loans !== null ? 0.6 : 0) + (stmtDate ? 0.3 : 0) + (deposits !== null ? 0.1 : 0)
    };
  }

  /* ---------- 2. UOB Home Loan detail screen (screenshot OCR / paste) ---------- */
  function uobLoanScreen(text) {
    const warnings = [];
    const bal = after(text, 'OUTSTANDING BALANCE', 60);
    const rate = after(text, 'INTEREST RATE', 60);
    const pay = after(text, 'MONTHLY REPAYMENT AMOUNT', 60);
    const orig = after(text, 'ORIGINAL LOAN AMOUNT', 60);
    const term = after(text, 'LOAN TERM', 40);
    const next = dmy(text, 'NEXT REPAYMENT DATE', 60);
    const last = dmy(text, 'LAST REPAYMENT DATE', 60);
    const acctM = text.match(/Housing Loan\s+([\d\-]{8,})/i) || text.match(/(\d{3}-\d{3}-\d{3}-\d)/);

    if (bal === null) warnings.push('Outstanding balance not found — type it in below.');
    if (rate !== null && rate > 20) warnings.push('Interest rate looks wrong (' + rate + '%) — check the OCR.');

    return {
      kind: 'uobLoanScreen',
      fields: {
        month: ym(last) || null,           // balance shown is after the last repayment
        mortgageBalance: bal,
        mortgageRatePct: rate,
        mortgagePayment: pay,
        original: orig,
        tenorMonths: term,
        nextDue: next,
        lastPaid: last,
        account: acctM ? acctM[1] : null
      },
      warnings, confidence: (bal !== null ? 0.6 : 0) + (pay !== null ? 0.2 : 0) + (rate !== null ? 0.2 : 0)
    };
  }

  /* ---------- 3. DBS MRTL draw-down screen (screenshot OCR / paste) ---------- */
  function dbsMrtl(text) {
    const warnings = [];
    const bp = after(text, 'borrowing potential', 60);
    const limit = after(text, 'credit limit', 60);
    const drawn = after(text, 'Amount drawn', 60);
    const avail = after(text, 'Available for drawdown', 60);

    if (bp === null) warnings.push('Borrowing potential not found.');
    if (drawn === null) warnings.push('Amount drawn not found.');
    if (bp !== null && drawn !== null && avail !== null) {
      const implied = bp - drawn;
      if (Math.abs(implied - avail) > 1) {
        warnings.push('Borrowing potential and available-for-drawdown measure different things — ' +
          'the first is asset-based and subject to credit approval, the second is what is drawable ' +
          'inside the already-approved facility. Fortress uses whichever implies the smaller capacity.');
      }
    }
    return {
      kind: 'dbsMrtl',
      fields: { borrowingPotential: bp, creditLimit: limit, amountDrawn: drawn, availableForDrawdown: avail },
      warnings, confidence: (bp !== null ? 0.5 : 0) + (drawn !== null ? 0.3 : 0) + (limit !== null ? 0.2 : 0)
    };
  }

  /* ---------- 3b. DBS Portfolio Summary screen (supersedes the bare MRTL panel) ---------- */
  function dbsPortfolioSummary(text) {
    const warnings = [];
    const bp = after(text, 'borrowing potential', 90);   // label may be "…(indicative)"
    const limit = after(text, 'Approved MRTL credit limit', 60);
    const drawn = after(text, 'Amount drawn', 60);
    const avail = after(text, 'Available for drawdown', 60);
    const assets = after(text, 'Total assets', 60);
    const loansRaw = after(text, 'Total loans', 60);
    const derivs = after(text, 'Total derivatives', 60);
    const netAssets = after(text, 'Total net assets', 60);
    const pr = after(text, 'Portfolio Risk Rating', 40);
    const prT = after(text, 'Threshold', 30);
    const lf = after(text, 'Leverage Factor', 40);
    const loans = loansRaw === null ? null : Math.abs(loansRaw);

    if (assets === null) warnings.push('Total assets not found — the lending value cannot be derived without it.');
    if (bp === null) warnings.push('Borrowing potential not found.');
    if (bp !== null && assets !== null && assets > 0) {
      const lv = bp / assets * 100;
      if (lv > 100) warnings.push('Derived lending value is above 100% (' + lv.toFixed(1) + '%) — check the OCR.');
    }
    return {
      kind: 'dbsPortfolioSummary',
      fields: {
        totalAssets: assets, totalLoans: loans, totalDerivatives: derivs, netAssets: netAssets,
        borrowingPotential: bp, creditLimit: limit, amountDrawn: drawn, availableForDrawdown: avail,
        riskRating: pr, riskThreshold: prT, leverageFactor: lf,
        lendingValuePct: (bp !== null && assets) ? bp / assets * 100 : null,
        hasFacility: drawn !== null || limit !== null
      },
      warnings,
      confidence: (assets !== null ? 0.4 : 0) + (bp !== null ? 0.4 : 0) + (lf !== null ? 0.2 : 0)
    };
  }

  /* ---------- 3c. DBS app "Performance summary" (TWRR / MWRR over a picked range) ---------- */
  function dbsPerformance(text) {
    const warnings = [];
    // which toggle is active can't be read from text alone; take whichever label the % follows
    const pctM = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
    const pctVal = pctM ? parseFloat(pctM[1]) : null;
    const hasT = /\bTWRR\b/i.test(text), hasM = /\bMWRR\b/i.test(text);   // both labels sit on screen; the toggle decides
    // "18 Aug 2025-18 Aug 2026" / "18 Aug 2025 - 18 Aug 2026"
    const rangeM = text.match(/(\d{1,2}\s+[A-Za-z]{3}[a-z]*\s+\d{4})\s*[-–]\s*(\d{1,2}\s+[A-Za-z]{3}[a-z]*\s+\d{4})/);
    const from = rangeM ? dmy(rangeM[1]) : null;
    const to = rangeM ? dmy(rangeM[2]) : null;
    const pidM = text.match(/(S-\d{6}-\d)/);

    if (pctVal === null) warnings.push('No percentage found.');
    if (!from || !to) warnings.push('No date range found — enter the period by hand; a return without its window is not usable.');
    if (hasT && hasM) warnings.push('Both toggles are visible on that screen. Fortress records TWRR — confirm that was the one selected when you took the reading.');

    return {
      kind: 'dbsPerformance',
      fields: {
        metric: 'TWRR',
        metricAmbiguous: hasT && hasM,
        pct: pctVal, from, to, portfolioId: pidM ? pidM[1] : null
      },
      warnings,
      confidence: (pctVal !== null ? 0.4 : 0) + (from && to ? 0.4 : 0) + (hasT || hasM ? 0.2 : 0)
    };
  }

  /* ---------- 3d. UOB "Update to your loan" — floating-rate revision letter ---------- */
  function uobRateChange(text) {
    const warnings = [];
    // "revised from 1.02980% to 1.13020% per annum ... with effect from 04/08/2026"
    const pair = text.match(/revised\s+from\s+(\d{1,2}(?:\.\d+)?)\s*%\s*to\s+(\d{1,2}(?:\.\d+)?)\s*%/i);
    const effM = text.match(/with\s+effect\s+from\s+(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{4})/i);
    // labelled fields first; the prose sentence is the fallback when OCR loses the table
    const newRate = pctAfter(text, 'Revised interest rate', 90) ?? (pair ? parseFloat(pair[2]) : null);
    const rateFrom = numericDate(text, 'Effective date of revised interest rate', 90) ||
                     (effM ? numericDate(effM[1], null) : null);
    const instal = after(text, 'Revised instalment amount', 70);
    const instalFrom = numericDate(text, 'Effective date of revised instalment', 90);
    const prevRate = pair ? parseFloat(pair[1]) : null;
    const acctM = text.match(/LN\s*Account\s*:?\s*([\d\-]{6,})/i);
    const letterDate = numericDate(text, 'Date', 60);

    if (newRate === null) warnings.push('Revised interest rate not found.');
    if (instal === null) warnings.push('Revised instalment amount not found.');
    if (newRate !== null && newRate > 20) warnings.push('Rate of ' + newRate + '% looks wrong — check the OCR.');
    if (instal !== null && instal < 100) warnings.push('Instalment of ' + instal + ' looks wrong — check the OCR.');
    if (prevRate !== null && newRate !== null) {
      const d = newRate - prevRate;
      warnings.push('Rate ' + (d >= 0 ? 'rises' : 'falls') + ' ' + Math.abs(d).toFixed(5) +
        ' points, from ' + prevRate + '% to ' + newRate + '%.');
    }
    return {
      kind: 'uobRateChange',
      fields: {
        mortgageRatePct: newRate, previousRatePct: prevRate, rateEffective: rateFrom,
        mortgagePayment: instal, instalmentEffective: instalFrom,
        account: acctM ? acctM[1] : null, letterDate,
        month: ym(instalFrom) || ym(rateFrom) || null
      },
      warnings,
      confidence: (newRate !== null ? 0.4 : 0) + (instal !== null ? 0.4 : 0) + (instalFrom ? 0.2 : 0)
    };
  }

  /* ---------- 4. generic: any text with money in it ---------- */
  function generic(text) {
    const hits = [];
    text.split('\n').forEach(ln => {
      const m = ln.match(/-?\d[\d,]*\.\d{2}\b/g);
      if (m) hits.push({ line: ln.trim().slice(0, 90), values: m.map(toNum) });
    });
    return { kind: 'generic', fields: { candidates: hits.slice(0, 40) }, warnings: [], confidence: 0.1 };
  }

  /* ---------- router ---------- */
  function detect(rawText) {
    const text = norm(rawText);
    const scored = [];
    if (has(text, 'Update to your loan') || has(text, 'Revised interest rate') ||
        (has(text, 'Revised instalment') && has(text, 'benchmark')) ||
        /revised\s+from\s+[\d.]+\s*%\s*to\s+[\d.]+\s*%/i.test(text) ||
        (has(text, 'benchmark cost of funds') && has(text, 'interest rate'))) scored.push(uobRateChange(text));
    if ((has(text,'TWRR')||has(text,'MWRR')) && has(text,'Performance')) scored.push(dbsPerformance(text));
    if (has(text, 'borrowing potential') && (has(text, 'Total assets') || has(text, 'Leverage Factor'))) scored.push(dbsPortfolioSummary(text));
    if (has(text, 'MRTL') && (has(text, 'borrowing potential') || has(text, 'Amount drawn'))) scored.push(dbsMrtl(text));
    if (/OUTSTANDING BALANCE/i.test(text) && /(MONTHLY REPAYMENT|LOAN TERM|Housing Loan)/i.test(text)) scored.push(uobLoanScreen(text));
    if (has(text, 'Portfolio Overview') || has(text, 'Total Outstanding Balance') ||
        (has(text, 'United Overseas Bank') && has(text, 'Statement of Account'))) scored.push(uobStatement(text));
    scored.sort((a, b) => b.confidence - a.confidence);
    const best = scored[0] || generic(text);
    best.raw = text;
    best.alternatives = scored.slice(1).map(s => s.kind);
    return best;
  }

  return { detect, uobStatement, uobLoanScreen, uobRateChange, dbsMrtl, dbsPortfolioSummary, dbsPerformance, generic, toNum, norm, after, dmy };
}));
