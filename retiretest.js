/* retiretest.js — the housing refund as a source for the ERS top-up (Retire tab).

   The projection, the FRS-vs-BRS fork and the ERS lever already existed. What is new is
   the refund: CPF money locked in the flat, projected to the 55th birthday, and what it
   would and would NOT do for the Enhanced Retirement Sum.

   The rule this suite exists to enforce: the card must tell the truth in BOTH directions.
   If the OA alone covers the headroom, it must say the refund is not needed — not imply
   a sale is required. If it does not, it must show the gap.

   Run: node retiretest.js
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

  const R = await page.evaluate(() => JSON.parse(JSON.stringify(retireAt55())));

  console.log('\n-- the 2028 retirement sums are NOT published, and the app knows it --');
  ok('he turns 55 in 2028',              R.A.year55 === 2028, R.A.year55);
  ok('the FRS for 2028 is flagged unpublished', R.F.published === false, R.F.published);
  ok('it falls back to the last published figure', near(R.F.value, 228200), R.F.value);
  ok('BRS is exactly half the FRS',      near(R.B.value, R.F.value / 2), [R.B.value, R.F.value]);
  ok('ERS is twice the FRS',             near(R.ersRule, R.F.value * 2), [R.ersRule, R.F.value]);

  console.log('\n-- the pledge fork frees exactly one BRS --');
  ok('pledging frees FRS less BRS',      near(R.freed, R.F.value - R.B.value), R.freed);
  ok('which is one BRS',                 near(R.freed, R.B.value), [R.freed, R.B.value]);
  ok('the pledged RA holds only the BRS', near(R.pledged.ra, R.B.value), R.pledged.ra);
  ok('and the freed amount lands in the OA',
     near(R.pledged.oaAfter, R.oaFrs + R.freed), [R.pledged.oaAfter, R.oaFrs, R.freed]);

  console.log('\n-- the refund is projected to the 55th birthday, not held at the statement --');
  ok('a refund figure exists',           R.refund != null, R.refund);
  ok('it is larger than the statement figure',
     R.refund > R.refundAt55.claimAtStatement, [R.refund, R.refundAt55.claimAtStatement]);
  ok('the statement figure is his 505,640.64',
     near(R.refundAt55.claimAtStatement, 505640.64), R.refundAt55.claimAtStatement);
  ok('growth is CPF charging itself the OA rate',
     near(R.refundAt55.ratePct, 2.5), R.refundAt55.ratePct);
  /* the same engine the Property tab uses, so the two tabs cannot disagree */
  const sameEngine = await page.evaluate(() => {
    const a = cpfClaimOn(retireAt55().A.date55);
    return { claim: a.claim, principal: a.principal };
  });
  ok('it comes from cpfClaimOn, not a second model', near(sameEngine.claim, R.refund), [sameEngine.claim, R.refund]);
  ok('principal is unchanged at 502,500', near(sameEngine.principal, 502500), sameEngine.principal);

  console.log('\n-- the ERS arithmetic, and the honest verdict for HIS numbers --');
  ok('headroom is ERS less FRS',         near(R.ersHeadroom, R.ersRule - R.F.value), R.ersHeadroom);
  ok('ersFundable never exceeds the headroom', R.ersFundable <= R.ersHeadroom + 0.005, [R.ersFundable, R.ersHeadroom]);
  ok('the gap after OA is headroom less what OA funds',
     near(R.ersGapAfterOa, Math.max(0, R.ersHeadroom - R.ersFundable)), R.ersGapAfterOa);
  ok('his OA alone covers the whole headroom', R.ersGapAfterOa === 0, R.ersGapAfterOa);
  ok('so the refund contributes nothing to the ERS', near(R.refundUsedForErs, 0), R.refundUsedForErs);
  ok('and the refund is reported as entirely surplus', near(R.refundSurplus, R.refund, 0.02), [R.refundSurplus, R.refund]);
  ok('together never exceeds the headroom', R.ersFundableWithRefund <= R.ersHeadroom + 0.005, R.ersFundableWithRefund);

  console.log('\n-- the card says so, in the direction that is true --');
  await page.evaluate(() => { state.settings.tab = 'retire'; render(); document.querySelectorAll('details').forEach(d => d.open = true); });
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.getElementById('main').textContent);
  const html = await page.evaluate(() => document.getElementById('main').innerHTML);
  ok('the Retire tab draws with no refusal card', !html.includes('could not be drawn'));
  ok('it states the refund changes nothing on the table', /None on the table above/i.test(txt));
  ok('it does NOT claim the refund funds the top-up', !/enough to close it/i.test(txt));
  ok('it reframes the refund as cash, not income', /as cash in your OA, not as income/i.test(txt));
  ok('it refuses to suggest selling',     /Not a suggestion to sell/i.test(txt));
  ok('it says the refund is not new money', /Not new money/i.test(txt));
  ok('it says the refund is unreachable before 55', /Not reachable before 55/i.test(txt));
  ok('it shows the projected refund',     /531,283/.test(txt));
  ok('it shows the statement figure too', /505,64\d/.test(txt));

  console.log('\n-- the rewrite brief: every milestone answers impact and action, briefly --');
  const rows = await page.evaluate(() => retireTimeline().map(r => ({ t: r.title, i: r.impact, a: r.act, n: r.then })));
  ok('every milestone carries an Impact', rows.every(r => r.i && r.i.length > 0), rows.filter(r => !r.i).map(r => r.t));
  ok('every milestone carries a Do',      rows.every(r => r.a && r.a.length > 0), rows.filter(r => !r.a).map(r => r.t));
  const words = s => s.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  /* CK's brief: every Do must carry what FOLLOWS from doing it. A row with no
     consequence is a row that should not be on the page. */
  ok('every milestone carries a consequence', rows.every(r => r.n && r.n.length > 0), rows.filter(r => !r.n).map(r => r.t));
  ok('no consequence line runs past 40 words', rows.every(r => words(r.n) <= 40), rows.map(r => [r.t, words(r.n)]).filter(x => x[1] > 40));
  ok('no Impact line runs past 30 words', rows.every(r => words(r.i) <= 30), rows.map(r => [r.t, words(r.i)]).filter(x => x[1] > 30));
  ok('no Do line runs past 30 words',     rows.every(r => words(r.a) <= 30), rows.map(r => [r.t, words(r.a)]).filter(x => x[1] > 30));
  /* Impact and Do must survive simplify(), which sweeps every .note into a disclosure.
     They use .say precisely so they stay on screen; this is the guard for that. */
  const visible = await page.evaluate(() => {
    state.settings.simple = true; state.settings.tab = 'retire'; render();
    return document.getElementById('main').innerText;
  });
  ok('Impact lines are visible in simple mode', /Impact:/.test(visible));
  ok('Do lines are visible in simple mode',     /Do:/.test(visible));
  ok('So lines are visible in simple mode',     /So:/.test(visible));
  ok('the decision table is visible too',       /Cash at 55/.test(visible));

  console.log('\n-- 2.5% against 4%: the cost of waiting, and the cost of moving --');
  const V = await page.evaluate(() => JSON.parse(JSON.stringify(oaVsRa())));
  ok('the movable amount is the ERS headroom', near(V.movable, 228200.00), V.movable);
  ok('the rest stays in the OA either way',    near(V.staysInOa, 267771.66 - 228200, 0.02), V.staysInOa);
  ok('the gap is 1.5 points',                  near(V.gapPct, 1.5), V.gapPct);
  ok('year one costs 3,423',                   near(V.firstYear, 3423, 1), V.firstYear);
  ok('by 65 it is 45,676',                     near(V.byPayout, 45676, 2), V.byPayout);
  ok('each row recomputes as compound interest',
     V.rows.every(r => Math.abs(r.low - V.movable * Math.pow(1 + V.oaPct / 100, r.years)) < 1 &&
                       Math.abs(r.high - V.movable * Math.pow(1 + V.raPct / 100, r.years)) < 1), 'compounding');
  ok('the difference widens with every row',
     V.rows.every((r, i) => i === 0 || r.diff > V.rows[i - 1].diff), V.rows.map(r => r.diff));
  ok('the extra interest is noted as already absorbed', V.extraAbsorbed === true, V.extraAbsorbed);

  console.log('\n-- and the page states the irreversibility in CPF\'s own words --');
  ok('it says there is no lock-in PERIOD',     /no lock-in/i.test(txt));
  ok('it says the move is permanent',          /permanent/i.test(txt));
  ok('it quotes CPF on irreversibility',       /are irreversible as they are a long-term commitment/i.test(txt));
  ok('it quotes CPF on no other withdrawal',   /cannot be withdrawn for any other purposes/i.test(txt));
  ok('it contrasts the OA, which is free',     /as many withdrawals as you like/i.test(txt));
  ok('the cost-of-waiting table is on the page', /You give up/i.test(txt));
  ok('it reframes the real trade',             /not really 2\.5% against 4\.0%/i.test(txt));

  console.log('\n-- the OPPOSITE case: shrink the OA and the gap language must appear --');
  const G = await page.evaluate(() => {
    const keep = JSON.parse(JSON.stringify(state.cpf));
    const d = Object.keys(state.cpf)[0];
    state.cpf[d].sa = 230000;          // barely over the FRS, so little spills to OA
    state.cpf[d].oa = 5000;
    render();
    const r = JSON.parse(JSON.stringify(retireAt55()));
    state.settings.tab = 'retire'; render();
    const t = document.getElementById('main').textContent;
    const refused = /could not be drawn/.test(document.getElementById('main').innerHTML);
    state.cpf = keep; render();
    return { r, gapShown: /would cover/i.test(t), noSellShown: /None on the table above/i.test(t), refused };
  });
  ok('with a thin OA there IS a gap',     G.r.ersGapAfterOa > 0, G.r.ersGapAfterOa);
  ok('the refund is then actually used',  G.r.refundUsedForErs > 0, G.r.refundUsedForErs);
  ok('the card switches to the gap wording', G.gapShown === true, G.gapShown);
  ok('and drops the "no need to sell" claim', G.noSellShown === false, G.noSellShown);
  ok('the tab still draws in that state', G.refused === false, G.refused);

  console.log('\n-- the real state survives the probe --');
  const again = await page.evaluate(() => JSON.parse(JSON.stringify(retireAt55())));
  ok('back to no gap',                    again.ersGapAfterOa === 0, again.ersGapAfterOa);
  ok('and the refund back to 531,283',    near(again.refund, R.refund, 0.02), again.refund);

  console.log('\n-- every tab still draws --');
  for (const tab of ['dash', 'prop', 'car', 'cpf', 'retire', 'al', 'trends', 'fx', 'hist', 'set']) {
    const b4 = errors.length;
    await page.evaluate(t => { state.settings.tab = t; try { render(); } catch (e) { console.error(String(e)); } }, tab);
    await page.waitForTimeout(120);
    const h = await page.evaluate(() => document.getElementById('main').innerHTML);
    ok(tab + ' drew clean', errors.length === b4 && !h.includes('could not be drawn'), errors.slice(b4));
  }
  ok('zero page errors across the run', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
