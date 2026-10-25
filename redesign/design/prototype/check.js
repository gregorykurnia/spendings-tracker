/* Developer check for the prototype (not loaded by the page). Run: node check.js
   No browser: a stub DOM runs the real scripts, renders every state, validates the markup
   and runs the main flows. It can't judge looks; it catches broken markup, missing handlers and logic slips. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = __dirname;

/* ---------- a very small stand-in for the DOM ---------- */
function FakeEl(id) {
  this.id = id || ''; this.dataset = {}; this.innerHTML = ''; this.textContent = ''; this.hidden = false; this.inert = false;
  this.value = ''; this.files = []; this.children = []; this._attrs = {}; this.style = {};
  var cls = {}; this.classList = {add: function (c) { cls[c] = 1; }, remove: function (c) { delete cls[c]; }, toggle: function (c, on) { if (on) cls[c] = 1; else delete cls[c]; }, contains: function (c) { return !!cls[c]; }};
}
['focus','click','remove','scrollIntoView','showPicker','insertAdjacentHTML','addEventListener'].forEach(function (m) { FakeEl.prototype[m] = function () {}; });
FakeEl.prototype.appendChild = function (c) { this.children.push(c); return c; };
FakeEl.prototype.querySelector = function (sel) { return this._sub || (this._sub = new FakeEl()); };
FakeEl.prototype.querySelectorAll = function () { return []; };
FakeEl.prototype.contains = function () { return false; };
FakeEl.prototype.setAttribute = function (k, v) { this._attrs[k] = v; };
FakeEl.prototype.removeAttribute = function (k) { delete this._attrs[k]; };
FakeEl.prototype.getAttribute = function (k) { return this._attrs[k] == null ? null : this._attrs[k]; };

var els = {};
var doc = {
  body: new FakeEl('body'), activeElement: null,
  getElementById: function (id) { return els[id] || (els[id] = new FakeEl(id)); },
  createElement: function () { return new FakeEl(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {}
};
global.window = global;
global.document = doc;
global.location = {hash: '', search: '', pathname: '/index.html'};
global.history = {replaceState: function () {}};
global.matchMedia = function () { return {matches: false}; };
global.scrollTo = function () {};
global.addEventListener = function () {};
['app', 'overlays', 'toast', 'live', 'picker'].forEach(function (i) { doc.getElementById(i); });

['icons', 'data', 'ui', 'capture', 'spending', 'find', 'org', 'app'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), {filename: f + '.js'});
});
var D = window.Daybook;

/* ---------- little test kit ---------- */
var failed = 0, passed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('  FAIL: ' + msg); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function app() { return doc.getElementById('app').innerHTML; }
function formHtml() { var t = D.overlay.top(); return t ? t.cfg.render() : ''; }

var VOID = {input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1};
function validate(html, label) {
  var re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, m, stack = [];
  while ((m = re.exec(html))) {
    var close = m[1] === '/', tag = m[2].toLowerCase(), self = /\/\s*$/.test(m[3]);
    if (VOID[tag] || self) continue;
    if (!close) stack.push(tag);
    else { var top = stack.pop(); if (top !== tag) { ok(false, label + ': </' + tag + '> closes <' + top + '>'); return; } }
  }
  ok(stack.length === 0, label + ': unclosed <' + stack.join('><') + '>');
  ok(!/undefined|NaN|\[object|>null</.test(html), label + ': stray undefined / NaN / null in the markup');
  var ids = {}, dup = null;
  html.replace(/\sid="([^"]+)"/g, function (_, id) { if (ids[id]) dup = id; ids[id] = 1; });
  ok(!dup, label + ': duplicate id ' + dup);
  var keys = {}, dupk = null;
  html.replace(/data-key="([^"]+)"/g, function (_, k) { if (keys[k]) dupk = k; keys[k] = 1; });
  ok(!dupk, label + ': duplicate data-key ' + dupk);
  html.replace(/data-act="([^"]+)"/g, function (_, a) { ok(!!D.acts[a], label + ': no handler for data-act="' + a + '"'); });
  html.replace(/data-in="([^"]+)"/g, function (_, a) { ok(!!D.ins[a], label + ': no handler for data-in="' + a + '"'); });
  html.replace(/aria-controls="([^"]+)"/g, function (_, id) { ok(html.indexOf('id="' + id + '"') >= 0 || /aria-expanded="false"/.test(html), label + ': aria-controls target ' + id + ' missing'); });
  html.replace(/<use href="#i-([a-z-]+)"/g, function (_, n) { ok(D.sprite().indexOf('id="i-' + n + '"') >= 0, label + ': icon ' + n + ' is not in the sprite'); });
  html.replace(/font-size:(\d+)px/g, function (_, n) { ok(+n >= 14, label + ': font-size ' + n + 'px under 14'); });
}
function text(html) { return html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' '); }

