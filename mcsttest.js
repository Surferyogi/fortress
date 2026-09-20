/* mcsttest.js — the MCST settlement recorded from the Knight Frank confirmation of
   4 Sep 2026 and the bank transfer of 3 Sep 2026.

   Run: node mcsttest.js
   The page is loaded in a real Chromium with timezoneId Asia/Singapore, because every
   date bug this app has had was a timezone bug that a UTC runner could not see. */
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (got !== undefined ? '  got: ' + JSON.stringify(got) : '')); }
};
const near = (a, b, tol = 0.005) => a != null && b != null && Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const ctx = await browser.newContext({ timezoneId: 'Asia/Singapore' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(1200);

  const M = await page.evaluate(() => JSON.parse(JSON.stringify(mcstPosition())));

  console.log('\n-- the invoice is unchanged: a payment must not rewrite the document --');
  ok('brought-forward balance still 1,458.00 as invoiced', near(M.balanceBF, 1458.00), M.balanceBF);
  ok('current quarter still 1,458.00 as invoiced',          near(M.currentAmount, 1458.00), M.currentAmount);
  ok('invoice total still 2,916.00',                        near(M.totalDue, 2916.00), M.totalDue);
  ok('per-quarter run rate unchanged at 1,458.00',          near(M.perQuarter, 1458.00), M.perQuarter);
  ok('annual run rate unchanged at 5,832.00',               near(M.annual, 5832.00), M.annual);
  ok('monthly run rate unchanged at 486.00',                near(M.monthly, 486.00), M.monthly);

  console.log('\n-- the payment, exactly as the two documents state it --');
  ok('one payment recorded',              M.payments.length === 1, M.payments.length);
  ok('dated 3 Sep 2026',                  M.payments[0].date === '2026-09-03', M.payments[0].date);
  ok('2,916.00 paid',                     near(M.paid, 2916.00), M.paid);
  ok('payment equals the invoice total',  near(M.paid, M.totalDue), [M.paid, M.totalDue]);
  ok('agent confirmation dated 4 Sep',    M.payments[0].confirmedOn === '2026-09-04', M.payments[0].confirmedOn);
  ok('quote carries the agent\'s own words',
     M.payments[0].confirmedQuote === 'We have received your payment $2,916.00 on 03/09/2026.',
     M.payments[0].confirmedQuote);
  ok('receiving bank recorded as OCBC',   M.payments[0].payeeBank === 'OCBC', M.payments[0].payeeBank);

  console.log('\n-- ZERO ASSUMPTION: the paying account was never stated, so it is never claimed --');
  ok('fromAccount is null, not inferred from the UOB property account',
     M.payments[0].fromAccount === null, M.payments[0].fromAccount);

  console.log('\n-- settlement is DERIVED, oldest period first --');
  ok('brought-forward quarter cleared', M.bfSettled === true, M.bfSettled);
  ok('current quarter cleared',         M.currentSettled === true, M.currentSettled);
  ok('1,458.00 applied to the brought-forward quarter', near(M.bfPaid, 1458.00), M.bfPaid);
  ok('1,458.00 applied to the current quarter',         near(M.currentPaid, 1458.00), M.currentPaid);
  ok('nothing outstanding',             near(M.outstanding, 0), M.outstanding);
  ok('no credit left over',             near(M.credit, 0), M.credit);
  ok('settled flag is true',            M.settled === true, M.settled);
  ok('settlement date is the payment date', M.paidOn === '2026-09-03', M.paidOn);
  ok('paid 27 days before the 30 Sep due date', M.paidEarlyDays === 27, M.paidEarlyDays);
  ok('no late interest charged',        M.lateInterestCharged === false, M.lateInterestCharged);
  /* The exposure window must close on the day it was PAID, not keep growing with today's
     date. 1 Jul 2026 (30 days after the 1 Jun period began) to 3 Sep 2026 is 64 days. */
  ok('brought-forward quarter was exposed for 64 days, measured to the payment',
     M.bfExposedDays === 64, M.bfExposedDays);
  ok('interest not levied works out at S$30.68', near(M.bfInterestAvoided, 30.68, 0.01), M.bfInterestAvoided);
  ok('that window does not move with today\'s date',
     M.bfExposedDays === 64 && M.daysPastTrigger > M.bfExposedDays, [M.bfExposedDays, M.daysPastTrigger]);

  console.log('\n-- the next quarter: date derived, amount refused --');
  ok('next period begins 1 Dec 2026',   M.nextBegin === '2026-12-01', M.nextBegin);
  ok('due on the 1st day, per the invoice rule', M.nextDueOn === '2026-12-01', M.nextDueOn);
  ok('12% would start 31 Dec 2026 (30 days on)', M.nextInterestFrom === '2026-12-31', M.nextInterestFrom);
  ok('next amount is explicitly NOT known', M.nextAmountKnown === false, M.nextAmountKnown);
  ok('no figure is carried for the next quarter',
     !('nextAmount' in M) || M.nextAmount == null, M.nextAmount);

  console.log('\n-- reminders: the two paid items retire, one forward-looking item replaces them --');
  const ids = await page.evaluate(() => retirementChecks().map(r => r.id));
  ok('retirementChecks() returned a list', Array.isArray(ids) && ids.length > 0, ids && ids.length);
  ok('mcst-arrears is gone',  !ids.includes('mcst-arrears'), ids.filter(i => i.startsWith('mcst')));
  ok('mcst-due is gone',      !ids.includes('mcst-due'),     ids.filter(i => i.startsWith('mcst')));
  ok('mcst-next is present',   ids.includes('mcst-next'),    ids.filter(i => i.startsWith('mcst')));

  console.log('\n-- the running cost model must NOT move: this was a payment, not a re-rating --');
  const N = await page.evaluate(() => JSON.parse(JSON.stringify(rentNet())));
  ok('rentNet still charges 486.00 a month of MCST', near(N.mcstM, 486.00), N.mcstM);
  const B = await page.evaluate(() => { const b = breakEven(); return { mcstM: b.mcstM, carry: b.carryPerMonth }; });
  ok('break-even still charges 486.00 a month of MCST', near(B.mcstM, 486.00), B.mcstM);

  console.log('\n-- privacy: nothing that identifies an account may reach a public page --');
  const fs = require('fs');
  const src = fs.readFileSync('index.html', 'utf8');
  ok('the MCST\'s OCBC account number is absent', !src.includes('625874235001'));
  /* The one 12-digit run in this file is the UOI fire policy number DHOF123043672600,
     which is a document reference and not an account. Everything else must stay clean. */
  /* The long digit runs already in this file are document references, not accounts: the
     UOI fire policy number, DBS eStatement serial numbers and Air Liquide ISINs. The
     guard that matters is that THIS patch introduced no new one. Compared against the
     version currently deployed, which is git HEAD. */
  const { execSync } = require('child_process');
  const head = execSync('git show HEAD:index.html', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const runs = str => new Set([...str.matchAll(/[^0-9]([0-9]{9,})[^0-9]/g)].map(m => m[1]));
  const wasThere = runs(head);
  const added = [...runs(src)].filter(d => !wasThere.has(d));
  ok('this patch introduced no new long digit string', added.length === 0, added);
  ok('no NRIC-shaped string anywhere',            !/[STFGM]\d{7}[A-Z]/.test(src));

  console.log('\n-- the page actually renders on every tab --');
  for (const tab of ['dash', 'prop', 'cpf', 'retire', 'al', 'trends', 'fx', 'hist', 'set']) {
    const before = errors.length;
    await page.evaluate(t => { state.settings.tab = t; try { render(); } catch (e) { console.error(String(e)); } }, tab);
    await page.waitForTimeout(250);
    const html = await page.evaluate(() => document.getElementById('main').innerHTML);
    ok(tab + ' tab drew with no error and no refusal card',
       errors.length === before && !html.includes('could not be drawn'),
       errors.slice(before));
  }

  console.log('\n-- the settled banner says the true thing on the page --');
  await page.evaluate(() => { state.settings.tab = 'prop'; render(); });
  await page.waitForTimeout(300);
  /* innerText is what a reader actually sees; textContent also reaches the notes tucked
     inside the collapsed "Show the detail" disclosure. Both matter, for different claims. */
  const body = await page.evaluate(() => document.getElementById('main').innerText);
  const all  = await page.evaluate(() => document.getElementById('main').textContent);
  ok('page states it is settled in full',      /Settled in full/i.test(body));
  ok('page shows the 3 Sep payment date',      /3 Sep 2026/.test(body));
  ok('page states no late interest was charged', /No late interest was charged/i.test(body));
  ok('page labels the avoided interest as what did NOT happen', /not a figure from the invoice/i.test(body));
  ok('page shows 64 days of exposure, not a running count', /64 days at/i.test(body));
  ok('page refuses to price the next quarter', /does not know what it costs/i.test(all));
  ok('next quarter is dated 1 Dec 2026 on the page', /next quarter begins 1 Dec 2026/i.test(all));
  ok('the reference figure is labelled a reference, not a bill', /that is a reference, not a bill/i.test(all));
  ok('the paying account is explicitly not claimed', /does not name the account the money left/i.test(all));
  ok('page still shows the arrears wording nowhere', !/shows as brought forward/i.test(body));

  console.log('\n-- the negative case: strip the payment and every warning must come back --');
  const U = await page.evaluate(() => {
    const M = JSON.parse(JSON.stringify(state.settings.mcst || MCST_SEED));
    M.payments = [];
    state.settings.mcst = M;
    const pos = JSON.parse(JSON.stringify(mcstPosition()));
    const ids = retirementChecks().map(r => r.id);
    state.settings.tab = 'prop'; render();
    const txt = document.getElementById('main').textContent;
    delete state.settings.mcst;                       // restore, so later checks are honest
    return { pos, ids, arrears: /shows as brought forward/i.test(txt), settledTxt: /Settled in full/i.test(txt) };
  });
  ok('with no payment, nothing is settled',        U.pos.settled === false, U.pos.settled);
  ok('with no payment, 2,916.00 is outstanding',   near(U.pos.outstanding, 2916.00), U.pos.outstanding);
  ok('with no payment, the arrears reminder returns', U.ids.includes('mcst-arrears'), U.ids.filter(i => i.startsWith('mcst')));
  ok('with no payment, the due reminder returns',     U.ids.includes('mcst-due'),     U.ids.filter(i => i.startsWith('mcst')));
  ok('with no payment, the forward item is withheld', !U.ids.includes('mcst-next'),   U.ids.filter(i => i.startsWith('mcst')));
  ok('with no payment, the arrears banner is on the page', U.arrears === true, U.arrears);
  ok('with no payment, no settled banner is shown',        U.settledTxt === false, U.settledTxt);

  console.log('\n-- a PARTIAL payment must clear the oldest quarter only --');
  const P = await page.evaluate(() => {
    const M = JSON.parse(JSON.stringify(state.settings.mcst || MCST_SEED));
    M.payments = [{ date: '2026-09-03', amount: 1458.00, method: 'bank transfer', payee: 'MCST 4940' }];
    state.settings.mcst = M;
    const pos = JSON.parse(JSON.stringify(mcstPosition()));
    const ids = retirementChecks().map(r => r.id);
    delete state.settings.mcst;
    return { pos, ids };
  });
  ok('partial payment clears the brought-forward quarter', P.pos.bfSettled === true, P.pos.bfSettled);
  ok('partial payment leaves the current quarter open',    P.pos.currentSettled === false, P.pos.currentSettled);
  ok('1,458.00 still outstanding',                         near(P.pos.outstanding, 1458.00), P.pos.outstanding);
  ok('not settled overall',                                P.pos.settled === false, P.pos.settled);
  ok('arrears reminder retires, due reminder stays',
     !P.ids.includes('mcst-arrears') && P.ids.includes('mcst-due'), P.ids.filter(i => i.startsWith('mcst')));

  console.log('\n-- back to the real state --');
  await page.evaluate(() => { state.settings.tab = 'prop'; render(); });
  await page.waitForTimeout(200);
  const again = await page.evaluate(() => JSON.parse(JSON.stringify(mcstPosition())));
  ok('the real position is unchanged after the probes', again.settled === true && near(again.outstanding, 0), [again.settled, again.outstanding]);

  console.log('\n-- no uncaught errors at all --');
  ok('zero page errors across the run', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
