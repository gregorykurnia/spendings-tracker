/* Group 2: understand (U1 to U8). The Spending screen, the glance card on home, and the list of one
   category's spends in a period (the base of the All transactions screen that group 3 completes). */
(function(){
  var D = window.Daybook;
  var esc = D.esc, icon = D.icon, rp = D.rp;
  D.acts = D.acts || {};
  D.scenarios = D.scenarios || [];
  D.screens = D.screens || {};
  function S() { return D.S; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sum(list, f) { return list.reduce(function (t, x) { return t + f(x); }, 0); }

  /* ---------- periods: weeks run Monday to Sunday; a running period is compared like for like ---------- */
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function daysIn(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5) + 1; }
  function mondayOf(iso) { return D.addDays(iso, -((D.parse(iso).getDay() + 6) % 7)); }
  function monthStart(iso) { return iso.slice(0, 8) + '01'; }
  function monthEnd(iso) { var d = D.parse(iso); return D.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); }
  function addMonths(iso, n) {
    var d = D.parse(iso), day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
    return D.iso(t);
  }
  function dm(iso) { return D.dshort(iso).slice(4); }                 // '25 Oct'
  function day(iso) { return +iso.slice(8); }

  /* from..to is the whole period; end is the last day counted so far */
  D.period = function (mode, anchor, today) {
    var from, to;
    if (mode === 'week') { from = mondayOf(anchor); to = D.addDays(from, 6); }
    else { from = monthStart(anchor); to = monthEnd(anchor); }
    var running = today >= from && today < to;
    return {mode: mode, from: from, to: to, end: running ? today : to, running: running, current: today >= from && today <= to};
  };
  /* the period before: whole, or the same number of days when this one is still running */
  D.prevPeriod = function (p) {
    var pf, pt;
    if (p.mode === 'week') { pf = D.addDays(p.from, -7); pt = D.addDays(pf, 6); }
    else { pf = addMonths(monthStart(p.from), -1); pt = monthEnd(pf); }
    var end = pt;
    if (p.running) { end = D.addDays(pf, daysIn(p.from, p.end) - 1); if (end > pt) end = pt; }
    return {mode: p.mode, from: pf, to: pt, end: end, running: false, current: false};
  };

  function rangeLabel(a, b, today, withYear) {
    var out;
    if (a === b) out = dm(b);
    else if (a.slice(0, 7) === b.slice(0, 7)) out = day(a) + ' to ' + dm(b);
    else out = dm(a) + ' to ' + dm(b);
    if (withYear || a.slice(0, 4) !== today.slice(0, 4) || b.slice(0, 4) !== today.slice(0, 4)) {
      if (a.slice(0, 4) !== b.slice(0, 4)) out = dm(a) + ' ' + a.slice(0, 4) + ' to ' + dm(b) + ' ' + b.slice(0, 4);
      else out += ' ' + b.slice(0, 4);
    }
    return out;
  }
  /* how a span is named inside a sentence: "1 to 25 September", "September", "12 to 18 Oct" */
  D.spanLabel = function (p, today) {
    if (p.mode === 'week') return rangeLabel(p.from, p.end, today, false);
    var name = D.monthName(p.from) + (p.from.slice(0, 4) !== today.slice(0, 4) ? ' ' + p.from.slice(0, 4) : '');
    return p.end === p.to ? name : '1 to ' + day(p.end) + ' ' + name;
  };
  function navLabel(p, today) {
    return p.mode === 'week' ? rangeLabel(p.from, p.to, today, true) : D.monthName(p.from) + ' ' + p.from.slice(0, 4);
  }
  function heroLabel(p, today) {
    if (p.mode === 'week') return p.current ? (p.running ? 'This week so far' : 'This week') : rangeLabel(p.from, p.to, today, false);
    var name = D.monthName(p.from) + (p.from.slice(0, 4) !== today.slice(0, 4) ? ' ' + p.from.slice(0, 4) : '');
    return p.running ? name + ' so far' : name;
  }

  D.compare = function (total, prevTotal, prevP, today) {
    var span = D.spanLabel(prevP, today);
    if (prevTotal === 0) return {kind: 'none', line: 'Nothing to compare with', sub: 'No spending in ' + span, short: 'Nothing in ' + span + ' to compare with'};
    var diff = total - prevTotal, sub = span + ' was ' + rp(prevTotal);
    if (diff === 0) return {kind: 'same', line: 'Same as before', sub: sub, short: 'Same as ' + span};
    var word = diff < 0 ? ' lower' : ' higher';
    return {kind: diff < 0 ? 'lower' : 'higher', line: rp(Math.abs(diff)) + word, sub: sub, short: rp(Math.abs(diff)) + word + ' than ' + span};
  };
  D.summary = function (mode, anchor) {
    var s = S(), p = D.period(mode, anchor, s.today), pp = D.prevPeriod(p);
    var total = D.sumRange(s.saved, p.from, p.end), prev = D.sumRange(s.saved, pp.from, pp.end);
    return {p: p, pp: pp, total: total, prev: prev, cmp: D.compare(total, prev, pp, s.today)};
  };

  /* the card at the top of home: this month so far, against the same days last month */
  D.glance = function () {
    var s = S(), m = D.summary('month', s.today), label = heroLabel(m.p, s.today);
    return '<a class="glance" href="#/spending" aria-label="' + esc(label + ', ' + rp(m.total) + '. Open spending.') + '">' +
      '<span class="g-top">' + esc(label) + icon('right', 20) + '</span>' +
      '<span class="g-amount"><small>Rp</small>' + D.dots(m.total) + '</span>' +
      '<span class="g-cmp">' + esc(m.cmp.short) + '</span></a>';
  };

  /* shared with All transactions */
  D.dt = {mondayOf: mondayOf, monthStart: monthStart, monthEnd: monthEnd, addMonths: addMonths, rangeLabel: rangeLabel};

  /* ---------- the numbers behind the screen ---------- */
  function catOrMissing(id) { return D.catById(id) || {id: 'none', name: 'No category', emoji: '❔', sw: 'slate'}; }
  function txCat(t) { return D.catById(t.cat) ? t.cat : 'none'; }
  D.catOrMissing = catOrMissing; D.txCat = txCat;

  D.spend = function () {
    var s = S();
    if (!s.spend) s.spend = {mode: 'month', anchor: s.today, sel: null, showAll: false};
    return s.spend;
  };
  function aggregate(p) {
    var s = S();
    var tx = s.saved.filter(function (t) { return t.date >= p.from && t.date <= p.end; });
    var total = sum(tx, function (t) { return t.amount; }), by = {}, perDay = {};
    tx.forEach(function (t) { var c = txCat(t); by[c] = (by[c] || 0) + t.amount; perDay[t.date] = (perDay[t.date] || 0) + t.amount; });
    var cats = Object.keys(by).map(function (id) { return {id: id, amount: by[id], share: by[id] / total}; })
      .sort(function (a, b) { return b.amount - a.amount; });
    var days = [], d = p.from;
    while (d <= p.to) { days.push({date: d, amount: perDay[d] || 0, future: d > s.today}); d = D.addDays(d, 1); }
    var biggest = tx.slice().sort(function (a, b) { return b.amount - a.amount || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); }).slice(0, 5);
    return {total: total, count: tx.length, cats: cats, days: days, biggest: biggest};
  }
  /* the day shown in the readout: the picked one, otherwise the biggest */
  function shownDay(agg, sp) {
    var i = -1;
    agg.days.forEach(function (d, k) { if (sp.sel && d.date === sp.sel && !d.future) i = k; });
    if (i >= 0) return i;
    var max = -1;
    agg.days.forEach(function (d, k) { if (!d.future && d.amount > max) { max = d.amount; i = k; } });
    return i;
  }
  function maxDay(agg) { return Math.max.apply(null, agg.days.map(function (d) { return d.amount; })); }

  /* ---------- pieces ---------- */
  D.subBarHtml = function (href, label) {
    return '<header class="bar"><a class="back" href="' + href + '">' + icon('left') + esc(label) + '</a><div class="tools">' +
      '<a class="icon-btn" href="#/transactions?focus=search" aria-label="Search">' + icon('search') + '</a>' +
      '<button class="icon-btn" type="button" data-act="menu" data-key="menu-btn" aria-label="Menu">' + icon('menu') + '</button></div></header>';
  };

  /* a row in "Biggest spends": store, date and category, amount (All transactions has its own, fuller row) */
  function txLine(t) {
    var c = catOrMissing(t.cat), sw = D.SWATCHES[c.sw] || D.SWATCHES.slate;
    return '<li><button type="button" class="tx-line" data-act="open-tx" data-id="' + t.id + '" data-key="tx-' + t.id + '">' +
      '<span class="cat-em" style="background:' + sw[0] + '" aria-hidden="true">' + c.emoji + '</span>' +
      '<span class="tx-main"><span class="tx-store">' + esc(t.store) + '</span><span class="tx-sub">' + esc(D.dshort(t.date) + ' · ' + c.name) + '</span></span>' +
      '<span class="tx-side"><b>' + rp(t.amount) + '</b></span></button></li>';
  }

  function readoutMain(agg, i) {
    var d = agg.days[i], max = maxDay(agg);
    return '<span class="ro-date">' + D.dshort(d.date) + '</span>' +
      (d.amount > 0 ? '<b class="ro-amt">' + rp(d.amount) + '</b>' : '<b class="ro-amt none">Nothing spent</b>') +
      (d.amount > 0 && d.amount === max ? '<span class="ro-tag">Biggest day</span>' : '');
  }
  function chartHtml(agg, sp, p) {
    var days = agg.days, n = days.length, max = maxDay(agg), i = shownDay(agg, sp);
    var first = 0, last = days.reduce(function (m, d, k) { return d.future ? m : k; }, 0);
    var bars = days.map(function (d, k) {
      var cls = 'day' + (k === i ? ' on' : '') + (d.future ? ' future' : d.amount === 0 ? ' zero' : '');
      return '<span class="' + cls + '"><i class="bar"' + (d.amount > 0 ? ' style="height:' + Math.max(4, Math.round(d.amount / max * 100)) + '%"' : '') + '></i></span>';
    }).join('');
    var axis = days.map(function (d, k) {
      var label = p.mode === 'week' ? WD[k] : (k % 7 === 0 ? String(day(d.date)) : '');
      return label ? '<span style="left:' + ((k + 0.5) / n * 100).toFixed(2) + '%">' + label + '</span>' : '';
    }).join('');
    var bigDay = days.filter(function (d) { return d.amount === max; })[0];
    var summary = 'Spending by day. Biggest day ' + D.dshort(bigDay.date) + ', ' + rp(max) + '.';
    return '<section class="sec sec-days" aria-labelledby="s-days"><h2 id="s-days">Day by day</h2>' +
      '<div class="readout"><button type="button" class="step" data-act="day-step" data-d="-1" data-key="day-prev" aria-label="Previous day"' + (i <= first ? ' aria-disabled="true"' : '') + '>' + icon('left') + '</button>' +
      '<div class="ro-main" id="day-main" aria-live="polite">' + readoutMain(agg, i) + '</div>' +
      '<button type="button" class="step" data-act="day-step" data-d="1" data-key="day-next" aria-label="Next day"' + (i >= last ? ' aria-disabled="true"' : '') + '>' + icon('right') + '</button></div>' +
      '<div class="chart" role="img" aria-label="' + esc(summary) + '" data-chart="' + n + '"><div class="plot' + (p.mode === 'week' ? ' week' : '') + '">' + bars + '</div><div class="axis" aria-hidden="true">' + axis + '</div></div></section>';
  }

  function catsHtml(agg, sp, p, label) {
    var shown = sp.showAll ? agg.cats : agg.cats.slice(0, 5), s = S();
    var lines = shown.map(function (c) {
      var cat = catOrMissing(c.id), sw = D.SWATCHES[cat.sw] || D.SWATCHES.slate;
      var pct = c.share < 0.01 ? '<1%' : Math.round(c.share * 100) + '%';
      var href = '#/transactions?cat=' + encodeURIComponent(c.id) + '&from=' + p.from + '&to=' + p.end + '&label=' + encodeURIComponent(label) + '&back=spending';
      return '<li><a class="cat-line" href="' + href + '"><span class="cat-em" style="background:' + sw[0] + '" aria-hidden="true">' + cat.emoji + '</span>' +
        '<span class="cl-main"><span class="cl-name">' + esc(cat.name) + '</span><span class="cl-bar" aria-hidden="true"><i style="width:' + Math.max(2, c.share * 100).toFixed(1) + '%;background:' + sw[1] + '"></i></span></span>' +
        '<span class="cl-side"><b>' + rp(c.amount) + '</b><small>' + pct + '</small></span></a></li>';
    }).join('');
    var more = agg.cats.length - 5;
    var toggle = more > 0 ? '<button type="button" class="btn quiet more-btn" data-act="cats-all" data-key="cats-all" aria-expanded="' + !!sp.showAll + '">' + (sp.showAll ? 'Show fewer' : 'Show ' + more + ' more') + '</button>' : '';
    return '<section class="sec sec-cats" aria-labelledby="s-cat"><h2 id="s-cat">Where it went</h2><p class="sec-hint">Tap one to see its spends.</p><ul class="cats">' + lines + '</ul>' + toggle + '</section>';
  }
  function bigHtml(agg) {
    return '<section class="sec sec-big" aria-labelledby="s-big"><h2 id="s-big">Biggest spends</h2><ul class="tx-list">' + agg.biggest.map(txLine).join('') + '</ul></section>';
  }

  function heroHtml(m, p, today) {
    var label = heroLabel(p, today), long = String(m.total).length >= 10;
    var ic = m.cmp.kind === 'lower' ? icon('lower') : m.cmp.kind === 'higher' ? icon('higher') : '';
    return '<section class="hero" aria-labelledby="hero-l"><p class="hero-l" id="hero-l">' + esc(label) + '</p>' +
      '<p class="hero-a' + (long ? ' long' : '') + '"><small>Rp</small>' + D.dots(m.total) + '</p>' +
      '<p class="hero-c' + (m.cmp.kind === 'none' || m.cmp.kind === 'same' ? ' dim' : '') + '">' + ic + esc(m.cmp.line) + '</p><p class="hero-s">' + esc(m.cmp.sub) + '</p></section>';
  }

  function emptyHtml(p, today) {
    var s = S(), waiting = s.waiting.length;
    var what = p.current ? 'Nothing spent yet this ' + p.mode + '.' : 'Nothing spent in ' + navLabel(p, today) + '.';
    return '<div class="empty sp-empty"><span class="empty-mark">' + icon('chart') + '</span><p><b>' + esc(what) + '</b></p>' +
      (waiting ? '<p>' + plural(waiting, 'line is', 'lines are') + ' still waiting to be checked. They count once you accept them.</p><div class="empty-act"><a class="btn" href="#/">Go and check ' + (waiting === 1 ? 'it' : 'them') + '</a></div>' : '') + '</div>';
  }

  function spendingHtml() {
    var s = S(), sp = D.spend(), p = D.period(sp.mode, sp.anchor, s.today), m = D.summary(sp.mode, sp.anchor);
    var agg = aggregate(p), label = heroLabel(p, s.today), unit = sp.mode;
    D._sp = {agg: agg, sp: sp};
    var top = '<div class="sp-top"><div class="sp-head"><h1>Spending</h1><div class="seg" role="group" aria-label="Period length">' +
      ['week', 'month'].map(function (k) { return '<button type="button" data-act="set-mode" data-mode="' + k + '" data-key="mode-' + k + '" aria-pressed="' + (sp.mode === k) + '">' + (k === 'week' ? 'Week' : 'Month') + '</button>'; }).join('') + '</div></div>' +
      '<div class="pnav"><button type="button" class="step" data-act="period-step" data-d="-1" data-key="p-prev" aria-label="Earlier ' + unit + '">' + icon('left') + '</button>' +
      '<p class="pnav-l">' + esc(navLabel(p, s.today)) + '</p>' +
      '<button type="button" class="step" data-act="period-step" data-d="1" data-key="p-next" aria-label="Later ' + unit + '"' + (p.current ? ' aria-disabled="true"' : '') + '>' + icon('right') + '</button></div>' +
      (p.current ? '' : '<div class="pnow"><button type="button" class="btn quiet" data-act="period-now" data-key="p-now">Back to this ' + unit + '</button></div>') + '</div>';
    var hero = heroHtml(m, p, s.today);
    var body;
    if (agg.total === 0) body = '<div class="sp-left">' + hero + emptyHtml(p, s.today) + '</div>';
    else body = '<div class="sp-left">' + hero + chartHtml(agg, sp, p) + bigHtml(agg) + '</div><div class="sp-right">' + catsHtml(agg, sp, p, label) + '</div>';
    return D.subBarHtml('#/', 'Home') + '<main id="main" class="sp" tabindex="-1">' + top + body + '</main>';
  }
  D.screens.spending = {render: spendingHtml};

  /* ---------- actions ---------- */
  function announce() {
    var s = S(), sp = D.spend(), p = D.period(sp.mode, sp.anchor, s.today);
    D.live('Showing ' + navLabel(p, s.today) + '.');
  }
  D.acts['set-mode'] = function (el) {
    var sp = D.spend(), s = S();
    if (sp.mode === el.dataset.mode) return;
    sp.mode = el.dataset.mode; sp.sel = null; sp.showAll = false;
    if (D.period(sp.mode, sp.anchor, s.today).current) sp.anchor = s.today;     // stay around the same date
    D.render(); announce();
  };
  D.acts['period-step'] = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') return;
    var sp = D.spend(), s = S(), d = +el.dataset.d;
    sp.anchor = sp.mode === 'week' ? D.addDays(sp.anchor, 7 * d) : addMonths(sp.anchor, d);
    if (D.period(sp.mode, sp.anchor, s.today).current) sp.anchor = s.today;
    sp.sel = null; sp.showAll = false;
    D.render(); announce();
  };
  D.acts['period-now'] = function () {
    var sp = D.spend();
    sp.anchor = S().today; sp.sel = null; sp.showAll = false;
    D.render(); announce();
    var t = document.getElementById('main'); if (t) t.focus({preventScroll: true});
  };
  D.acts['cats-all'] = function () { var sp = D.spend(); sp.showAll = !sp.showAll; D.render(); };

  /* the day readout changes in place, so a finger can slide along the chart */
  function setDay(i) {
    var c = D._sp; if (!c) return;
    var agg = c.agg, sp = c.sp;
    if (i < 0 || i >= agg.days.length || agg.days[i].future) return;
    sp.sel = agg.days[i].date;
    var main = document.getElementById('day-main'); if (main) main.innerHTML = readoutMain(agg, i);
    [].forEach.call(document.querySelectorAll('.chart .day'), function (el, k) { el.classList.toggle('on', k === i); });
    var last = agg.days.reduce(function (m, d, k) { return d.future ? m : k; }, 0);
    var prev = document.querySelector('[data-key="day-prev"]'), next = document.querySelector('[data-key="day-next"]');
    if (prev) prev.setAttribute('aria-disabled', i <= 0 ? 'true' : 'false');
    if (next) next.setAttribute('aria-disabled', i >= last ? 'true' : 'false');
  }
  D.acts['day-step'] = function (el) {
    var c = D._sp; if (!c || el.getAttribute('aria-disabled') === 'true') return;
    setDay(shownDay(c.agg, c.sp) + +el.dataset.d);
  };
  var scrub = null;
  function pickAt(chart, x) {
    var c = D._sp; if (!c) return;
    var r = chart.getBoundingClientRect(), n = c.agg.days.length;
    var i = Math.max(0, Math.min(n - 1, Math.floor((x - r.left) / r.width * n)));
    while (i > 0 && c.agg.days[i].future) i--;
    setDay(i);
  }
  D.chartPointer = function (e) {
    var chart = e.target && e.target.closest ? e.target.closest('[data-chart]') : null;
    if (e.type === 'pointerdown') {
      if (!chart) return;
      scrub = chart;
      try { chart.setPointerCapture(e.pointerId); } catch (err) {}
      pickAt(chart, e.clientX);
    } else if (e.type === 'pointermove') {
      if (scrub) pickAt(scrub, e.clientX);
      else if (chart && e.pointerType === 'mouse') pickAt(chart, e.clientX);   // hovering with a mouse
    } else scrub = null;
  };

  /* U8, and rows of the list below: open a saved spend to check or correct it */
  D.acts['open-tx'] = function (el) { D.openForm('edit-saved', {id: el.dataset.id}); };

  /* ---------- states for review ---------- */
  function spend(mode, anchor, extra) {
    return function (s) { s.waiting = []; D.batchFor(s); s.ui.openId = null; s.spend = Object.assign({mode: mode, anchor: anchor, sel: null, showAll: false}, extra || {}); };
  }
  var G = 'Spending';
  D.addScenario({id: 'spend-month', group: G, route: 'spending', label: 'This month so far, compared like for like', run: spend('month', D.TODAY)});
  D.addScenario({id: 'spend-week', group: G, route: 'spending', label: 'This week (Monday to Sunday)', run: spend('week', D.TODAY)});
  D.addScenario({id: 'spend-past', group: G, route: 'spending', label: 'A finished month: September', run: spend('month', '2026-09-15')});
  D.addScenario({id: 'spend-all', group: G, route: 'spending', label: 'All categories shown', run: spend('month', D.TODAY, {showAll: true})});
  D.addScenario({id: 'spend-quiet', group: G, route: 'spending', label: 'A day with no spending', run: spend('month', D.TODAY, {sel: '2026-10-07'})});
  D.addScenario({id: 'spend-first', group: G, route: 'spending', label: 'Nothing to compare with: August', run: spend('month', '2026-08-15')});
  D.addScenario({id: 'spend-none', group: G, route: 'spending', label: 'No spending at all: July', run: spend('month', '2026-07-15')});
  D.addScenario({id: 'spend-category', group: G, route: 'transactions', label: 'One category in the period (from Spending)',
    params: {cat: 'food', from: '2026-10-01', to: '2026-10-25', label: 'October so far', back: 'spending'}, run: spend('month', D.TODAY)});
  D.addScenario({id: 'spend-open', group: G, route: 'spending', label: 'Open one of the biggest spends', run: spend('month', D.TODAY),
    after: function (s) { var p = D.period('month', s.today, s.today); D.openForm('edit-saved', {id: aggregate(p).biggest[0].id}); }});
})();