(async function () {
  D.stress = false;
  D.route = 'home';

  /* 1. every state renders cleanly */
  console.log('States');
  var STATE_ONLY = D.scenarios.map(function (s) { return s.id; });
  STATE_ONLY.forEach(function (id) {
    D.applyScenario(id, true);
    validate(app(), 'state ' + id);
    var o = D.overlay.top();
    if (o) validate('<div>' + o.cfg.render() + '</div>', 'overlay of ' + id);
    D.overlay.closeAll();
  });
  D.stress = true;
  D.applyScenario('review-fresh', true);
  validate(app(), 'stress review-fresh');
  ok(D.S.waiting.length >= 40, 'stress has many waiting lines');
  D.stress = false;

  /* 2. the default home */
  console.log('Default home');
  D.applyScenario('review-fresh', true);
  var h = app(), t = text(h);
  ok(/7 to check/.test(t), 'title says 7 to check');
  ok(/From 2 screenshots, added just now/.test(t), 'sub-line for a fresh batch');
  ok(/Look right 5/.test(t) && /Need a look 2/.test(t), 'groups and counts');
  ok(/2 need a look/.test(t), 'jump pill');
  ok(/Accept the 5 that look right/.test(t), 'accept bar wording');
  ok(/October so far/.test(t) && /6\.842\.350/.test(t), 'glance total');
  ok(/Rp 475\.650 lower than 1 to 25 September/.test(t), 'glance comparison');
  ok(/From the screenshot/.test(h) && /87\.450,00 DB/.test(h), 'crop in the open row');
  ok(/You already have this one/.test(t) && /Money coming in/.test(t), 'reason lines');
  ok(/Suggested from the store name/.test(t), 'suggestion hint');
  ok(D.S.waiting.filter(function (w) { return D.problems(w).length; }).length === 2, 'two lines need a look');

  /* 3. accept one */
  console.log('Accept one');
  var s = D.S, first = s.waiting[0], savedBefore = s.saved.length;
  D.acts.accept({dataset: {id: first.id}});
  ok(s.ui.accepting.has(first.id), 'row is saving');
  ok(/Accepting INDOMARET/.test(app()), 'saving state shown on the tick');
  await sleep(850);
  ok(s.saved.length === savedBefore + 1, 'saved grew by one');
  ok(s.waiting.length === 6, 'waiting shrank to 6');
  ok(/6 to check/.test(text(app())), 'title now 6 to check');
  ok(/6\.929\.800/.test(text(app())), 'glance total went up by 87.450');

  /* 4. throw away, keep it, it's a spend */
  console.log('Throw away and keep');
  var repeat = s.waiting.filter(function (w) { return w.dupOf; })[0];
  D.acts.keep({dataset: {id: repeat.id}});
  ok(D.problems(repeat).length === 0, 'kept repeat can be accepted');
  ok(/Look right 5/.test(text(app())), 'kept line joined Look right');
  var incoming = s.waiting.filter(function (w) { return w.dir === 'in'; })[0];
  D.acts.keep({dataset: {id: incoming.id}});
  ok(D.problems(incoming).join() === 'category', "incoming line that is a spend still needs a category");
  ok(/No category yet/.test(text(app())), 'category reason shown');
  D.acts.throw({dataset: {id: incoming.id}});
  await sleep(300);
  ok(!s.waiting.some(function (w) { return w.id === incoming.id; }), 'thrown away');

  /* 5. accept all */
  console.log('Accept all');
  var rightN = s.waiting.filter(function (w) { return !D.problems(w).length; }).length;
  D.acts['accept-all']({getAttribute: function () { return null; }});
  ok(s.ui.acceptingAll, 'bar is saving');
  ok(new RegExp('Accepting ' + rightN).test(text(app())), 'bar says Accepting n');
  await sleep(1100);
  ok(s.waiting.length === 0, 'everything accepted');
  ok(/All checked/.test(text(app())) && /Nothing is waiting/.test(text(app())), 'empty state after accepting all');
  ok(/Add screenshots from your banking app/.test(text(app())), 'empty state invites adding');
  validate(app(), 'after accept all');

  /* 6. problem lines */
  console.log('Problem lines');
  D.applyScenario('review-problems', true);
  t = text(app());
  ok(/No amount/.test(t) && /Couldn't read the amount/.test(t), 'no amount shown');
  ok(/Add amount/.test(t) && /Choose category/.test(t), 'fix actions');
  ok(/Need a look 4/.test(t) && /Accept the 5 that look right/.test(t), 'counts with problems');
  var noAmt = D.S.waiting.filter(function (w) { return !(w.amount > 0); })[0];
  D.acts.fix({dataset: {id: noAmt.id, focus: 'amount'}});
  var f = D.form;
  ok(f && f.mode === 'edit-waiting' && f.unread, 'form opened for the unread amount');
  ok(/id="e-amount"[^>]* hidden/.test(formHtml()), 'no error shown before touching');
  ok(/Still needed: amount\./.test(text(formHtml())), 'form says what is still needed');
  ok(/id="f-primary"[^>]*aria-disabled="true"/.test(formHtml()), 'Accept is off while the amount is missing');
  D.ins['f-amount']({value: '132500'});
  ok(f.data.amount === 132500, 'amount typed (R6: kept on the line)');
  ok(noAmt.amount === 132500, 'edit lands on the waiting line itself');
  var el = {value: '12345678'}; D.ins['f-amount'](el); ok(el.value === '12.345.678', 'amount formats with dots');
  el = {value: 'Rp 0'}; D.ins['f-amount'](el); ok(el.value === '' && f.data.amount == null, 'zero is not an amount');
  D.acts['form-submit']();
  ok(f.attempted && /Couldn't read this amount|Enter an amount above Rp 0/.test(text(formHtml())), 'errors show after a try');
  D.ins['f-amount']({value: '132500'});
  D.overlay.closeAll();
  ok(D.problems(noAmt).length === 0, 'line is ready once the amount is typed');
  ok(/Look right 6/.test(text(app())), 'line moved to Look right');

  /* 7. type in a spend */
  console.log('Type in a spend');
  D.acts['type-in']();
  f = D.form;
  ok(f.mode === 'add' && /Type in a spend/.test(formHtml()), 'add form opens');
  ok(/data-autofocus/.test(formHtml()), 'store field takes focus');
  ok(/Still needed: store, amount and category\./.test(text(formHtml())), 'three things needed at first');
  var savedN = D.S.saved.length;
  D.acts['form-submit']();
  ok(f.attempted && D.S.saved.length === savedN, 'not saved while missing things');
  D.ins['f-store']({value: 'WARUNG BU TINI'}); D.ins['f-amount']({value: '25000'}); D.form.data.cat = 'food';
  ok(/id="f-sum" hidden/.test(formHtml()) && /id="f-primary"[^>]*aria-disabled="false"/.test(formHtml()), 'nothing more needed, button on');
  D.acts['form-submit']();
  ok(f.saving, 'saving state');
  await sleep(800);
  ok(D.S.saved.length === savedN + 1 && D.S.saved[savedN].src === 'hand', 'saved as typed in by hand');
  ok(!D.overlay.top(), 'form closed');

  /* 8. category picker */
  console.log('Category picker');
  D.applyScenario('picker', true);
  var pick = D.overlay.top().cfg.render();
  validate('<div>' + pick + '</div>', 'picker');
  ok((pick.match(/data-act="cat-choose"/g) || []).length === 16, 'picker lists all 16 categories');
  var nc = D.S.waiting.filter(function (w) { return !w.cat; })[0];
  D.acts['cat-choose']({dataset: {cat: 'food'}});
  ok(nc.cat === 'food' && !D.overlay.top(), 'category chosen and picker closed');

  /* 9. import, live */
  console.log('Import (live, about 8 seconds)');
  D.applyScenario('import-live', true);
  ok(/Reading 3 screenshots/.test(text(app())) && /Keep this open until it's done/.test(text(app())), 'reading title');
  ok(/aria-disabled="true"/.test(app().split('data-key="add-1"')[1].slice(0, 120)), 'Add is off while reading');
  await sleep(6600);
  t = text(app());
  ok(/Read 2 of 3 screenshots/.test(t), 'two read, one failed: ' + t.slice(0, 200));
  ok(/Couldn't read this one/.test(t) && /Try again/.test(t) && /Type in a spend/.test(t), 'failure row with ways out');
  ok(D.S.waiting.length > 0 && /to check/.test(t), 'lines from the good screenshots are already waiting');
  D.acts['tray-retry']({dataset: {n: '2'}});
  await sleep(2800);
  ok(D.S.imports && D.S.imports.items.every(function (i) { return i.status === 'ok'; }), 'retry read it');
  ok(/Read all 3 screenshots/.test(text(app())), 'summary after all read');
  await sleep(2900);
  ok(D.S.imports === null, 'tray goes away by itself when everything was read');
  validate(app(), 'after import');

  console.log('Failed and nothing found');
  D.applyScenario('import-mixed', true);
  D.acts['tray-dismiss']({dataset: {n: '2'}});
  ok(D.S.imports && D.S.imports.items.length === 2, 'dismissed one');
  D.acts['tray-dismiss']({dataset: {n: '3'}});
  ok(D.S.imports === null, 'tray is gone once nothing is left to handle');
  D.applyScenario('import-failed', true);
  t = text(app());
  ok(/Nothing to check yet/.test(t) && /Nothing added/.test(t) && !/All checked/.test(t), 'failed only: no false "All checked"');

  /* 10. other states */
  console.log('Other states');
  D.applyScenario('review-later', true);
  t = text(app());
  ok(/12 to check/.test(t) && /Oldest is from Thu 22 Oct/.test(t), 'coming back later');
  D.applyScenario('review-saving', true);
  t = text(app());
  ok(/Accepting 5/.test(t), 'frozen saving state');
  D.applyScenario('form-notready', true);
  t = text(formHtml());
  ok(/Add the store name/.test(t) && /Enter an amount above Rp 0/.test(t) && /Choose a category/.test(t), 'not ready: every missing field named');
  D.overlay.closeAll();
  D.applyScenario('form-saving', true);
  ok(/Accepting…/.test(text(formHtml())), 'form saving label');
  D.overlay.closeAll();
  D.applyScenario('form-saved', true);
  ok(/Change spend/.test(text(formHtml())) && /Save changes/.test(text(formHtml())), 'change-a-saved-spend variant');
  D.overlay.closeAll();

  /* ---------- group 2: understand ---------- */
  console.log('Period maths');
  var P = D.period('week', '2026-10-21', '2026-10-21');
  ok(P.from === '2026-10-19' && P.to === '2026-10-25' && P.running && P.end === '2026-10-21', 'a running week runs Monday to Sunday and counts to today');
  var PP = D.prevPeriod(P);
  ok(PP.from === '2026-10-12' && PP.end === '2026-10-14', 'like for like: the same 3 days of the week before');
  var M = D.period('month', '2026-03-31', '2026-03-31'), MP = D.prevPeriod(M);
  ok(M.running === false && MP.from === '2026-02-01' && MP.end === '2026-02-28', 'last day of a month compares with the whole month before');
  var M2 = D.period('month', '2026-03-30', '2026-03-30'), MP2 = D.prevPeriod(M2);
  ok(M2.running && MP2.end === '2026-02-28', 'a shorter month before is clamped');
  ok(D.spanLabel(D.prevPeriod(D.period('month', '2026-10-25', '2026-10-25')), '2026-10-25') === '1 to 25 September', 'span label, running month');
  ok(D.spanLabel(D.prevPeriod(D.period('month', '2026-09-15', '2026-10-25')), '2026-10-25') === 'August', 'span label, whole month');
  ok(D.compare(100, 0, D.prevPeriod(P), '2026-10-21').kind === 'none', 'no earlier spending: nothing to compare');

  console.log('Spending, this month');
  D.applyScenario('spend-month', true);
  var sh = app(); t = text(sh);
  validate(sh, 'spending');
  ok(D.route === 'spending', 'state opens the Spending screen');
  ok(/Spending/.test(t) && /October 2026/.test(t) && /October so far/.test(t), 'title, period and hero label');
  ok(/Rp 6\.842\.350/.test(t) || /6\.842\.350/.test(t), 'total');
  ok(/Rp 475\.650 lower/.test(t) && /1 to 25 September was Rp 7\.318\.000/.test(t), 'comparison and the earlier total (U2)');
  var homeGlance = text(D.glance());
  ok(/Rp 475\.650 lower than 1 to 25 September/.test(homeGlance) && /6\.842\.350/.test(homeGlance), 'home glance agrees with the Spending screen');
  var agg = D._sp.agg;
  ok(agg.total === 6842350, 'aggregate total');
  ok(agg.cats.reduce(function (n, c) { return n + c.amount; }, 0) === agg.total, 'categories add up to the total (U3)');
  ok(agg.cats.every(function (c, i, a) { return i === 0 || a[i - 1].amount >= c.amount; }), 'categories biggest first');
  ok(agg.days.length === 31 && agg.days.filter(function (d) { return d.future; }).length === 6, 'a running month shows 31 slots, 6 not yet');
  ok(agg.days.reduce(function (n, d) { return n + d.amount; }, 0) === agg.total, 'days add up to the total (U4)');
  ok(agg.biggest.length === 5 && agg.biggest.every(function (x, i, a) { return i === 0 || a[i - 1].amount >= x.amount; }), 'five biggest, biggest first (U5)');
  ok((sh.match(/class="cat-line"/g) || []).length === 5 && /Show \d+ more/.test(t), 'top five categories, then a way to show the rest');
  ok(/Biggest day/.test(t), 'the biggest day is tagged (spikes)');
  ok(/href="#\/transactions\?cat=[a-z]+&from=2026-10-01&to=2026-10-25/.test(sh), 'category rows link to their spends (U7)');
  D.acts['cats-all']();
  ok((app().match(/class="cat-line"/g) || []).length === agg.cats.length && /Show fewer/.test(text(app())), 'show all categories');

  console.log('Spending, week and navigation (U6)');
  D.applyScenario('spend-week', true);
  t = text(app());
  ok(/19 to 25 Oct 2026/.test(t) && /This week/.test(t), 'current week, Monday to Sunday');
  ok(/12 to 18 Oct was Rp/.test(t), 'week compares with the week before');
  ok(D._sp.agg.days.length === 7 && /Mon/.test(app()) && /Sun/.test(app()), 'seven days with weekday labels');
  var sp = D.spend();
  D.acts['period-step']({getAttribute: function () { return 'true'; }, dataset: {d: '1'}});
  ok(sp.anchor === '2026-10-25', 'later is off in the current week');
  D.acts['period-step']({getAttribute: function () { return null; }, dataset: {d: '-1'}});
  ok(sp.anchor === '2026-10-18' && /12 to 18 Oct 2026/.test(text(app())) && !/This week/.test(text(app())), 'one week earlier');
  ok(/Back to this week/.test(text(app())), 'a way back to the current week');
  D.acts['set-mode']({dataset: {mode: 'month'}});
  ok(sp.mode === 'month' && /October 2026/.test(text(app())), 'week to month stays around the same date');
  D.acts['period-step']({getAttribute: function () { return null; }, dataset: {d: '-1'}});
  t = text(app());
  ok(/September 2026/.test(t) && /Rp 8\.240\.000|August was/.test(t), 'a finished month compares with the whole month before');
  ok(/September/.test(t) && !/so far/.test(t), 'finished month has no "so far"');
  D.acts['set-mode']({dataset: {mode: 'week'}});
  ok(sp.anchor.slice(0, 7) === '2026-09' && /Sep 2026/.test(text(app())), 'month to week stays in September');
  D.acts['set-mode']({dataset: {mode: 'month'}});
  D.acts['period-now']();
  ok(sp.anchor === '2026-10-25' && /October so far/.test(text(app())), 'back to this month');

  console.log('Spending, empty and nothing to compare');
  D.applyScenario('spend-first', true);
  t = text(app());
  ok(/August 2026/.test(t) && /Nothing to compare with/.test(t) && /No spending in July/.test(t), 'August: nothing to compare with');
  ok(/Where it went/.test(t), 'August still shows its categories');
  D.applyScenario('spend-none', true);
  t = text(app());
  validate(app(), 'spend-none');
  ok(/Nothing spent in July 2026/.test(t) && /Rp 0/.test(t) || /Nothing spent in July 2026/.test(t), 'a month with nothing says so');
  ok(!/Where it went/.test(t) && !/Day by day/.test(t), 'no empty charts');
  ok(/7 lines are still waiting to be checked/.test(t) && /Go and check them/.test(t), 'points at what is still waiting');

  console.log('Day by day (U4)');
  D.applyScenario('spend-month', true);
  var days = D._sp.agg.days, big = days.reduce(function (m, d) { return d.amount > m.amount ? d : m; }, days[0]);
  ok(new RegExp(D.dshort(big.date).replace(/ /g, ' ') + '.*' + D.rp(big.amount).replace(/\./g, '\\.')).test(text(app())), 'the readout starts on the biggest day with its exact amount');
  D.acts['day-step']({getAttribute: function () { return null; }, dataset: {d: '-1'}});
  ok(D.spend().sel === days[days.indexOf(big) - 1].date, 'stepping to the day before');
  var chartEl = {getBoundingClientRect: function () { return {left: 0, width: 310}; }, setPointerCapture: function () {}};
  var ev = function (type, x) { return {type: type, clientX: x, pointerId: 1, pointerType: 'touch', target: {closest: function () { return chartEl; }}}; };
  D.chartPointer(ev('pointerdown', 5));
  ok(D.spend().sel === '2026-10-01', 'touching the left edge picks day 1');
  D.chartPointer(ev('pointermove', 309));
  ok(D.spend().sel === '2026-10-25', 'sliding to the right edge stops at today, not a day to come');
  D.chartPointer(ev('pointerup', 309));
  D.chartPointer(ev('pointermove', 100));
  ok(D.spend().sel === '2026-10-25', 'after letting go, moving does nothing for touch');
  D.applyScenario('spend-quiet', true);
  ok(/Nothing spent/.test(text(app())) && /Wed 7 Oct|Tue 7 Oct/.test(text(app())), 'a day with no spending says "Nothing spent"');
  ok(/class="day on zero"/.test(app()), 'the empty day is selected and drawn as a flat mark');
  ok(!/Biggest day/.test(text(app())), 'no biggest-day tag on an empty day');

  console.log('Category to its spends (U7) and a spend to its form (U8)');
  D.applyScenario('spend-category', true);
  ok(D.route === 'transactions', 'state opens the list');
  t = text(app());
  validate(app(), 'category list');
  var foodTotal = D.S.saved.filter(function (x) { return x.cat === 'food' && x.date >= '2026-10-01' && x.date <= '2026-10-25'; }).reduce(function (n, x) { return n + x.amount; }, 0);
  ok(/Food & Drink/.test(t) && /October so far/.test(t) && new RegExp(D.rp(foodTotal).replace(/\./g, '\\.')).test(t), 'header shows the category, the period and its total');
  var listed = (app().match(/data-act="open-tx"/g) || []).length;
  ok(listed === D.S.saved.filter(function (x) { return x.cat === 'food' && x.date >= '2026-10-01' && x.date <= '2026-10-25'; }).length, 'the list holds exactly that category in that period');
  var firstTx = app().match(/data-act="open-tx" data-id="(t\d+)"/)[1];
  D.acts['open-tx']({dataset: {id: firstTx}});
  ok(D.form && D.form.mode === 'edit-saved' && D.form.id === firstTx, 'tapping a spend opens it to check or correct');
  D.form.data.cat = 'groceries';
  D.acts['form-submit']();
  await sleep(800);
  ok(!new RegExp('data-id="' + firstTx + '"').test(app()) && D.S.saved.filter(function (x) { return x.id === firstTx; })[0].cat === 'groceries', 'a corrected category leaves this list');
  D.applyScenario('spend-open', true);
  ok(D.route === 'spending' && D.form && D.form.mode === 'edit-saved', 'a biggest spend opens its form');
  var tx0 = D.S.saved.filter(function (x) { return x.id === D.form.id; })[0], amt0 = tx0.amount, amt1 = Math.round(amt0 / 2 / 500) * 500;
  D.ins['f-amount']({value: String(amt1)});
  D.acts['form-submit']();
  await sleep(800);
  ok(tx0.amount === amt1, 'the amount was corrected');
  ok(D.summary('month', D.S.today).total === 6842350 - (amt0 - amt1), 'the totals follow the correction');

  console.log('Stress data');
  D.stress = true;
  D.applyScenario('spend-month', true);
  validate(app(), 'stress spending');
  ok(!/class="hero-a long"/.test(app()), 'a 9-digit total keeps the normal size');
  D.S.saved.push({id: 'tBig', date: '2026-10-20', store: 'X', amount: 2000000000, cat: 'biz', note: '', src: 'hand'});
  D.render();
  ok(/class="hero-a long"/.test(app()), 'a 10-digit total gets a smaller size');
  ok(/No category/.test(text(app())) || D._sp.agg.cats.some(function (c) { return c.id === 'none'; }), 'transactions whose category is gone are grouped as "No category"');
  D.applyScenario('spend-all', true);
  validate(app(), 'stress all categories');
  D.params = {cat: 'none', from: '2026-09-01', to: '2026-10-25', label: 'x', back: 'spending'}; D.route = 'transactions';
  validate(D.screens.transactions.render(), 'stress list');
  D.stress = false;

  /* ---------- group 3: find and fix ---------- */
  function page() { return D.screens.transactions.render(); }
  function rowsOf(h) { return (h.match(/data-act="open-tx" data-id="(t\d+)"/g) || []).map(function (m) { return m.match(/t\d+/)[0]; }); }
  function byId(id) { return D.S.saved.filter(function (x) { return x.id === id; })[0]; }

  console.log('All transactions');
  D.applyScenario('find-all', true);
  var all = D.S.saved.length, ph = page();
  validate(app(), 'find-all');
  t = text(ph);
  ok(D.route === 'transactions' && /All transactions/.test(t), 'opens All transactions');
  ok(new RegExp(all + ' spends').test(t), 'count of everything');
  var ids = rowsOf(ph);
  ok(ids.length === 60, 'first 60 rows, then "Show more"');
  ok(/Show 60 more/.test(t), 'show more');
  var ds = ids.map(function (i) { return byId(i).date; });
  ok(ds.every(function (d, i) { return i === 0 || ds[i - 1] >= d; }), 'newest first');
  var r0 = byId(ids[0]);
  ok(new RegExp(D.catById(r0.cat).name.replace('&', '&amp;') + '|' + D.catById(r0.cat).name).test(ph.replace(/&amp;/g, '&')), 'a row names its category');
  ok(/class="cat-em" style="background:#[0-9A-F]{6}" aria-hidden="true">[^<]+<\/span><span class="tx-main">/.test(ph), 'a row carries the category emoji on its colour');
  ok(/From a screenshot/.test(ph) && /Typed in/.test(ph), 'a row says whether it was imported (F5)');
  D.acts['f-more']();
  ok(rowsOf(page()).length === 120, 'show more adds 60');

  console.log('Search (F1)');
  D.applyScenario('find-search', true);
  ph = page(); t = text(ph);
  var want = D.S.saved.filter(function (x) { return (x.store + ' ' + (x.note || '')).toLowerCase().indexOf('kopi') >= 0; });
  ok(want.length > 3 && rowsOf(ph).length === Math.min(60, want.length), 'every spend with "kopi" in its store or note: ' + want.length);
  ok(/<mark>/i.test(ph) && /<mark>kopi<\/mark>|<mark>KOPI<\/mark>/i.test(ph), 'matches are highlighted');
  D.ins.fq({value: 'kopi coffee'});
  var two = D.S.saved.filter(function (x) { var h = (x.store + ' ' + (x.note || '')).toLowerCase(); return h.indexOf('kopi') >= 0 && h.indexOf('coffee') >= 0; });
  ok(rowsOf(page()).length === two.length, 'two words: both must match (' + two.length + ')');
  D.ins.fq({value: 'KoPi'});
  ok(rowsOf(page()).length === Math.min(60, want.length), 'case does not matter');
  D.ins.fq({value: '(*['});
  ok(/No spends match/.test(text(page())), 'odd characters do not break the search');
  ok(!/<mark>/.test(page()), 'no highlights without a match');

  console.log('Filters (F2) and clearing (F3)');
  D.applyScenario('find-all', true);
  var f = D.find();
  f.cats = ['food'];
  var manual = function (fn) { return D.S.saved.filter(fn).length; };
  var cntText = function () { var m = text(page()).match(/(\d+) spends?/); return m ? +m[1] : -1; };
  ok(cntText() === manual(function (x) { return x.cat === 'food'; }), 'one category');
  f.cats = ['food', 'groceries'];
  ok(cntText() === manual(function (x) { return x.cat === 'food' || x.cat === 'groceries'; }), 'two categories (or)');
  f.date = {kind: 'custom', anchor: D.S.today, from: '2026-10-01', to: '2026-10-25', label: ''};
  ok(cntText() === manual(function (x) { return (x.cat === 'food' || x.cat === 'groceries') && x.date >= '2026-10-01' && x.date <= '2026-10-25'; }), 'plus a date range');
  f.min = 50000; f.max = 150000;
  ok(cntText() === manual(function (x) { return (x.cat === 'food' || x.cat === 'groceries') && x.date >= '2026-10-01' && x.date <= '2026-10-25' && x.amount >= 50000 && x.amount <= 150000; }), 'plus an amount range');
  f.src = 'hand';
  ok(cntText() === manual(function (x) { return (x.cat === 'food' || x.cat === 'groceries') && x.date >= '2026-10-01' && x.date <= '2026-10-25' && x.amount >= 50000 && x.amount <= 150000 && x.src === 'hand'; }), 'plus the source');
  t = text(page());
  ok((page().match(/data-act="unfilter"/g) || []).length === 4, 'four filters, four chips');
  ok(/Food &amp; Drink, Groceries|Food & Drink, Groceries/.test(page()) || /Food & Drink, Groceries/.test(t), 'a chip names the categories');
  ok(/1 to 25 Oct 2026/.test(t) && /Rp 50\.000 to Rp 150\.000/.test(t) && /Typed in/.test(t), 'chips for the dates, the amounts and the source');
  ok(/data-key="f-clear"/.test(page()), 'one button clears them all');
  D.acts.unfilter({dataset: {k: 'amt'}});
  ok(f.min == null && f.max == null && (page().match(/data-act="unfilter"/g) || []).length === 3, 'removing one chip leaves the others');
  D.acts['f-clear']({getAttribute: function () { return null; }});
  ok(!f.cats.length && f.date.kind === 'all' && f.src === 'any' && !/data-act="unfilter"/.test(page()), 'clear all');
  ok(cntText() === all, 'everything is back');
  ok(/id="f-badge" hidden/.test(page()), 'no filters, no badge');

  console.log('Order (F4)');
  f.sort = 'amt-desc';
  var am = rowsOf(page()).map(function (i) { return byId(i).amount; });
  ok(am.every(function (a, i) { return i === 0 || am[i - 1] >= a; }) && am[0] === Math.max.apply(null, D.S.saved.map(function (x) { return x.amount; })), 'highest amount first');
  f.sort = 'amt-asc';
  am = rowsOf(page()).map(function (i) { return byId(i).amount; });
  ok(am.every(function (a, i) { return i === 0 || am[i - 1] <= a; }), 'lowest amount first');
  f.sort = 'date-asc';
  ds = rowsOf(page()).map(function (i) { return byId(i).date; });
  ok(ds.every(function (d, i) { return i === 0 || ds[i - 1] <= d; }), 'oldest first');
  f.sort = 'date-desc';

  console.log('No results');
  D.applyScenario('find-none', true);
  t = text(page());
  validate(app(), 'find-none');
  ok(/0 spends/.test(t) && /No spends match/.test(t) && /Nothing for “zzz” with 1 filter on/.test(t), 'says what it was looking for');
  ok(/Clear search and filters/.test(t), 'one way out');
  D.acts['f-clear-all']();
  ok(D.find().q === '' && D.find().cats.length === 0 && cntText() === all, 'clear search and filters');

  console.log('Filters sheet');
  D.applyScenario('find-sheet', true);
  var sheet = D.overlay.top().cfg.render();
  validate('<div>' + sheet + '</div>', 'filters sheet');
  ok(D.overlay.top().cfg.key === 'filters', 'sheet open');
  ok(/Dates/.test(text(sheet)) && /Categories/.test(text(sheet)) && /Amount/.test(text(sheet)) && /Source/.test(text(sheet)), 'four groups');
  ok((sheet.match(/data-act="f-cat"/g) || []).length === 16, 'all sixteen categories to pick from');
  ok(/aria-pressed="true"[^>]*data-act="f-cat" data-cat="food"/.test(sheet), 'chosen categories are pressed');
  ok(/19 to 25 Oct 2026/.test(text(sheet)), 'a week is chosen by its Monday-to-Sunday range');
  var nShown = (text(sheet).match(/Show (\d+) spends?/) || [])[1];
  ok(+nShown === results_count(), 'the button says how many it will show: ' + nShown);
  function results_count() { var f2 = D.find(); return D.S.saved.filter(function (x) { var r = {from: '2026-10-19', to: '2026-10-25'}; return (f2.cats.indexOf(x.cat) >= 0) && x.date >= r.from && x.date <= r.to; }).length; }
  D.acts['f-step']({getAttribute: function () { return null; }, dataset: {d: '-1'}});
  ok(/12 to 18 Oct 2026/.test(text(D.overlay.top().cfg.render())), 'earlier week');
  D.acts['f-kind']({dataset: {k: 'month'}});
  ok(/October 2026/.test(text(D.overlay.top().cfg.render())), 'a month');
  D.acts['f-kind']({dataset: {k: 'day'}});
  ok(/Sun 18 Oct 2026/.test(text(D.overlay.top().cfg.render())), 'a day (the Sunday we were on)');
  D.acts['f-kind']({dataset: {k: 'custom'}});
  ok(D.find().date.kind === 'custom' && D.find().date.from === D.find().date.to, 'custom starts from the day you were on');
  D.ins.ffrom({value: '2026-10-20'}); D.ins.fto({value: '2026-10-10'});
  ok(/The end is before the start/.test(text(D.overlay.top().cfg.render())) && /No spends match/.test(text(D.overlay.top().cfg.render())), 'a backwards range says so and finds nothing');
  D.acts['f-kind']({dataset: {k: 'all'}});
  D.acts['f-cat']({dataset: {cat: 'food'}}); D.acts['f-cat']({dataset: {cat: 'groceries'}});
  ok(D.find().cats.length === 0, 'tapping a chosen category again turns it off');
  var minEl = {value: '1500000'}; D.ins.fmin(minEl);
  ok(minEl.value === '1.500.000' && D.find().min === 1500000, 'amount fields format as you type');
  D.acts['f-src']({dataset: {s: 'hand'}});
  ok(D.find().src === 'hand', 'source');
  D.acts['f-show']({getAttribute: function () { return 'false'; }});
  ok(!D.overlay.top(), 'Show closes the sheet');
  ok(/data-act="unfilter"/.test(page()), 'the filters now show as chips');

  console.log('Missing category');
  D.applyScenario('find-missing', true);
  ph = page(); t = text(ph);
  validate(app(), 'find-missing');
  ok(/No category/.test(t) && (ph.match(/class="fx-none"/g) || []).length === 4, 'rows without a category say so, in the alert colour');
  var missingId = rowsOf(ph)[0];
  D.acts['open-tx']({dataset: {id: missingId}});
  var fh = formHtml(); t = text(fh);
  ok(/That category was removed\. Choose another\./.test(t) && !/id="e-cat"[^>]* hidden/.test(fh), 'the form says the category was removed');
  ok(!/class="chip on"|class="chip opt4 on"/.test(fh), 'no category looks chosen');
  ok(/id="f-primary"[^>]*aria-disabled="true"/.test(fh), 'cannot save until one is chosen');
  D.form.data.cat = 'food';
  D.acts['form-submit']();
  await sleep(800);
  ok(D.S.saved.filter(function (x) { return x.id === missingId; })[0].cat === 'food', 'saved with a new category');
  ok(rowsOf(page()).indexOf(missingId) < 0 && rowsOf(page()).length === 3, 'it leaves the "No category" list');
  ok(D.find().cats.indexOf('none') >= 0, 'No category stays on as a filter until cleared');

  console.log('Delete (F7)');
  D.applyScenario('find-form', true);
  fh = formHtml(); t = text(fh);
  ok(/Added from a screenshot/.test(t) && /Delete this spend/.test(t), 'the form says where it came from and offers delete');
  var delId = D.form.id, delTx = byId(delId), before = D.S.saved.length, octBefore = D.summary('month', D.S.today).total;
  D.acts['tx-delete']();
  ok(D.overlay.top().cfg.key === 'confirm', 'one confirmation');
  var ch = D.overlay.top().cfg.render(); t = text(ch);
  validate('<div>' + ch + '</div>', 'confirm');
  ok(/Delete this spend\?/.test(t) && t.indexOf(delTx.store) >= 0 && /stops counting in your totals/.test(t), 'it shows what will go');
  ok(/data-autofocus>Cancel|data-autofocus/.test(ch.split('del-cancel')[0] + ch.split('del-cancel')[1]), 'focus starts on the safe button');
  D.acts['ov-close']();
  ok(D.overlay.top().cfg.key === 'form' && D.S.saved.length === before, 'cancel keeps it');
  D.acts['tx-delete']();
  D.acts['tx-delete-yes']();
  ok(D.del.busy && /Deleting…/.test(text(D.overlay.top().cfg.render())), 'deleting in progress');
  D.acts['ov-close']();
  ok(D.overlay.top() && D.overlay.top().cfg.key === 'confirm', 'cannot back out while it is being deleted');
  await sleep(900);
  ok(D.S.saved.length === before - 1 && !byId(delId), 'gone for good');
  ok(!D.overlay.top() && D.del === null && D.form === null, 'both sheets closed');
  ok(D.summary('month', D.S.today).total === octBefore - (delTx.date >= '2026-10-01' ? delTx.amount : 0), 'the totals no longer count it');
  ok(rowsOf(page()).indexOf(delId) < 0, 'and the list no longer shows it');
  D.applyScenario('find-deleting', true);
  ok(D.del.busy && /Deleting…/.test(text(D.overlay.top().cfg.render())), 'the deleting state can be shown on its own');
  D.overlay.closeAll();

  console.log('Arriving at All transactions');
  D.applyScenario('spend-category', true);
  ph = page(); t = text(ph);
  ok(/Food & Drink/.test(t) && /October so far/.test(t), 'from Spending: the category and the period are already on');
  ok(D.find().cats.join() === 'food' && D.find().date.from === '2026-10-01', 'as filters, not as a different screen');
  ok(/href="#\/spending"[^>]*>[^<]*<svg[^>]*>.*Spending/.test(app().replace(/\n/g, '')) || /Spending<\/a>/.test(app()), 'back goes to Spending');
  D.params = {focus: 'search'}; D._searchFocused = false;
  D.screens.transactions.render(); D.screens.transactions.after();
  ok(D._searchFocused === true, 'the search icon puts the cursor in the search box');
  D.params = {}; D.route = 'transactions';
  ok(D.find().cats.length === 0 && D.find().date.kind === 'all', 'from a menu it starts with nothing filtered');
  D.params = {};

  console.log('Stress data on the list');
  D.stress = true;
  D.applyScenario('find-all', true);
  validate(app(), 'stress find-all');
  ok(/No category/.test(page()), 'stress: rows with a missing category show it');
  D.applyScenario('find-search', true);
  D.ins.fq({value: 'INDOMARET*POINT'});
  validate(app(), 'stress search');
  ok(/<mark>INDOMARET\*POINT<\/mark>/.test(page()), 'a long name with no spaces is found and highlighted');
  D.stress = false;

  /* ---------- group 4: organise ---------- */
  var T1 = {getAttribute: function () { return null; }};
  function usedBy(id) { return D.S.saved.filter(function (x) { return x.cat === id; }).length; }
  function catRows() { return (app().match(/data-act="cat-edit" data-id="([a-z0-9]+)"/g) || []).map(function (m) { return m.match(/data-id="([a-z0-9]+)"/)[1]; }); }

  console.log('Categories (O1 list, O5)');
  D.applyScenario('org-list', true);
  validate(app(), 'org-list');
  t = text(app());
  ok(D.route === 'categories' && /Categories/.test(t) && /16 categories/.test(t), 'opens Categories with a count');
  ok(catRows().length === 16 && catRows()[0] === 'groceries', 'sixteen starter categories, in the owner\'s order');
  ok(D.S.cats.every(function (c) { return new RegExp((usedBy(c.id) ? D.dots(usedBy(c.id)) + ' spends?' : 'No spends yet')).test(t); }), 'each says how many spends it has');
  ok(/No spends yet/.test(t) && usedBy('invest') === 0, 'a category nobody uses says so');
  ok(/Tap one to change it/.test(t), 'says how to change one');
  ok(D.S.cats.length === 16 && D.S.cats.every(function (c) { return D.SWATCHES[c.sw]; }), 'every starter has an emoji and a colour');

  console.log('Order (O4)');
  D.acts['cat-reorder']();
  validate(app(), 'reorder on');
  ok(/Quick choices end here/.test(app()) && /The first four are the quick choices/.test(text(app())), 'reorder mode explains the first four');
  ok((app().match(/data-act="cat-move"/g) || []).length === 32 && !/data-act="cat-edit"/.test(app()), 'arrows instead of rows you tap');
  ok(/data-d="-1" data-key="mv-groceries-up"[^>]*aria-disabled="true"/.test(app()), 'the first cannot go up');
  ok(/data-d="1" data-key="mv-other-down"[^>]*aria-disabled="true"/.test(app()), 'the last cannot go down');
  D.acts['cat-move']({getAttribute: function () { return null; }, dataset: {id: 'health', d: '-1'}});
  ok(D.S.cats[5].id === 'health' && D.S.cats[6].id === 'home', 'moved up one');
  for (var k = 0; k < 5; k++) D.acts['cat-move']({getAttribute: function () { return null; }, dataset: {id: 'health', d: '-1'}});
  ok(D.S.cats[0].id === 'health', 'moved to the top');
  D.acts['cat-move']({getAttribute: function () { return 'true'; }, dataset: {id: 'health', d: '-1'}});
  ok(D.S.cats[0].id === 'health' && D.S.cats.length === 16, 'a disabled arrow does nothing');
  D.acts['cat-reorder']();
  ok(!/Quick choices end here/.test(app()) && /Change order/.test(text(app())), 'done');
  D.S.waiting = []; D.batchFor(D.S);
  ok(catChipIds().slice(0, 1)[0] === 'health', 'the new first category is the first quick choice when checking a spend');
  function catChipIds() { var w = D.S.waiting[0]; D.S.ui.openId = w.id; D.route = 'home'; return (D.screens.home.render().match(/data-act="set-cat" data-id="w\d+" data-cat="([a-z]+)"/g) || []).map(function (m) { return m.match(/data-cat="([a-z]+)"/)[1]; }); }
  D.route = 'categories';
  D.acts['cat-edit'] = D.acts['cat-edit'];
  D.openCatPicker({kind: 'line', id: D.S.waiting[0].id});
  ok(D.overlay.top().cfg.render().indexOf('data-cat="health"') < D.overlay.top().cfg.render().indexOf('data-cat="groceries"'), 'and first in the full list');
  D.overlay.closeAll();

  console.log('Add (O2)');
  D.applyScenario('org-add', true);
  var cf = D.catform;
  validate('<div>' + D.overlay.top().cfg.render() + '</div>', 'add form');
  var useCount = function (k) { return D.S.cats.filter(function (c) { return c.sw === k; }).length; };
  var least = Math.min.apply(null, Object.keys(D.SWATCHES).map(useCount));
  ok(cf.mode === 'add' && cf.data.name === '' && cf.data.emoji && useCount(cf.data.sw) === least, 'starts empty with a default emoji and the colour used least so far');
  t = text(D.overlay.top().cfg.render());
  ok(/Still needed: a name\./.test(t), 'only the name is missing');
  ok((D.overlay.top().cfg.render().match(/class="swatch( on)?"/g) || []).length === 13 && /role="radiogroup"/.test(D.overlay.top().cfg.render()), 'thirteen colours to choose from');
  ok(/id="cf-primary"[^>]*aria-disabled="true"/.test(D.overlay.top().cfg.render()), 'save is off without a name');
  D.acts['cf-submit']();
  ok(cf.attempted && /Add a name\./.test(text(D.overlay.top().cfg.render())) && !/id="e-cname"[^>]* hidden/.test(D.overlay.top().cfg.render()), 'trying shows the error');
  D.ins['cf-name']({value: 'food & drink'});
  ok(Object.keys(D.invalidCat(cf)).join() === 'name' && /already have a category called/.test(D.invalidCat(cf).name), 'a repeated name is refused, whatever its capitals');
  D.ins['cf-name']({value: 'Pets'});
  ok(Object.keys(D.invalidCat(cf)).length === 0, 'a new name is fine');
  var inEl = {value: '🐶🐱'}; D.ins['cf-emoji'](inEl);
  ok(cf.data.emoji === '🐶' && inEl.value === '🐶', 'typing two emoji keeps the first');
  inEl = {value: '👨‍👩‍👧'}; D.ins['cf-emoji'](inEl);
  ok(cf.data.emoji === '👨‍👩‍👧', 'a family emoji counts as one');
  inEl = {value: 'ab'}; D.ins['cf-emoji'](inEl);
  ok(D.invalidCat(cf).emoji === 'Choose an emoji.', 'letters are not an emoji');
  D.acts['cf-emoji']({dataset: {e: '🐶'}});
  D.acts['cf-sw']({dataset: {sw: 'lime'}});
  var nCats = D.S.cats.length;
  D.acts['cf-submit']();
  ok(cf.saving, 'saving');
  await sleep(750);
  var added = D.S.cats[D.S.cats.length - 1];
  ok(D.S.cats.length === nCats + 1 && added.name === 'Pets' && added.emoji === '🐶' && added.sw === 'lime', 'added at the end with what was chosen');
  ok(!D.overlay.top() && catRows().indexOf(added.id) === 15 + 1, 'form closed and it is in the list');
  ok(/No spends yet/.test(text(app())), 'with no spends yet');

  console.log('Change (O3): it shows everywhere');
  D.applyScenario('org-edit', true);
  cf = D.catform;
  validate('<div>' + D.overlay.top().cfg.render() + '</div>', 'edit form');
  ok(cf.mode === 'edit' && cf.data.name === 'Food & Drink' && /Changes show on every spend in this category/.test(text(D.overlay.top().cfg.render())), 'opens with its current name, emoji and colour');
  ok(/Delete this category/.test(text(D.overlay.top().cfg.render())), 'with delete at the end');
  ok(/Save changes/.test(text(D.overlay.top().cfg.render())) && /id="cf-primary"[^>]*aria-disabled="false"/.test(D.overlay.top().cfg.render()), 'nothing missing');
  D.ins['cf-name']({value: 'Eating out'}); D.acts['cf-emoji']({dataset: {e: '🍔'}}); D.acts['cf-sw']({dataset: {sw: 'coral'}});
  D.acts['cf-submit']();
  await sleep(750);
  var food = D.S.cats.filter(function (c) { return c.id === 'food'; })[0];
  ok(food.name === 'Eating out' && food.emoji === '🍔' && food.sw === 'coral', 'changed');
  ok(D.S.cats[1].id === 'food', 'it keeps its place in the order');
  D.route = 'spending'; D.render();
  ok(/Eating out/.test(app()) && !/Food &amp; Drink/.test(app()) && />🍔</.test(app()) && new RegExp(D.SWATCHES.coral[0]).test(app()), 'Spending shows the new name, emoji and colour');
  D.route = 'transactions'; D.params = {}; D.S.find = null; D.render();
  ok(/Eating out/.test(app()) && />🍔</.test(app()), 'All transactions rows too');
  D.route = 'home'; D.S.waiting = []; D.batchFor(D.S); D.S.waiting[0].cat = 'food'; D.S.ui.openId = D.S.waiting[0].id; D.render();
  ok(/Eating out/.test(app()), 'and the review rows');

  D.applyScenario('org-list', true);
  ok(D.S.cats[1].name === 'Food & Drink' && D.CATS[1].name === 'Food & Drink', 'editing a category does not leak into the next state');
  D.openCatForm('edit', {id: 'food'});
  D.ins['cf-name']({value: 'Eating'});
  D.acts['cf-submit']();
  D.acts['ov-close']();
  ok(D.overlay.top() && D.overlay.top().cfg.key === 'catform', 'cannot close the category form while it is saving');
  await sleep(750);
  ok(!D.overlay.top(), 'and it closes once saved');

  console.log('Delete (O6)');
  D.applyScenario('org-del-checking', true);
  ok(D.overlay.top().cfg.key === 'catdel' && D.catDel.step === 'checking', 'checking first');
  t = text(D.overlay.top().cfg.render());
  validate('<div>' + D.overlay.top().cfg.render() + '</div>', 'delete, checking');
  ok(/Delete Food & Drink\?/.test(t) && /Checking if it is used/.test(t), 'says it is checking');
  D.overlay.closeAll();
  D.applyScenario('org-del-empty', true);
  t = text(D.overlay.top().cfg.render());
  validate('<div>' + D.overlay.top().cfg.render() + '</div>', 'delete, empty');
  ok(/Delete Investments\?/.test(t) && /No spends use it/.test(t) && /No spends/.test(t), 'no spends: just confirm');
  var n0 = D.S.cats.length;
  D.acts['cd-yes'](T1);
  ok(D.catDel.step === 'busy', 'deleting');
  await sleep(1000);
  ok(D.S.cats.length === n0 - 1 && !D.S.cats.some(function (c) { return c.id === 'invest'; }) && !D.overlay.top(), 'gone');
  D.applyScenario('org-del-has', true);
  t = text(D.overlay.top().cfg.render());
  var dh = D.overlay.top().cfg.render();
  validate('<div>' + dh + '</div>', 'delete, has spends');
  var nFood = usedBy('food');
  ok(new RegExp(D.dots(nFood) + ' spends use it\\. 1 waiting line does too\\. Choose where they go first').test(t), 'tells how many use it, counts the waiting line, and asks where they go');
  ok((dh.match(/data-act="cd-dest"/g) || []).length === 15 && dh.indexOf('data-cat="food"') < 0, 'the other fifteen to choose from, not itself');
  ok(/Choose a category/.test(t) && /data-key="cd-yes"[^>]*aria-disabled="true"/.test(dh), 'cannot delete until one is chosen');
  D.acts['cd-yes']({getAttribute: function () { return 'true'; }});
  ok(D.catDel.step === 'has', 'pressing it anyway does nothing');
  D.acts['cd-dest']({dataset: {cat: 'groceries'}});
  dh = D.overlay.top().cfg.render();
  var wFood0 = D.S.waiting.filter(function (w) { return w.cat === 'food'; }).length;
  ok(wFood0 > 0 && new RegExp('Move ' + D.dots(nFood + wFood0) + ' and delete').test(text(dh)) && /data-key="cd-yes"[^>]*aria-disabled="false"/.test(dh), 'now it says how many will move, waiting lines included');
  var nGro = usedBy('groceries'), wFood = D.S.waiting.filter(function (w) { return w.cat === 'food'; }).length, wGro = D.S.waiting.filter(function (w) { return w.cat === 'groceries'; }).length;
  D.S.find = {q: '', date: {kind: 'all', anchor: D.S.today, from: '', to: '', label: ''}, cats: ['food', 'transport'], min: null, max: null, src: 'any', sort: 'date-desc', limit: 60, paramKey: null};
  D.acts['cd-yes'](T1);
  ok(D.catDel.step === 'busy' && /Moving and deleting/.test(text(D.overlay.top().cfg.render())), 'moving and deleting in progress');
  D.acts['ov-close']();
  ok(D.overlay.top() && D.overlay.top().cfg.key === 'catdel', 'cannot back out halfway');
  await sleep(1000);
  ok(!D.S.cats.some(function (c) { return c.id === 'food'; }), 'category gone');
  ok(usedBy('groceries') === nGro + nFood && D.S.saved.every(function (x) { return D.catById(x.cat); }), 'every spend still has a category');
  ok(D.S.waiting.filter(function (w) { return w.cat === 'groceries'; }).length === wGro + wFood, 'waiting lines moved too');
  ok(D.S.find.cats.join() === 'transport', 'a filter on the deleted category is dropped');
  ok(!D.overlay.top() && D.catDel === null, 'everything closed');
  D.applyScenario('org-del-moving', true);
  t = text(D.overlay.top().cfg.render());
  ok(/Moving and deleting/.test(t) && /Delete Food & Drink\?/.test(t), 'the moving state can be shown on its own');
  D.overlay.closeAll();
  D.applyScenario('org-list', true);
  D.openCatForm('edit', {id: 'groceries'});
  D.acts['cat-delete']();
  ok(D.catDel.step === 'checking', 'delete starts with a check');
  await sleep(900);
  ok(D.catDel.step === 'has', 'the check finds spends and moves on');
  D.acts['ov-close']();
  ok(D.S.cats.some(function (c) { return c.id === 'groceries'; }), 'cancel keeps it');
  D.overlay.closeAll();
  D.S.cats = [D.S.cats[0]];
  D.openCatForm('edit', {id: D.S.cats[0].id});
  ok(!/Delete this category/.test(text(D.overlay.top().cfg.render())), 'the last category cannot be deleted');
  D.overlay.closeAll();

  console.log('Setting up (O1)');
  D.applyScenario('org-setup', true);
  ph = app(); t = text(ph);
  validate(ph, 'org-setup');
  ok(/Setting up/.test(t) && /Adding your starter categories/.test(t) && /9 of 16/.test(t), 'says what is happening and how far');
  ok(/role="progressbar"[^>]*aria-valuenow="9"/.test(ph) && (ph.match(/class="bd on"/g) || []).length === 9, 'nine of sixteen are in');
  ok(!/class="bar"/.test(ph), 'no top bar or other screen behind it');
  D.applyScenario('org-setup-live', true);
  ok(D.S.boot && D.S.boot.done === 0, 'the live version starts at nothing');
  await sleep(3200);
  ok(D.S.boot === null && /to check|All checked/.test(text(app())), 'then the app opens');

  console.log('Stress data on categories');
  D.stress = true;
  D.applyScenario('org-list', true);
  validate(app(), 'stress categories');
  ok(/Kebutuhan-rumah-tangga/.test(app()) && /18 categories/.test(text(app())), 'a very long name with no spaces is listed');
  D.stress = false;

  /* money formatting */
  ok(D.rp(1234567) === 'Rp 1.234.567' && D.rp(5000) === 'Rp 5.000' && D.rp(48250000) === 'Rp 48.250.000', 'rupiah formatting');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.log(e && e.stack || e); process.exit(2); });
