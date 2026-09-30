/* cartest.js — the BYD Seal 6 Premium purchase and its financing.

   Two themes:
     1. Every figure traces to the sales agreement or the invoice. Nothing is estimated.
     2. What the documents DO NOT say — the loan's rate, tenor, instalment and lender, and
        the insurance premium — must stay null and must be SAID, not filled in.

   Run: node cartest.js
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

  const C = await page.evaluate(() => JSON.parse(JSON.stringify(carPosition())));

  console.log('\n-- the sales agreement, VSA 1054052 of 7 Sep 2026 --');
  ok('retail price 246,888.00',          near(C.retailPrice, 246888.00), C.retailPrice);
  ok('additional discount 67,500.00',    near(C.additionalDiscount, 67500.00), C.additionalDiscount);
  ok('retail less discount = nett price', near(C.retailPrice - C.additionalDiscount, C.price), [C.retailPrice, C.additionalDiscount, C.price]);
  ok('nett price 179,388.00',            near(C.price, 179388.00), C.price);
  ok('options net to nil',               near(C.optionsTotal - C.optionsDiscount, 0), [C.optionsTotal, C.optionsDiscount]);
  ok('discount off retail is 67,500.00', near(C.discountOffRetail, 67500.00), C.discountOffRetail);
  ok('which is 27.3% off list',          near(C.discountPct, 27.3, 0.05), C.discountPct);

  console.log('\n-- the invoice of 24 Sep 2026, re-run rather than trusted --');
  ok('deposit 16,350.00',        near(C.deposit, 16350.00), C.deposit);
  ok('deposit recorded as paid', C.depositPaid === true, C.depositPaid);
  ok('the deposit now has a dated receipt', C.depositDateEvidenced === true, C.depositDateEvidenced);
  ok('dated 8 Sep 2026, the day after the agreement',
     C.depositPayment.date === '2026-09-08' && C.depositPayment.time === '13:10', C.depositPayment);
  ok('the deposit receipt names no bank, and none is invented',
     C.depositPayment.from === null, C.depositPayment.from);
  ok('loan principal 105,000.00', near(C.loanPrincipal, 105000.00), C.loanPrincipal);
  ok('balance due 58,038.00',    near(C.balanceDue, 58038.00), C.balanceDue);
  ok('price - loan - deposit = balance due',
     near(C.price - C.loanPrincipal - C.deposit, C.balanceDue),
     [C.price, C.loanPrincipal, C.deposit, C.balanceDue]);
  ok('the reconciliation flag is true', C.reconciles === true, C.reconciles);
  ok('borrowed share of the price is 58.5%', near(C.borrowedPct, 58.53, 0.05), C.borrowedPct);
  ok('total own money = deposit + balance', near(C.totalOwnMoney, 16350 + 58038), C.totalOwnMoney);

  console.log('\n-- ZERO ASSUMPTION: what neither document states stays null --');
  ok('lender is null',            C.loanLender === null, C.loanLender);
  ok('interest rate is null',     C.loanRatePct === null, C.loanRatePct);
  ok('tenor is null',             C.loanTenorYears === null, C.loanTenorYears);
  ok('instalment is null',        C.loanInstalment === null, C.loanInstalment);
  ok('loanKnown is false',        C.loanKnown === false, C.loanKnown);
  ok('all four gaps are named',   C.loanGaps.length === 4, C.loanGaps);
  ok('the schedule inception date is still not documented', C.insuranceRenewalDate === null, C.insuranceRenewalDate);
  ok('registration number is null', C.registrationNo === null, C.registrationNo);
  ok('the COE premium is now documented', near(C.coePremiumPaid, 131890.00), C.coePremiumPaid);
  ok('and so is the OMV',                 near(C.omv, 24587.00), C.omv);
  ok('ARF paid is zero, as LTA states',   near(C.arfPaid, 0), C.arfPaid);
  ok('minimum PARF benefit is zero',      near(C.minimumParfBenefit, 0), C.minimumParfBenefit);
  ok('the registration plate is still NOT recorded', C.registrationNo === null, C.registrationNo);
  ok('no invented monthly figure anywhere on the position',
     !Object.keys(C).some(k => /monthly|instal/i.test(k) && C[k] != null),
     Object.keys(C).filter(k => /monthly|instal/i.test(k)).map(k => [k, C[k]]));

  console.log('\n-- the two payments of 24 Sep clear the balance to the cent --');
  ok('three receipts in total',            C.payments.length === 3, C.payments.length);
  ok('payments are in date order',         C.payments[0].date <= C.payments[1].date && C.payments[1].date <= C.payments[2].date,
                                           C.payments.map(p => p.date));
  ok('two of them are against the balance', C.balancePayments.length === 2, C.balancePayments.length);
  ok('41,688.00 by PayNow at 15:48',       near(C.balancePayments[0].amount, 41688.00) && C.balancePayments[0].time === '15:48', C.balancePayments[0]);
  ok('16,350.00 by card at 17:30',         near(C.balancePayments[1].amount, 16350.00) && C.balancePayments[1].time === '17:30', C.balancePayments[1]);
  ok('the deposit is NOT counted against the balance',
     !C.balancePayments.some(p => p.against === 'deposit'), C.balancePayments.map(p => p.against));
  ok('all three receipts sum to 74,388.00', near(C.totalPaid, 74388.00), C.totalPaid);
  ok('which is every dollar of his own money', C.fullyEvidenced === true, [C.totalPaid, C.totalOwnMoney]);
  ok('they sum to 58,038.00',              near(C.paidToBalance, 58038.00), C.paidToBalance);
  ok('which is exactly the balance due',   near(C.paidToBalance, C.balanceDue), [C.paidToBalance, C.balanceDue]);
  ok('the balance is marked clear',        C.balanceClears === true, C.balanceClears);
  ok('nothing outstanding',                near(C.outstanding, 0), C.outstanding);
  ok('own money = deposit + balance = 74,388', near(C.totalOwnMoney, 74388.00), C.totalOwnMoney);
  ok('deposit + balance + loan = the price',
     near(C.deposit + C.balanceDue + C.loanPrincipal, C.price),
     [C.deposit, C.balanceDue, C.loanPrincipal, C.price]);
  ok('the car now nets to cost less loan', near(C.netToWorth, 74388.00), C.netToWorth);
  ok('payment messages carry no account or card digits',
     !C.payments.some(p => /\d{4}/.test(p.from)), C.payments.map(p => p.from));

  console.log('\n-- insurance: paid, net of the subsidy, and the gross stays an inference --');
  ok('insurer is MSIG, not Liberty',    /MSIG/.test(C.insurer) && !/Liberty/.test(C.insurer), C.insurer);
  ok('299.03 paid',                     near(C.insurancePaid, 299.03), C.insurancePaid);
  ok('paid 24 Sep 2026',                C.insurancePaidOn === '2026-09-24', C.insurancePaidOn);
  ok('flagged as net of the subsidy',   C.insuranceIsNetOfSubsidy === true, C.insuranceIsNetOfSubsidy);
  ok('insuranceKnown is now true',      C.insuranceKnown === true, C.insuranceKnown);
  ok('implied gross was 3,299.03',      near(C.insuranceGrossImplied, 3299.03), C.insuranceGrossImplied);
  ok('MSIG\'s own gross is 3,299.03',   near(C.insuranceGross, 3299.03), C.insuranceGross);
  ok('so the earlier inference was right', near(C.insuranceGross, C.insuranceGrossImplied), [C.insuranceGross, C.insuranceGrossImplied]);
  ok('gross less subsidy reconciles to the card charge', C.insuranceReconciles === true, C.insuranceReconciles);
  ok('one-year policy',                 C.insurancePeriodYears === 1, C.insurancePeriodYears);
  ok('excess 1,000',                    near(C.insuranceExcess, 1000.00), C.insuranceExcess);
  ok('NCD is 0% on a first policy',     C.insuranceNcdPct === 0, C.insuranceNcdPct);
  ok('renewal is DERIVED, not documented', C.insuranceRenewalDerived === '2027-09-24', C.insuranceRenewalDerived);
  ok('and the derived date is used',    C.insuranceRenewalOn === '2027-09-24', C.insuranceRenewalOn);
  ok('the internal CRM link is not recorded anywhere',
     !require('fs').readFileSync('index.html', 'utf8').includes('force.com'));

  console.log('\n-- privacy: a public page carries none of the identifiers on these documents --');
  const fs = require('fs');
  const src = fs.readFileSync('index.html', 'utf8');
  ok('no NRIC',                  !/[STFGM]\d{7}[A-Z]/.test(src));
  ok('no engine number',         !src.includes('TZ180XSR7B6002755'));
  ok('no chassis number',        !src.includes('LC0CH6CB0T0128321'));
  ok('no registration plate',    !src.includes('SPK8566J'));
  ok('no COE certificate number', !src.includes('2026100101001624N'));
  ok('no LTA transaction reference', !src.includes('20260925194341257844') && !src.includes('2509260101N029194346'));
  ok('no home address',          !/Delta Avenue/i.test(src));
  ok('no mobile number',         !src.includes('86008084'));
  ok("no dealer bank account",   !src.includes('0-853128-007') && !src.includes('853128'));
  ok('family named by relationship, not by name', /you and your wife/.test(src) && !/Sophia/i.test(src));

  console.log('\n-- the net-worth ledger carries all three lines --');
  await page.evaluate(() => { state.settings.tab = 'dash'; render(); });
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#main .kv').forEach(kv => {
      const k = kv.querySelector('.k'), v = kv.querySelector('.v');
      if (!k || !v) return;
      const c = k.cloneNode(true); c.querySelectorAll('span').forEach(x => x.remove());
      const label = c.textContent.replace(/\s+/g, ' ').trim();
      const num = parseFloat(v.textContent.replace(/[^0-9.\-]/g, ''));
      const negative = /−|-S\$|^-/.test(v.textContent) || v.classList.contains('neg');
      if (!(label in out) && !isNaN(num)) out[label] = negative ? -num : num;
    });
    return out;
  });
  ok('"Car at cost" row present',      'Car at cost' in rows, Object.keys(rows));
  ok('"Car loan" row present',         'Car loan' in rows, Object.keys(rows));
  ok('"Owed to the dealer" row is gone now it is paid', !('Owed to the dealer' in rows), Object.keys(rows).slice(0, 14));
  ok('car at cost is the nett price',  near(rows['Car at cost'], 179388.00), rows['Car at cost']);
  ok('car loan shown negative',        near(rows['Car loan'], -105000.00), rows['Car loan']);
  ok('the two remaining rows net to cost less loan',
     near(rows['Car at cost'] + rows['Car loan'], 74388.00),
     rows['Car at cost'] + rows['Car loan']);

  console.log('\n-- Total borrowings now counts all three loans --');
  const W = await page.evaluate(() => { const a = agg(latest()); const w = netWorth(a); return { debt: a.debt, mortgage: w.mortgage, dbsUob: w.dbsUob, home: state.settings.homeValue || 0, cpf: w.cpf, al: w.al }; });
  ok('total borrowings = DBS + UOB + car',
     near(Math.abs(rows['Total borrowings']), W.debt + W.mortgage + 105000.00),
     [rows['Total borrowings'], W.debt + W.mortgage + 105000]);

  console.log('\n-- Everything moves by the car net, and by nothing else --');
  const before = W.dbsUob + W.home + W.cpf + W.al;
  ok('Everything = previous total + 74,388', near(rows['Everything'], before + 74388.00), [rows['Everything'], before + 74388]);
  ok('Everything did NOT move by the full price', !near(rows['Everything'], before + 179388.00), rows['Everything']);
  ok('Everything did NOT drop by the loan',      !near(rows['Everything'], before - 105000.00), rows['Everything']);

  console.log('\n-- the page says what it does not know --');
  /* the purchase card moved to the Car tab in v2026:SEP:28; the net-worth ledger rows
     above are still read from Summary, which is why the tab is switched only here */
  const txt = await page.evaluate(() => { state.settings.tab = 'car'; render(); return document.getElementById('main').textContent; });
  ok('states the loan size is all it holds',   /holds the loan's size and nothing else/i.test(txt));
  ok('names the missing loan terms',           /the interest rate/i.test(txt) && /the tenor/i.test(txt));
  ok('makes no unsourced claim about market lending practice',
     !/flat rate/i.test(txt) && !/roughly double/i.test(txt));
  ok('refuses to assume a rate',               /will not assume a rate/i.test(txt));
  ok('shows the premium paid',                 /Premium paid/i.test(txt));
  ok('still owns the earlier subsidy mistake', /had the subsidy wrong before this/i.test(txt));
  ok('states the subsidy went to the premium', /went to the premium/i.test(txt));
  ok('no stale claim that the subsidy was absorbed into the price',
     !/netted to zero in the options/i.test(txt) && !/already netted into the package price/i.test(txt));
  ok('confirms the inference it once flagged', /inference was right; it is now a figure from the insurer/i.test(txt));
  ok('quotes its own earlier hedge back',      /arithmetic on an assumption/i.test(txt));
  ok('shows the gross, not just what he paid', /3,299\.03/.test(txt));
  ok('warns year two is the number to brace for', /Year two is the number to brace for/i.test(txt));
  ok('refuses to predict the renewal figure',  /will not predict the renewal/i.test(txt));
  ok('labels the renewal date as derived',     /derived, not documented/i.test(txt));
  ok('states the deposit question is now closed', /question is closed/i.test(txt));
  /* the settled banner must cite ONLY the two balance payments; listing the deposit
     among them would claim three receipts sum to 58,038 when they sum to 74,388 */
  ok('the settled banner cites two payments, not three',
     (txt.match(/S\$41,688 by PayNow at 15:48, then S\$16,350 by card at 17:30/) || []).length === 1,
     txt.slice(txt.indexOf('The car is paid for'), txt.indexOf('The car is paid for') + 260));
  ok('the settled banner does not fold the deposit into the balance',
     !/by bank transfer at 13:10, then/.test(txt));
  ok('no longer asks for a check it has the answer to', !/One thing to check, because it is worth/i.test(txt));
  ok('every dollar is accounted for by a receipt', /accounted for by a dated receipt/i.test(txt));
  /* this one lives on the Summary ledger note, not the Car tab */
  const dashNote = await page.evaluate(() => { state.settings.tab = 'dash'; render(); const s = document.getElementById('main').textContent; state.settings.tab = 'car'; render(); return s; });
  ok('says "at cost" is not a valuation',      /is not a valuation/i.test(dashNote));
  const dashTxt = await page.evaluate(() => { state.settings.tab = 'dash'; render(); const s = document.getElementById('main').textContent; state.settings.tab = 'car'; render(); return s; });
  ok('warns all the cash left after the statement', /left your accounts in September, after the/i.test(dashTxt));
  ok('refuses to deduct an unobserved balance', /will not deduct from a balance it has not observed/i.test(dashTxt));
  ok('says the deposit receipt named no bank',  /deposit receipt names no bank at all/i.test(dashTxt));
  ok('says the car is registered',             /Registered 25 Sep 2026/i.test(txt));
  ok('shows the COE as a share of the price',  /The COE is 73\.5% of what you paid/i.test(txt));
  ok('names what it deliberately left out',    /Not recorded here, on purpose/i.test(txt));

  console.log('\n-- reminders --');
  const ids = await page.evaluate(() => retirementChecks().map(r => r.id));
  ok('car-balance reminder has retired',        !ids.includes('car-balance'), ids.filter(i => i.startsWith('car')));
  ok('car-insurance "not priced" has retired',  !ids.includes('car-insurance'), ids.filter(i => i.startsWith('car')));
  ok('the renewal-date reminder replaces it',    ids.includes('car-insurance-renewal'), ids.filter(i => i.startsWith('car')));

  console.log('\n-- the negative case: mark it unpaid and every warning must come back --');
  const P = await page.evaluate(() => {
    const c = JSON.parse(JSON.stringify(CAR_SEED));
    c.balancePaid = false; c.payments = []; c.insurancePaid = null;
    c.depositDateEvidenced = false; c.depositPaidOn = null;
    state.settings.car = c;
    const pos = JSON.parse(JSON.stringify(carPosition()));
    const ids = retirementChecks().map(r => r.id);
    state.settings.tab = 'dash'; render();
    const dashTxt = document.getElementById('main').textContent;
    state.settings.tab = 'car'; render();
    const txt = document.getElementById('main').textContent;
    delete state.settings.car; render();
    return { pos, ids, owed: /Owed to the dealer/.test(dashTxt),
             notPriced: /No insurance premium is in Fortress/i.test(txt),
             depositBox: /One thing to check, because it is worth/.test(txt),
             refused: /could not be drawn/.test(document.getElementById('main').innerHTML) };
    /* both tabs were rendered above; neither may have refused */
  });
  ok('unpaid: the tab still draws, no refusal card', P.refused === false, P.refused);
  ok('unpaid: 58,038 outstanding again',   near(P.pos.outstanding, 58038.00), P.pos.outstanding);
  ok('unpaid: the balance no longer clears', P.pos.balanceClears === false, P.pos.balanceClears);
  ok('unpaid: net to worth falls back to the deposit', near(P.pos.netToWorth, 16350.00), P.pos.netToWorth);
  ok('unpaid: the part-paid identity holds again', P.pos.netEqualsDeposit === true, P.pos.netEqualsDeposit);
  ok('unpaid: the balance reminder returns', P.ids.includes('car-balance'), P.ids.filter(i => i.startsWith('car')));
  ok('unpriced: the "not priced" reminder returns', P.ids.includes('car-insurance'), P.ids.filter(i => i.startsWith('car')));
  ok('unpriced: the card says so',          P.notPriced === true, P.notPriced);
  ok('unpriced: no implied gross is computed', P.pos.insuranceGrossImplied === null, P.pos.insuranceGrossImplied);
  ok('unpaid: the dealer row is back on the ledger', P.owed === true, P.owed);
  /* the deposit-date box reasons from the first payment, so with none it must not render
     - and above all must not throw. An unguarded index here took out the whole tab. */
  ok('unpaid: the deposit-date check withholds itself rather than throwing',
     P.depositBox === false, P.depositBox);

  console.log('\n-- back to the real state --');
  const again = await page.evaluate(() => JSON.parse(JSON.stringify(carPosition())));
  ok('the real position survives the probe', again.balanceClears === true && near(again.outstanding, 0), [again.balanceClears, again.outstanding]);

  console.log('\n-- every tab still draws --');
  for (const tab of ['dash', 'prop', 'cpf', 'retire', 'al', 'trends', 'fx', 'hist', 'set']) {
    const b4 = errors.length;
    await page.evaluate(t => { state.settings.tab = t; try { render(); } catch (e) { console.error(String(e)); } }, tab);
    await page.waitForTimeout(200);
    const html = await page.evaluate(() => document.getElementById('main').innerHTML);
    ok(tab + ' drew with no error and no refusal card',
       errors.length === b4 && !html.includes('could not be drawn'), errors.slice(b4));
  }
  ok('zero page errors across the run', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
