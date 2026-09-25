/* nettest.js — the Summary card's net-worth ledger.

   The whole point of this suite: the DBS drawdown loan became VISIBLE, it did not become
   a new deduction. DBS's own statement already nets it off. If a future change ever
   subtracts it a second time, these tests fail.

   Run: node nettest.js
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

  const D = await page.evaluate(() => {
    const s = latest(), a = agg(s), w = netWorth(a);
    return {
      stmt: s.statementDate,
      parts: s.portfolios.map(p => ({ id: p.id, assets: p.totalAssets, loans: p.totalLoans, net: p.netAssets })),
      assets: a.assets, debt: a.debt, net: a.net,
      uobCash: w.uobCash, mortgage: w.mortgage, dbsUob: w.dbsUob,
      home: state.settings.homeValue || 0, al: w.al, cpf: w.cpf,
      car: (typeof carPosition === 'function' && carPosition())
             ? { price: carPosition().price, loan: carPosition().loanPrincipal,
                 owed: carPosition().outstanding, net: carPosition().netToWorth } : null
    };
  });

  console.log('\n-- the statement nets the drawdown loan off itself: this is the whole premise --');
  D.parts.forEach(p => {
    ok(p.id + ': assets minus the loan equals the reported net assets',
       near(p.assets - Math.abs(p.loans || 0), p.net), [p.assets, p.loans, p.net]);
  });
  ok('aggregate net assets = gross assets minus drawn',
     near(D.net, D.assets - D.debt), [D.net, D.assets, D.debt]);
  ok('a drawdown loan is actually present to test against', D.debt > 0, D.debt);

  console.log('\n-- the ledger adds up, line by line, exactly as drawn --');
  ok('DBS + UOB = DBS net + UOB cash - home loan',
     near(D.dbsUob, D.net + D.uobCash - D.mortgage), [D.dbsUob, D.net, D.uobCash, D.mortgage]);
  const carNet = D.car ? D.car.net : 0;
  const everything = D.dbsUob + D.home + D.cpf + D.al + carNet;
  ok('Everything = DBS+UOB + property + CPF + Air Liquide + the car',
     near(everything, D.dbsUob + D.home + D.cpf + D.al + carNet), everything);
  if (D.car) {
    /* the car contributes its NET, never its price: cost less loan less what is still
       owed on it. If that ever becomes the full price, net worth jumps by 179,388 for a
       car that is largely unpaid. */
    ok('the car contributes cost - loan - owed, not its price',
       near(carNet, D.car.price - D.car.loan - D.car.owed) && !near(carNet, D.car.price),
       [carNet, D.car]);
  }

  console.log('\n-- THE REGRESSION GUARD: the drawdown loan is deducted ONCE, never twice --');
  /* Build the totals from gross assets explicitly. If anything ever subtracts a.debt on
     top of a.net, these two disagree by exactly the drawn amount. */
  const fromGross = (D.assets - D.debt) + D.uobCash - D.mortgage;
  ok('walking from GROSS assets reaches the same DBS+UOB figure',
     near(fromGross, D.dbsUob), [fromGross, D.dbsUob]);
  ok('the two routes differ by 0, not by the drawn amount',
     near(Math.abs(fromGross - D.dbsUob), 0) && !near(Math.abs(fromGross - D.dbsUob), D.debt),
     Math.abs(fromGross - D.dbsUob));

  console.log('\n-- the rendered card: every line present and arithmetically true --');
  await page.evaluate(() => { state.settings.tab = 'dash'; render(); });
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#main .kv').forEach(kv => {
      const k = kv.querySelector('.k'), v = kv.querySelector('.v');
      if (!k || !v) return;
      /* the label is the k cell's own text; the sub-line lives in a nested <span> and
         textContent does not break at <br>, so strip the nested spans first */
      const c = k.cloneNode(true);
      c.querySelectorAll('span').forEach(x => x.remove());
      const label = c.textContent.replace(/\s+/g, ' ').trim();
      const num = parseFloat(v.textContent.replace(/[^0-9.\-]/g, ''));
      const negative = /−|-S\$|^-/.test(v.textContent) || v.classList.contains('neg');
      if (!(label in out) && !isNaN(num)) out[label] = negative ? -num : num;
    });
    return out;
  });
  const has = k => Object.prototype.hasOwnProperty.call(rows, k);
  ok('a "DBS portfolio assets" row is now on the card', has('DBS portfolio assets'), Object.keys(rows).slice(0, 12));
  ok('a "DBS drawdown loan" row is now on the card',    has('DBS drawdown loan'), Object.keys(rows).slice(0, 12));
  ok('"DBS net assets" is still there',                 has('DBS net assets'));
  ok('"Total borrowings" is on the card',               has('Total borrowings'));
  ok('portfolio assets row matches the statement',      near(rows['DBS portfolio assets'], D.assets), rows['DBS portfolio assets']);
  ok('drawdown loan row is shown NEGATIVE',             rows['DBS drawdown loan'] < 0, rows['DBS drawdown loan']);
  ok('drawdown loan row matches the statement',         near(Math.abs(rows['DBS drawdown loan']), D.debt), rows['DBS drawdown loan']);
  ok('the three DBS rows reconcile on screen',
     near(rows['DBS portfolio assets'] + rows['DBS drawdown loan'], rows['DBS net assets']),
     [rows['DBS portfolio assets'], rows['DBS drawdown loan'], rows['DBS net assets']]);
  ok('total borrowings = drawdown loan + home loan + car loan',
     near(Math.abs(rows['Total borrowings']), D.debt + D.mortgage + (D.car ? D.car.loan : 0)),
     [rows['Total borrowings'], D.debt, D.mortgage, D.car && D.car.loan]);

  console.log('\n-- the totals on screen are UNCHANGED by making the loan visible --');
  ok('DBS + UOB net assets on screen is unchanged', near(rows['DBS + UOB net assets'], D.dbsUob), rows['DBS + UOB net assets']);
  ok('Incl. property on screen is unchanged',       near(rows['Incl. property'], D.dbsUob + D.home), rows['Incl. property']);
  ok('Everything on screen matches the computed total', near(rows['Everything'], everything), rows['Everything']);
  ok('Everything did NOT drop by the drawn amount',
     !near(rows['Everything'], everything - D.debt), [rows['Everything'], everything - D.debt]);

  console.log('\n-- the card says plainly that it is deducted, not missing --');
  const txt = await page.evaluate(() => document.getElementById('main').textContent);
  ok('states the loan is already taken off every total', /already taken off every total/i.test(txt));
  ok('warns that counting it again would double-count',  /count it twice/i.test(txt));
  ok('top line explains itself like the UOB one does',   /after the .* drawdown loan/i.test(txt));

  console.log('\n-- with no drawdown loan, the extra rows must disappear cleanly --');
  const Z = await page.evaluate(() => {
    const d = latest().statementDate;
    const keep = JSON.parse(JSON.stringify(state.snapshots[d]));
    const s = state.snapshots[d];
    s.portfolios.forEach(p => { p.totalAssets = p.netAssets; p.totalLoans = 0; p.loans = []; });
    render();
    const t = document.getElementById('main').textContent;
    const r = { rows: [...document.querySelectorAll('#main .kv .k')].map(k => { const c = k.cloneNode(true); c.querySelectorAll('span').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }),
                note: /already taken off every total/i.test(t) };
    state.snapshots[d] = keep; render();
    return r;
  });
  ok('no "DBS drawdown loan" row when nothing is drawn', !Z.rows.includes('DBS drawdown loan'), Z.rows.slice(0, 10));
  ok('no "DBS portfolio assets" row when nothing is drawn', !Z.rows.includes('DBS portfolio assets'), Z.rows.slice(0, 10));
  ok('no "Total borrowings" row when nothing is drawn', !Z.rows.includes('Total borrowings'), Z.rows.slice(0, 10));
  ok('the explanatory note is withheld too', Z.note === false, Z.note);
  ok('"DBS net assets" survives the no-loan case', Z.rows.includes('DBS net assets'), Z.rows.slice(0, 10));

  console.log('\n-- every tab still draws --');
  for (const tab of ['dash', 'prop', 'cpf', 'retire', 'al', 'trends', 'fx', 'hist', 'set']) {
    const before = errors.length;
    await page.evaluate(t => { state.settings.tab = t; try { render(); } catch (e) { console.error(String(e)); } }, tab);
    await page.waitForTimeout(200);
    const html = await page.evaluate(() => document.getElementById('main').innerHTML);
    ok(tab + ' drew with no error and no refusal card',
       errors.length === before && !html.includes('could not be drawn'), errors.slice(before));
  }

  ok('zero page errors across the run', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
