/* tagtest.js — the Plain-English contract.

   Fortress had grown to 459 blocks of prose across ten tabs. The first screen of a tab was
   an essay. The fix was not to delete any of it but to say, next to each block, which of
   four things it is — and then let one function route it:

     act     stays on screen. A decision, a deadline, a warning before you press save.
     point   folds into its card's "Why" and competes for the eight one-line points a tab
             may show at a glance.
     how     where the figure came from -> one collapsed block per tab.
     assume  the figure is missing, estimated or unverified -> one collapsed block per tab.

   An earlier build guessed these from the wording with regular expressions. It filed real
   decisions under "assumptions". This suite exists so that never happens silently again:
   every block must carry a tag, nothing may be lost between the two modes, and the eight-
   point budget must actually hold.

   Run: node tagtest.js
*/
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (got !== undefined ? '  got: ' + JSON.stringify(got) : '')); }
};
const TABS = ['dash','prop','car','cpf','retire','al','trends','fx','hist','set'];
const LIMIT = 8;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ timezoneId: 'Asia/Singapore' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(1200);

  /* ---------------------------------------------------------------- every block is tagged */
  console.log('\n-- every block of prose says which of the four things it is --');
  const untagged = await page.evaluate(tabs => {
    const bad = [];
    for (const t of tabs) {
      state.settings.simple = false; state.settings.tab = t; render();
      document.getElementById('main').querySelectorAll('.note, .warnbox').forEach(e => {
        if (e.closest('details.gap') || e.closest('.card.plain')) return;   // structural, not commentary
        const tags = ['act','point','how','assume'].filter(c => e.classList.contains(c));
        if (tags.length !== 1) bad.push([t, tags.length, e.textContent.replace(/\s+/g,' ').trim().slice(0, 70)]);
      });
    }
    return bad;
  }, TABS);
  ok('no block is untagged or double-tagged', untagged.length === 0, untagged.slice(0, 6));

  /* The tags must all actually be in use, or one of them is dead code pretending to work. */
  const used = await page.evaluate(tabs => {
    const c = { act:0, point:0, how:0, assume:0 };
    for (const t of tabs) {
      state.settings.simple = false; state.settings.tab = t; render();
      document.getElementById('main').querySelectorAll('.note, .warnbox').forEach(e => {
        Object.keys(c).forEach(k => { if (e.classList.contains(k)) c[k]++; });
      });
    }
    return c;
  }, TABS);
  ok('all four tags are in use', Object.values(used).every(n => n > 0), used);

  /* A block that is about to be folded away must not be carrying something to do inside it.
     One warnbox on the AL tab did: it said Fortress could not answer a question and then
     listed the questions to put to DBS. Folding the first buried the second. */
  const wrapped = await page.evaluate(tabs => {
    const bad = [];
    for (const t of tabs) {
      state.settings.simple = false; state.settings.tab = t; render();
      document.getElementById('main')
        .querySelectorAll('.note.how, .note.assume, .warnbox.how, .warnbox.assume')
        .forEach(e => { if (e.querySelector('.act')) bad.push([t, e.textContent.replace(/\s+/g,' ').slice(0, 60)]); });
    }
    return bad;
  }, TABS);
  ok('nothing to do is hidden inside something to fold away', wrapped.length === 0, wrapped);

  /* ---------------------------------------------------------- nothing is lost in the cut */
  console.log('\n-- Plain English moves prose, it never deletes it --');
  const both = await page.evaluate(tabs => {
    const out = {};
    for (const t of tabs) {
      const count = simple => {
        state.settings.simple = simple; state.settings.tab = t; render();
        const m = document.getElementById('main');
        return { n: m.querySelectorAll('.note, .warnbox').length,
                 w: m.textContent.trim().split(/\s+/).filter(Boolean).length };
      };
      const full = count(false), plain = count(true);
      out[t] = { full, plain };
    }
    return out;
  }, TABS);
  for (const t of TABS) {
    const { full, plain } = both[t];
    ok(`${t}: every block survives the cut`, plain.n === full.n, [full.n, plain.n]);
  }

  /* ------------------------------------------------------------------ the eight-point cap */
  console.log('\n-- a tab shows at most eight prose points at a glance --');
  const seen = await page.evaluate(tabs => {
    const out = {};
    for (const t of tabs) {
      state.settings.simple = true; state.settings.tab = t; render();
      const m = document.getElementById('main');
      out[t] = {
        heads: m.querySelectorAll('.heads > li').length,
        /* a tagged block is "loud" if a reader meets it without opening anything */
        openAssume: [...m.querySelectorAll('.note.assume, .warnbox.assume')].filter(e => !e.closest('details')).length,
        openHow:    [...m.querySelectorAll('.note.how, .warnbox.how')].filter(e => !e.closest('details')).length,
        openPoint:  [...m.querySelectorAll('.note.point, .warnbox.point')].filter(e => !e.closest('details') && e.parentElement.classList.contains('card')).length,
        sweptAct:   [...m.querySelectorAll('.note.act, .warnbox.act')].filter(e => {
                      const d = e.closest('details.more');
                      return d && /^(Why|What this assumes|How this is worked out)\b/.test(d.querySelector('summary').textContent);
                    }).length,
        foot:       !!m.querySelector('.card.foot'),
        emptyCards: [...m.querySelectorAll('.card')].filter(c => [...c.children].every(k => k.tagName === 'H2')).length
      };
    }
    return out;
  }, TABS);
  for (const t of TABS) ok(`${t}: at most ${LIMIT} points`, seen[t].heads <= LIMIT, seen[t].heads);
  ok('at least one tab actually spends its whole budget', TABS.some(t => seen[t].heads === LIMIT),
     TABS.map(t => seen[t].heads));

  /* ------------------------------------------------- the two drawers, and what belongs in them */
  console.log('\n-- "how" and "assume" leave the first screen; "act" never does --');
  for (const t of TABS) {
    ok(`${t}: no "assume" block on the open screen`, seen[t].openAssume === 0, seen[t].openAssume);
    ok(`${t}: no "how" block on the open screen`, seen[t].openHow === 0, seen[t].openHow);
    ok(`${t}: no card-level "point" on the open screen`, seen[t].openPoint === 0, seen[t].openPoint);
    ok(`${t}: no "act" block is swept into a disclosure`, seen[t].sweptAct === 0, seen[t].sweptAct);
  }

  console.log('\n-- one "What this assumes" and one "How this is worked out" per tab --');
  const foot = await page.evaluate(tabs => {
    const out = {};
    for (const t of tabs) {
      state.settings.simple = true; state.settings.tab = t; render();
      const c = document.querySelector('.card.foot');
      if (!c) { out[t] = null; continue; }
      const sums = [...c.querySelectorAll(':scope > details.more > summary')].map(s => s.textContent);
      out[t] = {
        cards: document.querySelectorAll('.card.foot').length,
        sums,
        /* the count in each summary must equal the blocks inside it */
        counts: [...c.querySelectorAll(':scope > details.more')].map(d => [
          +(d.querySelector('summary').textContent.match(/\((\d+)\)/) || [0,0])[1],
          d.querySelectorAll(':scope > .note, :scope > .warnbox').length ]),
        /* and each run of lines must be introduced by the heading it was lifted from */
        labelled: [...c.querySelectorAll(':scope > details.more')].every(d => {
          const first = [...d.children].find(k => k.tagName !== 'SUMMARY');
          return !!first && first.classList.contains('footsrc');
        }),
        labels: [...c.querySelectorAll('.footsrc')].length,
        /* it sits above the gaps card, not after it */
        beforeGaps: (() => {
          const gaps = [...document.querySelectorAll('.card')].find(x => x.querySelector('details.gap'));
          return gaps ? (c.compareDocumentPosition(gaps) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : null;
        })()
      };
      out[t].closed = [...c.querySelectorAll('details.more')].every(d => !d.open);
    }
    return out;
  }, TABS);
  for (const t of TABS) {
    const f = foot[t];
    if (!f) { ok(`${t}: no footer because it has nothing to put in one`, true); continue; }
    ok(`${t}: exactly one footer card`, f.cards === 1, f.cards);
    ok(`${t}: at most two drawers in it`, f.sums.length <= 2, f.sums);
    ok(`${t}: the drawers are the two named ones`,
       f.sums.every(s => /^(What this assumes|How this is worked out) \(\d+\)$/.test(s)), f.sums);
    ok(`${t}: each drawer's count matches its contents`, f.counts.every(([a,b]) => a === b), f.counts);
    ok(`${t}: every run of lines names the card it came from`, f.labelled, f.labels);
    ok(`${t}: the footer starts closed`, f.closed === true);
    if (f.beforeGaps !== null) ok(`${t}: it sits above the gaps card`, f.beforeGaps === true);
  }

  /* -------------------------------------------------------------- no hollow cards left over */
  console.log('\n-- a card emptied by the cut is removed, not left as a bare heading --');
  for (const t of TABS) ok(`${t}: no heading with nothing under it`, seen[t].emptyCards === 0, seen[t].emptyCards);

  /* ---------------------------------------------------------- the same sentence, ten times */
  console.log('\n-- the gap count is stated once per tab, not three times --');
  const dupes = await page.evaluate(() => {
    const out = {};
    for (const simple of [true, false]) {
      state.settings.simple = simple; state.settings.tab = 'dash'; render();
      const m = document.getElementById('main');
      const shown = [...m.querySelectorAll('.note, .warnbox, p, li')]
        .filter(e => !e.closest('details') || e.closest('details').open)
        .map(e => e.textContent).join(' ');
      out[simple ? 'plain' : 'full'] = {
        hole: (shown.match(/a real hole in the data/g) || []).length,
        anywhere: (m.textContent.match(/a real hole in the data/g) || []).length,
        listed: (m.textContent.match(/listed at the bottom of the page/g) || []).length
      };
    }
    return out;
  });
  ok('Plain English takes the repeated "real hole" sentence off the screen', dupes.plain.hole === 0, dupes.plain.hole);
  ok('but it is still in the page, one tap away', dupes.plain.anywhere === 1, dupes.plain.anywhere);
  ok('Full detail shows it in place', dupes.full.hole === 1, dupes.full.hole);
  ok('the "listed at the bottom" duplicate is gone for good', dupes.plain.listed === 0 && dupes.full.listed === 0, dupes);

  /* ------------------------------------------------------------------- the toggle is clean */
  console.log('\n-- Full detail puts every word back where the view wrote it --');
  const clean = await page.evaluate(tabs => {
    const bad = [];
    for (const t of tabs) {
      state.settings.simple = true;  state.settings.tab = t; render();
      state.settings.simple = false; render();
      const m = document.getElementById('main');
      if (m.querySelector('.card.foot')) bad.push([t, 'footer card survived']);
      if (m.querySelector('.heads')) bad.push([t, 'headline bullets survived']);
      if (m.querySelector('[data-simplified]')) bad.push([t, 'simplified marker survived']);
      /* the two details.more the views author are allowed; ours are not */
      if (m.querySelectorAll('details.more').length > 1) bad.push([t, 'disclosures survived']);
    }
    return bad;
  }, TABS);
  ok('turning it off leaves no trace of the cut', clean.length === 0, clean);

  /* ----------------------------------------------------------------- re-running is harmless */
  const twice = await page.evaluate(() => {
    state.settings.simple = true; state.settings.tab = 'prop'; render();
    const a = document.querySelectorAll('.card.foot').length + ':' + document.querySelectorAll('.heads > li').length;
    simplify(); simplify();
    const b = document.querySelectorAll('.card.foot').length + ':' + document.querySelectorAll('.heads > li').length;
    return [a, b];
  });
  ok('calling simplify() again changes nothing', twice[0] === twice[1], twice);

  /* --------------------------------------------------------------------- the standing rules */
  console.log('\n-- the rules that outlive any one change --');
  const src = require('fs').readFileSync('index.html', 'utf8');
  ok('no NRIC or FIN anywhere in the file', !/[STFGM]\d{7}[A-Z]/.test(src));
  ok('no chassis number', !src.includes('LC0CH6CB0T0128321'));
  ok('no registration plate', !/SPK\s?8566\s?J/.test(src));
  ok('the version stamp was bumped past the tagging build',
     /const VERSION = 'v2026:OCT:0[3-9]-\d\d:\d\d'/.test(src), (src.match(/const VERSION = '[^']+'/)||[])[0]);

  console.log('\n-- no uncaught errors in either mode, on any tab --');
  ok('zero page errors across the run', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + (fail ? `SOME FAILED: ${pass} passed, ${fail} failed` : `ALL PASS: ${pass} passed, 0 failed`));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
