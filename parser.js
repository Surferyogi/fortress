/* DBS Treasures Private Client statement parser.
 * Works in browser (window.DBSParser) and Node (module.exports).
 * Pure function core: parseLines(pages) where pages = [[line,...],...].
 * Every extracted figure comes verbatim from the statement text — no invented values.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DBSParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NUM = /-?[\d,]+\.\d{2,}/g;
  function toNum(s) {
    if (s === undefined || s === null) return null;
    const n = parseFloat(String(s).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  function nums(line) {
    return (line.match(NUM) || []).map(toNum);
  }
  const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  function isoDate(s) {
    // 31-JUL-2026 or 31/08/2026 or 28/05/2026
    let m = /(\d{1,2})-([A-Z]{3})-(\d{4})/.exec(s);
    if (m) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
    m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // Build lines from pdf.js text items: group by rounded y, sort by x.
  function itemsToLines(items) {
    const rows = new Map();
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // 2pt tolerance
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], str: it.str });
    }
    const ys = [...rows.keys()].sort((a, b) => b - a); // top-down
    return ys.map(y => rows.get(y).sort((a, b) => a.x - b.x).map(o => o.str).join(' ')
      .replace(/\s+/g, ' ').trim());
  }

  function newPortfolio(id) {
    return {
      id, statementDate: null, refCurrency: null,
      totalAssets: null, totalCash: null, totalEquity: null, netAssets: null,
      totalLoans: 0, loans: [],
      ccyAlloc: null,               // {USD: sgdValue, ...} from portfolio summary
      perf: { startMtd: null, startYtd: null, addWithMtd: null, addWithYtd: null, end: null, plMtd: null, plYtd: null, pctMtd: null, pctYtd: null },
      income: { divMtd: null, divYtd: null, intRecMtd: null, intRecYtd: null },
      expenses: { custodyMtd: null, custodyYtd: null, txnMtd: null, txnYtd: null, intPaidMtd: null, intPaidYtd: null },
      leverageFactor: null, leverageThreshold: null, riskRating: null, riskThreshold: null,
      fxForwards: []
    };
  }

  function parseLines(pages) {
    const result = { statementDate: null, portfolios: [], fxRates: {}, warnings: [] };
    let pf = null;
    const byId = {};
    let section = '';
    let ccyHeader = null;      // currency column order on portfolio summary page
    let pendingFwd = null;

    for (const lines of pages) {
      // Portfolio id for this page
      for (const line of lines) {
        const pm = /Portfolio Number:\s*(S-[\d-]+)\b/.exec(line);
        if (pm) {
          const id = pm[1];
          if (!byId[id]) { byId[id] = newPortfolio(id); result.portfolios.push(byId[id]); }
          pf = byId[id];
          const rc = /Reference Currency:\s*([A-Z]{3})/.exec(line);
          if (rc) pf.refCurrency = rc[1];
          break;
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const sd = /Statement as of:\s*(\d{1,2}-[A-Z]{3}-\d{4})/.exec(line);
        if (sd) { const d = isoDate(sd[1]); result.statementDate = d; if (pf) pf.statementDate = d; }

        // Section headers
        if (/Your Portfolio Summary/.test(line)) { section = 'summary'; ccyHeader = null; continue; }
        if (/Your Performance Summary/.test(line)) { section = 'perf'; continue; }
        if (/Your Income and Expense Summary/.test(line)) { section = 'income'; continue; }
        if (/Your Total Asset\b/.test(line)) { section = 'details'; continue; }
        if (/Your Total Loan\b/.test(line)) { section = 'loans'; continue; }
        if (/Your FX Forwards Details/.test(line)) { section = 'fxfwd'; continue; }
        if (/Your Transactional Details/.test(line)) { section = 'txn'; continue; }
        if (/Additional Information/.test(line)) { section = 'addl'; }
        if (/Investment Objectives Setting/.test(line)) { section = 'obj'; }

        if (!pf) continue;

        // Objectives page: leverage + risk
        let m;
        if ((m = /Current Portfolio Risk Rating\s+([\d.]+)/.exec(line))) pf.riskRating = toNum(m[1]);
        if ((m = /Portfolio Risk Rating Threshold[^\d]+([\d.]+)/.exec(line))) pf.riskThreshold = toNum(m[1]);
        if ((m = /Current Leverage Factor\s+([\d.]+)/.exec(line))) pf.leverageFactor = toNum(m[1]);
        if ((m = /Leverage Factor Threshold[^\d]+([\d.]+)/.exec(line))) pf.leverageThreshold = toNum(m[1]);

        if (section === 'summary') {
          // header line: "(SGD equivalent) ... %  %  %" is separate; find ccy header row
          if (/Asset Type/.test(line) || /\(SGD equivalent\)/.test(line)) {
            const ccys = line.match(/\b(USD|SGD|HKD|JPY|EUR|GBP|AUD|CHF|CAD|CNY|CNH|NZD|Others)\b/g);
            if (ccys && ccys.length >= 2) ccyHeader = ccys;
            continue;
          }
          if (ccyHeader && /^Total Asset\b/.test(line)) {
            const v = nums(line);
            // values row: one value per ccy column that has data, then Total (last).
            // Columns with "-" carry no number; safest mapping: if counts match use direct map.
            if (v.length >= 2) {
              pf.totalAssets = v[v.length - 1];
              if (v.length - 1 === ccyHeader.length - (ccyHeader.includes('Others') ? 1 : 0)) {
                const cols = ccyHeader.filter(c => c !== 'Others');
                pf.ccyAlloc = {};
                cols.forEach((c, idx) => { pf.ccyAlloc[c] = v[idx]; });
              } else {
                // fall back: map by tokens with '-' placeholders preserved
                const toks = line.replace(/^Total Asset/, '').trim().split(/\s+/);
                const alloc = {}; let k = 0;
                for (const t of toks) {
                  if (k >= ccyHeader.length) break;
                  if (t === '-') { alloc[ccyHeader[k]] = 0; k++; }
                  else if (NUM.test(t) || /-?[\d,]+\.\d{2}/.test(t)) { alloc[ccyHeader[k]] = toNum(t); k++; }
                  NUM.lastIndex = 0;
                }
                delete alloc.Others;
                if (Object.keys(alloc).length) pf.ccyAlloc = alloc;
              }
            }
            continue;
          }
          if (/^Net Asset\b/.test(line)) {
            const v = nums(line);
            if (v.length) pf.netAssets = v[v.length - 1];
            continue;
          }
          if (/^Loans\b/.test(line)) {
            const v = nums(line);
            if (v.length) pf.totalLoans = v[v.length - 1];
            continue;
          }
        }

        if (section === 'perf') {
          const firstTwo = (re) => { const r = re.exec(line); return r ? nums(line.slice(r.index)).slice(0, 2) : null; };
          let v;
          if ((v = firstTwo(/Profit and Loss/))) { pf.perf.plMtd = v[0]; pf.perf.plYtd = v[1]; }
          else if ((v = firstTwo(/Performance \(%\)/))) { pf.perf.pctMtd = v[0]; pf.perf.pctYtd = v[1]; }
          else if ((v = firstTwo(/Starting Value/))) { pf.perf.startMtd = v[0]; pf.perf.startYtd = v[1]; }
          else if ((v = firstTwo(/Additions and Withdrawals/))) { pf.perf.addWithMtd = v[0]; pf.perf.addWithYtd = v[1]; }
          else if ((v = firstTwo(/Ending Value/))) { pf.perf.end = v[0]; }
        }

        if (section === 'income') {
          const two = (re) => { const r = re.exec(line); return r ? nums(line.slice(r.index + r[0].length)).slice(0, 2) : null; };
          let v;
          if ((v = two(/Cash Dividend Received/)) && v.length === 2) { pf.income.divMtd = v[0]; pf.income.divYtd = v[1]; }
          if ((v = two(/Interest Received/)) && v.length === 2) { pf.income.intRecMtd = v[0]; pf.income.intRecYtd = v[1]; }
          if ((v = two(/Custody Account and Account Fees/)) && v.length === 2) { pf.expenses.custodyMtd = v[0]; pf.expenses.custodyYtd = v[1]; }
          if ((v = two(/Transaction Cost/)) && v.length === 2) { pf.expenses.txnMtd = v[0]; pf.expenses.txnYtd = v[1]; }
          if ((v = two(/Interest Paid/)) && v.length === 2) { pf.expenses.intPaidMtd = v[0]; pf.expenses.intPaidYtd = v[1]; }
        }

        if (section === 'details') {
          if (/^Total Asset\b/.test(line)) { const v = nums(line); if (v.length >= 2 && pf.totalAssets === null) pf.totalAssets = v[v.length - 2]; }
          if (/^Total Cash and Cash Investments\b/.test(line)) { const v = nums(line); if (v.length) pf.totalCash = v[v.length - 2] !== undefined && v.length >= 2 ? v[v.length - 2] : v[0]; }
          if (/^Total Investment Portfolio\b/.test(line)) { const v = nums(line); if (v.length >= 2) pf.totalEquity = v[v.length - 2]; }
        }

        if (section === 'loans') {
          if (/^Total Loans\b/.test(line)) { const v = nums(line); if (v.length >= 2) pf.totalLoans = v[v.length - 2]; continue; }
          // e.g. "SGD -565,472.93 MRTL SGD, 2.10%, 28/05/2026-31/08/2026 (12423561) 28-MAY-2026 31-AUG-2026 2.10 -2,082.18 -565,472.93 -100.00"
          m = /^([A-Z]{3})\s+(-[\d,]+\.\d{2})\s+(.*?(MRTL|LOAN|Loan).*)$/.exec(line);
          if (m) {
            const rest = m[3];
            const rate = (/([\d.]+)%/.exec(rest) || [])[1];
            const dates = rest.match(/\d{1,2}-[A-Z]{3}-\d{4}/g) || [];
            const period = /(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})/.exec(rest);
            const tail = nums(rest);
            // tail typically: [rate, accrInt, valueSGD, -100.00]; identify accrued & value
            let accrInt = null, valueSGD = null;
            if (tail.length >= 3) { valueSGD = tail[tail.length - 2]; accrInt = tail[tail.length - 3]; }
            pf.loans.push({
              ccy: m[1], principal: toNum(m[2]),
              description: rest.split(/\s{2,}| \d{2}-[A-Z]{3}-\d{4}/)[0].trim(),
              ratePct: toNum(rate),
              startDate: dates[0] ? isoDate(dates[0]) : (period ? isoDate(period[1]) : null),
              maturityDate: dates[1] ? isoDate(dates[1]) : (period ? isoDate(period[2]) : null),
              accrIntSGD: accrInt, valueSGD: valueSGD
            });
          }
        }

        if (section === 'fxfwd') {
          m = /^Buy\s+([A-Z]{3})\s+(-?[\d,]+\.\d{2})\s+FX Forward\s*-\s*([A-Z]{3})\/([A-Z]{3}),\s*([\d.]+),\s*(\d{2}\/\d{2}\/\d{4})/.exec(line);
          if (m) {
            const v = nums(line);
            pendingFwd = {
              buyCcy: m[1], buyAmt: toNum(m[2]), pair: `${m[3]}/${m[4]}`,
              contractRate: toNum(m[5]), maturityDate: isoDate(m[6]),
              sellCcy: null, sellAmt: null,
              mtmSGD: v.length ? v[v.length - 1] : null
            };
            pf.fxForwards.push(pendingFwd);
            continue;
          }
          m = /^Sell\s+([A-Z]{3})\s+(-?[\d,]+\.\d{2})/.exec(line);
          if (m && pendingFwd) { pendingFwd.sellCcy = m[1]; pendingFwd.sellAmt = toNum(m[2]); pendingFwd = null; }
        }

        if (section === 'addl') {
          m = /^1\s+([A-Z]{3})\s*=\s*([\d.]+)\s+SGD/.exec(line);
          if (m) result.fxRates[m[1]] = toNum(m[2]);          // 1 CCY = x SGD
          m = /^1\s+SGD\s*=\s*([\d.]+)\s+([A-Z]{3})/.exec(line);
          if (m) result.fxRates[m[2]] = 1 / toNum(m[1]);      // invert
        }
      }
    }

    // sanity warnings — never silently accept inconsistent parses
    for (const p of result.portfolios) {
      if (p.totalAssets === null) result.warnings.push(`${p.id}: total assets not found`);
      if (p.netAssets === null && p.totalAssets !== null) p.netAssets = +(p.totalAssets + (p.totalLoans || 0)).toFixed(2);
      if (p.totalAssets !== null && p.netAssets !== null) {
        const chk = p.totalAssets + (p.totalLoans || 0);
        if (Math.abs(chk - p.netAssets) > 1) result.warnings.push(`${p.id}: assets ${p.totalAssets} + loans ${p.totalLoans} != net ${p.netAssets}`);
      }
    }
    if (!result.statementDate) result.warnings.push('statement date not found');
    return result;
  }

  return { parseLines, itemsToLines, toNum, isoDate };
});
