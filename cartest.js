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
  ok('loan principal 105,000.00', near(C.loanPrincipal, 105000.00), C.loanPrincipal);
  ok('balance due 58,038.00',    near(C.balanceDue, 58038.00), C.balanceDue);
  ok('price - loan - deposit = balance due',
     near(C.price - C.loanPrincipal - C.deposit, C.balanceDue),
     [C.price, C.loanPrincipal, C.deposit, C.balanceDue]);
  ok('the reconciliation flag is true', C.reconciles === true, C.reconciles);
  ok('borrowed share of the price is 58.5%', near(C.borrowedPct, 58.53, 0.05), C.borrowedPct);
  ok('own cash required = deposit + balance', near(C.cashRequired, 16350 + 58038), C.cashRequired);

  console.log('\n-- ZERO ASSUMPTION: what neither document states stays null --');
  ok('lender is null',            C.loanLender === null, C.loanLender);
  ok('interest rate is null',     C.loanRatePct === null, C.loanRatePct);
  ok('tenor is null',             C.loanTenorYears === null, C.loanTenorYears);
  ok('instalment is null',        C.loanInstalment === null, C.loanInstalment);
  ok('loanKnown is false',        C.loanKnown === false, C.loanKnown);
  ok('all four gaps are named',   C.loanGaps.length === 4, C.loanGaps);
  ok('insurance premium is null', C.insurancePremium === null, C.insurancePremium);
  ok('insuranceKnown is false',   C.insuranceKnown === false, C.insuranceKnown);
  ok('registration number is null', C.registrationNo === null, C.registrationNo);
  ok('COE secured is null',       C.coeSecured === null, C.coeSecured);
  ok('no invented monthly figure anywhere on the position',
     !Object.keys(C).some(k => /monthly|instal/i.test(k) && C[k] != null),
     Object.keys(C).filter(k => /monthly|instal/i.test(k)).map(k => [k, C[k]]));

  console.log('\n-- the part-paid identity: the car nets to exactly the deposit --');
  ok('cost - loan - balance owed = 16,350.00', near(C.netToWorth, 16350.00), C.netToWorth);
  ok('and that equals the deposit already paid', near(C.netToWorth, C.deposit), [C.netToWorth, C.deposit]);
  ok('the identity flag agrees',  C.netEqualsDeposit === true, C.netEqualsDeposit);

  console.log('\n-- privacy: a public page carries none of the identifiers on these documents --');
  const fs = require('fs');
  const src = fs.readFileSync('index.html', 'utf8');
  ok('no NRIC',                  !/[STFGM]\d{7}[A-Z]/.test(src));
  ok('no engine number',         !src.includes('TZ180XSR7B6002755'));
  ok('no chassis number',        !src.includes('LC0CH6CB0T0128321'));
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
  ok('"Owed to the dealer" row present', 'Owed to the dealer' in rows, Object.keys(rows));
  ok('car at cost is the nett price',  near(rows['Car at cost'], 179388.00), rows['Car at cost']);
  ok('car loan shown negative',        near(rows['Car loan'], -105000.00), rows['Car loan']);
  ok('dealer balance shown negative',  near(rows['Owed to the dealer'], -58038.00), rows['Owed to the dealer']);
  ok('the three rows net to the deposit',
     near(rows['Car at cost'] + rows['Car loan'] + rows['Owed to the dealer'], 16350.00),
     rows['Car at cost'] + rows['Car loan'] + rows['Owed to the dealer']);

  console.log('\n-- Total borrowings now counts all three loans --');
  const W = await page.evaluate(() => { const a = agg(latest()); const w = netWorth(a); return { debt: a.debt, mortgage: w.mortgage, dbsUob: w.dbsUob, home: state.settings.homeValue || 0, cpf: w.cpf, al: w.al }; });
  ok('total borrowings = DBS + UOB + car',
     near(Math.abs(rows['Total borrowings']), W.debt + W.mortgage + 105000.00),
     [rows['Total borrowings'], W.debt + W.mortgage + 105000]);

  console.log('\n-- Everything moves by the car net, and by nothing else --');
  const before = W.dbsUob + W.home + W.cpf + W.al;
  ok('Everything = previous total + 16,350', near(rows['Everything'], before + 16350.00), [rows['Everything'], before + 16350]);
  ok('Everything did NOT move by the full price', !near(rows['Everything'], before + 179388.00), rows['Everything']);
  ok('Everything did NOT drop by the loan',      !near(rows['Everything'], before - 105000.00), rows['Everything']);

  console.log('\n-- the page says what it does not know --');
  const txt = await page.evaluate(() => document.getElementById('main').textContent);
  ok('states the loan size is all it holds',   /holds the loan's size and nothing else/i.test(txt));
  ok('names the missing loan terms',           /the interest rate/i.test(txt) && /the tenor/i.test(txt));
  ok('makes no unsourced claim about market lending practice',
     !/flat rate/i.test(txt) && !/roughly double/i.test(txt));
  ok('refuses to assume a rate',               /will not assume a rate/i.test(txt));
  ok('says no insurance premium is held',      /No insurance premium is in Fortress/i.test(txt));
  ok('says the subsidy is not a credit',       /not a credit against the insurer/i.test(txt));
  ok('says "at cost" is not a valuation',      /is not a valuation/i.test(txt));
  ok('warns the deposit postdates the statement', /ahead of your real balance/i.test(txt));
  ok('says the car is not yet registered',     /Not yet registered/i.test(txt));

  console.log('\n-- reminders --');
  const ids = await page.evaluate(() => retirementChecks().map(r => r.id));
  ok('car-balance reminder raised',   ids.includes('car-balance'), ids.filter(i => i.startsWith('car')));
  ok('car-insurance reminder raised', ids.includes('car-insurance'), ids.filter(i => i.startsWith('car')));

  console.log('\n-- once the balance is paid, the obligation clears and the car stands alone --');
  const P = await page.evaluate(() => {
    const c = JSON.parse(JSON.stringify(CAR_SEED)); c.balancePaid = true;
    state.settings.car = c;
    const pos = JSON.parse(JSON.stringify(carPosition()));
    const ids = retirementChecks().map(r => r.id);
    delete state.settings.car;
    return { pos, ids };
  });
  ok('nothing outstanding',            near(P.pos.outstanding, 0), P.pos.outstanding);
  ok('net to worth becomes cost less loan', near(P.pos.netToWorth, 179388 - 105000), P.pos.netToWorth);
  ok('the deposit identity no longer claims to hold', P.pos.netEqualsDeposit === false, P.pos.netEqualsDeposit);
  ok('the balance reminder retires',    !P.ids.includes('car-balance'), P.ids.filter(i => i.startsWith('car')));
  ok('the insurance reminder stays',    P.ids.includes('car-insurance'), P.ids.filter(i => i.startsWith('car')));

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
