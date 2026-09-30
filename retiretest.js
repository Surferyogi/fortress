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
  ok('it states he need not sell to reach the ERS', /do not need to sell the flat/i.test(txt));
  ok('it does NOT claim the refund funds the top-up', !/A sale would close the gap/i.test(txt));
  ok('it reframes the refund as liquidity, not income', /liquidity fact, not a retirement-income one/i.test(txt));
  ok('it refuses to suggest selling',     /not a suggestion to sell/i.test(txt));
  ok('it says the refund is not new money', /not new money/i.test(txt));
  ok('it says the refund is unreachable before 55', /not reachable before 55/i.test(txt));
  ok('it shows the projected refund',     /531,283/.test(txt));
  ok('it shows the statement figure too', /505,640\.64/.test(txt));

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
    return { r, gapShown: /would cover/i.test(t), noSellShown: /do not need to sell the flat/i.test(t), refused };
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
