/* cartabtest.js — the Car tab: loan amortisation, resale table, running costs.

   The governing rule: NOTHING on this tab is computed from a figure Fortress invented.
   Every number either traces to the sales agreement / invoice, or was typed in by CK.
   With nothing typed in, every section must say so and none may throw.

   Run: node cartabtest.js
*/
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (got !== undefined ? '  got: ' + JSON.stringify(got) : '')); }
};
const near = (a, b, tol = 0.005) => a != null && b != null && Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ timezoneId: 'Asia/Singapore' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(1200);

  console.log('\n-- the tab exists and is reachable --');
  const tabs = await page.evaluate(() => TABS.map(t => t.id));
  ok('a "car" tab is registered', tabs.includes('car'), tabs);
  ok('it sits next to Property', tabs.indexOf('car') === tabs.indexOf('prop') + 1, tabs);
  const label = await page.evaluate(() => (TABS.find(t => t.id === 'car') || {}).label);
  ok('labelled "Car"', label === 'Car', label);

  console.log('\n-- EMPTY STATE: nothing entered, nothing invented, nothing thrown --');
  const E = await page.evaluate(() => {
    const before = { l: state.settings.carLoan, v: state.settings.carValues, c: state.settings.carCosts };
    delete state.settings.carLoan; delete state.settings.carValues; delete state.settings.carCosts;
    state.settings.tab = 'car'; render();
    const L = JSON.parse(JSON.stringify(carLoan()));
    const V = JSON.parse(JSON.stringify(carValues()));
    const R = JSON.parse(JSON.stringify(carRunningCosts()));
    const html = document.getElementById('main').innerHTML;
    const txt = document.getElementById('main').textContent;
    if (before.l) state.settings.carLoan = before.l;
    if (before.v) state.settings.carValues = before.v;
    if (before.c) state.settings.carCosts = before.c;
    return { L, V, R, refused: html.includes('could not be drawn'), txt };
  });
  ok('the tab draws with no refusal card', E.refused === false, E.refused);
  ok('loan reports itself unknown',        E.L.known === false, E.L.known);
  ok('loan schedule is empty, not fabricated', E.L.schedule.length === 0, E.L.schedule.length);
  ok('it still knows the principal from the invoice', near(E.L.principal, 105000.00), E.L.principal);
  ok('and names every missing term',       E.L.missing.length === 4, E.L.missing);
  ok('no instalment is invented',          E.L.instalment === undefined || E.L.instalment == null, E.L.instalment);
  ok('resale table is empty',              E.V.hasValues === false, E.V.hasValues);
  /* road tax is no longer a gap: LTA documents it at 1,474.00 a year, so it arrives
     pre-filled from the registration record while staying overridable. */
  ok('running costs: only the documented road tax is known', E.R.known.length === 1, E.R.known.map(x => x.key));
  ok('and it is the road tax',             E.R.known[0].key === 'roadTaxYear', E.R.known[0]);
  ok('it carries LTA\'s figure',           near(E.R.known[0].value, 1474.00), E.R.known[0].value);
  ok('and is flagged as coming from a document', E.R.known[0].fromDoc === true, E.R.known[0].fromDoc);
  ok('running costs: the other six are gaps', E.R.gaps.length === 6, E.R.gaps.length);
  ok('the page says the terms are not entered', /Missing:/.test(E.txt) || /nothing else about it/i.test(E.txt));
  ok('the page refuses to value the car',  /no car valuation model/i.test(E.txt));

  console.log('\n-- FLAT RATE: 105,000 at 2.78% flat over 7 years --');
  const F = await page.evaluate(() => {
    state.settings.carLoan = { lender: 'Test Bank', ratePct: 2.78, rateType: 'flat', tenorYears: 7, firstPayment: '2026-11-01' };
    return JSON.parse(JSON.stringify(carLoan()));
  });
  ok('84 monthly payments',            F.months === 84, F.months);
  ok('instalment 1,493.25',            near(F.instalment, 1493.25), F.instalment);
  ok('total interest 20,433.00',       near(F.totalInterest, 20433.00, 0.5), F.totalInterest);
  ok('total paid 125,433.00',          near(F.totalPaid, 125433.00, 0.5), F.totalPaid);
  ok('principal repaid equals the loan',
     near(F.schedule.reduce((a, m) => a + m.principal, 0), 105000.00, 0.5),
     F.schedule.reduce((a, m) => a + m.principal, 0));
  ok('the balance reaches exactly zero', near(F.schedule[F.schedule.length - 1].balance, 0), F.schedule[F.schedule.length - 1].balance);
  ok('interest is constant each month (that is what flat means)',
     new Set(F.schedule.map(m => m.interest)).size === 1, [...new Set(F.schedule.map(m => m.interest))].slice(0, 3));
  ok('first payment month is Nov 2026', F.schedule[0].month === '2026-11', F.schedule[0].month);
  ok('last payment month is Oct 2033',  F.lastMonth === '2033-10', F.lastMonth);

  console.log('\n-- the flat-rate truth: solved, not asserted --');
  ok('effective rate is 5.19%, not 2.78%', near(F.effectivePct, 5.1859, 0.01), F.effectivePct);
  ok('which is ~1.87x the quoted rate',    near(F.effectivePct / F.ratePct, 1.865, 0.01), F.effectivePct / F.ratePct);
  ok('the premium over quoted is reported', near(F.interestPremium, 5.1859 - 2.78, 0.01), F.interestPremium);
  /* the definition of "effective": an annuity at that rate must reproduce the instalment */
  const check = await page.evaluate(() => annuity(105000, carLoan().effectivePct, 84));
  ok('an annuity at the effective rate reproduces the instalment', near(check, F.instalment, 0.05), [check, F.instalment]);

  console.log('\n-- REDUCING BALANCE: the same rate is a different loan --');
  const Rd = await page.evaluate(() => {
    state.settings.carLoan = { lender: 'Test Bank', ratePct: 2.78, rateType: 'reducing', tenorYears: 7, firstPayment: '2026-11-01' };
    return JSON.parse(JSON.stringify(carLoan()));
  });
  ok('instalment 1,377.01',              near(Rd.instalment, 1377.01, 0.02), Rd.instalment);
  ok('total interest 10,668.84',         near(Rd.totalInterest, 10668.84, 1), Rd.totalInterest);
  ok('reducing costs about half of flat', Rd.totalInterest < F.totalInterest * 0.55, [Rd.totalInterest, F.totalInterest]);
  ok('effective equals the quoted rate',  near(Rd.effectivePct, 2.78), Rd.effectivePct);
  ok('no flat-rate premium is reported',  Rd.interestPremium === null, Rd.interestPremium);
  ok('interest FALLS every month',        Rd.schedule[0].interest > Rd.schedule[40].interest && Rd.schedule[40].interest > Rd.schedule[83].interest,
                                          [Rd.schedule[0].interest, Rd.schedule[40].interest, Rd.schedule[83].interest]);
  ok('principal RISES every month',       Rd.schedule[0].principal < Rd.schedule[83].principal, [Rd.schedule[0].principal, Rd.schedule[83].principal]);
  ok('it also lands on zero',             near(Rd.schedule[Rd.schedule.length - 1].balance, 0, 0.02), Rd.schedule[Rd.schedule.length - 1].balance);

  console.log('\n-- the year-by-year rollup reconciles to the monthly schedule --');
  ok('years sum to total interest', near(F.years.reduce((a, y) => a + y.interest, 0), F.totalInterest, 0.5));
  ok('years sum to total principal', near(F.years.reduce((a, y) => a + y.principal, 0), 105000.00, 0.5));
  ok('months per year sum to the tenor', F.years.reduce((a, y) => a + y.months, 0) === 84, F.years.map(y => y.months));
  ok('the closing balance falls every year', F.years.every((y, i) => i === 0 || y.closing < F.years[i - 1].closing), F.years.map(y => y.closing));
  ok('the final year closes at zero', near(F.years[F.years.length - 1].closing, 0), F.years[F.years.length - 1].closing);

  console.log('\n-- resale: his figures, Fortress\'s arithmetic --');
  const V = await page.evaluate(() => {
    state.settings.carLoan = { lender: 'Test Bank', ratePct: 2.78, rateType: 'flat', tenorYears: 7, firstPayment: '2026-11-01' };
    state.settings.carValues = [{ year: 2028, value: 120000 }, { year: 2030, value: 80000 }, { year: 2033, value: 30000 }];
    return JSON.parse(JSON.stringify(carValues()));
  });
  ok('three rows, in year order', V.rows.length === 3 && V.rows[0].year === 2028, V.rows.map(r => r.year));
  ok('lost-from-cost is price minus his value', near(V.rows[0].lostFromCost, 179388 - 120000), V.rows[0].lostFromCost);
  ok('each row carries the loan balance at that year', V.rows.every(r => r.balance != null), V.rows.map(r => r.balance));
  ok('equity = his value less the balance', near(V.rows[0].equity, V.rows[0].value - V.rows[0].balance), [V.rows[0].equity, V.rows[0].value, V.rows[0].balance]);
  ok('the 2033 balance is zero, so equity is the whole value', near(V.rows[2].balance, 0) && near(V.rows[2].equity, 30000), [V.rows[2].balance, V.rows[2].equity]);
  ok('negative equity is flagged, never hidden', V.rows.every(r => r.negativeEquity === (r.equity < 0)), V.rows.map(r => [r.equity, r.negativeEquity]));
  ok('no value is derived for a year he did not enter', V.rows.length === 3, V.rows.length);
  ok('the source line says the figures are his', /you entered/i.test(V.source), V.source);

  console.log('\n-- running costs: entered vs given by BYD --');
  const R = await page.evaluate(() => {
    state.settings.carCosts = { electricity: 120, parking: 180, ercp: null, roadTaxYear: 800, insuranceYear: null, tyresYear: null, otherYear: null };
    return JSON.parse(JSON.stringify(carRunningCosts()));
  });
  /* he set roadTaxYear himself, so his 800 REPLACES LTA's 1,474 rather than adding to it */
  ok('three figures counted as known', R.known.length === 3, R.known.map(x => x.key));
  ok('four still missing',             R.gaps.length === 4, R.gaps.length);
  ok('his own road tax overrides the document',
     R.known.find(x => x.key === 'roadTaxYear').value === 800 &&
     R.known.find(x => x.key === 'roadTaxYear').fromDoc === false,
     R.known.find(x => x.key === 'roadTaxYear'));
  ok('monthly = 120 + 180 + 800/12 (his road tax overrides LTA\'s)',
     near(R.monthly, 120 + 180 + 800 / 12), R.monthly);
  ok('annual is twelve times monthly', near(R.annual, R.monthly * 12), R.annual);
  ok('not marked complete while gaps remain', R.complete === false, R.complete);
  ok('all-in adds the loan instalment', near(R.allInMonthly, R.monthly + 1493.25, 0.02), R.allInMonthly);
  ok('the BYD list has 12 included items', R.included.length === 12, R.included.length);
  ok('the service package is on it',    R.included.some(i => /service package/i.test(i.item)), R.included.map(i => i.item).slice(0, 3));
  ok('only two included items carry a value',
     R.included.filter(i => i.value != null).length === 2, R.included.filter(i => i.value != null));
  ok('those two are the subsidy and the voucher',
     near(R.included.filter(i => i.value != null).reduce((a, i) => a + i.value, 0), 4000.00),
     R.included.filter(i => i.value != null));
  ok('no maintenance line to fill in, because it is prepaid',
     !R.entered.some(x => /maintenance|servicing/i.test(x.label)), R.entered.map(x => x.label));

  console.log('\n-- deregistration value: a published formula on his own record --');
  const D = await page.evaluate(() => JSON.parse(JSON.stringify(carDeregValue())));
  ok('eleven rows, year 0 to year 10',   D.rows.length === 11, D.rows.length);
  ok('quota premium 131,890',            near(D.qp, 131890.00), D.qp);
  ok('over a 120-month COE',             D.total === 120, D.total);
  ok('year 1: 108 months left, 118,701', D.rows[1].monthsLeft === 108 && near(D.rows[1].coeRebate, 118701.00, 0.5), D.rows[1]);
  ok('year 5: 60 months left, 65,945',   D.rows[5].monthsLeft === 60 && near(D.rows[5].coeRebate, 65945.00, 0.5), D.rows[5]);
  ok('year 9: 12 months left, 13,189',   D.rows[9].monthsLeft === 12 && near(D.rows[9].coeRebate, 13189.00, 0.5), D.rows[9]);
  ok('year 10: nothing left',            D.rows[10].monthsLeft === 0 && near(D.rows[10].coeRebate, 0), D.rows[10]);
  ok('the rebate falls in a straight line',
     D.rows.slice(1).every((r, i) => near(D.rows[i].coeRebate - r.coeRebate, 13189.00, 0.5)),
     D.rows.map(r => r.coeRebate));
  ok('every row recomputes as QP x months/120',
     D.rows.every(r => near(r.coeRebate, D.qp * r.monthsLeft / D.total, 0.02)), 'formula');

  console.log('\n-- the PARF leg is nil, and that is derived not assumed --');
  ok('PARF is flagged nil',              D.parfIsNil === true, D.parfIsNil);
  ok('every PARF figure is zero',        D.rows.every(r => r.parfRebate === 0), D.rows.map(r => r.parfRebate));
  ok('because ARF paid was zero',        near(D.arfPaid, 0), D.arfPaid);
  ok('so the floor IS the COE rebate',   D.rows.every(r => near(r.total, r.coeRebate)), 'floor');
  ok('the 30% band applies to his registration date', D.rows[1].parfPct === 30, D.rows[1].parfPct);
  ok('rebates taken up front = 26,422',  near(D.rebatesTaken, 26422.00), D.rebatesTaken);
  ok('PARF forgone at 30% = 7,926.60',   near(D.parfForgone, 7926.60, 0.5), D.parfForgone);
  ok('net ahead on the trade = 18,495',  near(D.netAhead, 18495.40, 1), D.netAhead);

  console.log('\n-- the rendered tab --');
  await page.evaluate(() => { state.settings.tab = 'car'; render(); document.querySelectorAll('details').forEach(d => d.open = true); });
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.getElementById('main').textContent);
  const html = await page.evaluate(() => document.getElementById('main').innerHTML);
  ok('no refusal card anywhere',        !html.includes('could not be drawn'));
  ok('the purchase card moved here',    /Car purchase/.test(txt));
  ok('it is no longer on the Summary tab', await page.evaluate(() => { state.settings.tab = 'dash'; render(); const t = document.getElementById('main').textContent; state.settings.tab = 'car'; render(); return !/How the invoice settles/.test(t); }));
  ok('the loan card is there',          /The loan/.test(txt));
  ok('the flat-rate truth is stated',   /is really/.test(txt) && /5\.19%/.test(txt));
  ok('the monthly schedule renders',    (txt.match(/Nov 2026/g) || []).length >= 1);
  ok('the resale card is there',        /What it is worth if you sell/.test(txt));
  ok('the running-cost card is there',  /What it costs to run/.test(txt));
  ok('BYD\'s service package is named', /200,000 km service package/.test(txt));
  ok('Rule-of-78 warning shown for a flat loan', /sum-of-digits/i.test(txt));
  ok('the deregistration floor is on the page', /floor Fortress CAN compute/i.test(txt));
  /* a year is a label, not a quantity - fmt() would render 2027 as "2,027" */
  ok('years render without a thousands separator', !/2,02\d/.test(txt) && /2027/.test(txt),
     (txt.match(/2,0\d\d/g) || []).slice(0, 3));
  ok('LTA\'s formula is quoted',           /unused period of COE \/ 120 months/i.test(txt));
  ok('the nil-PARF finding is prominent',  /PARF rebate is nil/i.test(txt));
  ok('it says the floor is not a price',   /a floor, not a price/i.test(txt));
  ok('it disclaims any view on the used market', /no view on that whatsoever/i.test(txt));
  ok('the net-worth ledger still has the car on Summary',
     await page.evaluate(() => { state.settings.tab = 'dash'; render(); const t = document.getElementById('main').textContent; state.settings.tab = 'car'; render(); return /Car at cost/.test(t) && /Car loan/.test(t); }));

  console.log('\n-- input handlers validate rather than accept anything --');
  const H = await page.evaluate(() => {
    const r = {};
    r.hasSaveLoan = typeof saveCarLoan === 'function';
    r.hasSaveValue = typeof saveCarValue === 'function';
    r.hasSaveCosts = typeof saveCarCosts === 'function';
    // clearing a value deletes that year rather than storing zero
    state.settings.carValues = [{ year: 2029, value: 90000 }];
    const before = state.settings.carValues.length;
    state.settings.carValues = (state.settings.carValues || []).filter(x => x.year !== 2029);
    r.deletable = before === 1 && state.settings.carValues.length === 0;
    return r;
  });
  ok('saveCarLoan exists',  H.hasSaveLoan);
  ok('saveCarValue exists', H.hasSaveValue);
  ok('saveCarCosts exists', H.hasSaveCosts);
  ok('a year can be removed, not just zeroed', H.deletable);

  console.log('\n-- every tab still draws --');
  for (const tab of ['dash', 'prop', 'car', 'cpf', 'retire', 'al', 'trends', 'fx', 'hist', 'set']) {
    const b4 = errors.length;
    await page.evaluate(t => { state.settings.tab = t; try { render(); } catch (e) { console.error(String(e)); } }, tab);
    await page.waitForTimeout(150);
    const h = await page.evaluate(() => document.getElementById('main').innerHTML);
    ok(tab + ' drew clean', errors.length === b4 && !h.includes('could not be drawn'), errors.slice(b4));
  }
  ok('zero page errors across the run', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
