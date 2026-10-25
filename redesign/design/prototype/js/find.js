/* Group 3: find and fix (F1 to F7). All transactions: search, filters, order, rows, change (the shared form) and delete. */
(function(){
  var D = window.Daybook;
  var esc = D.esc, icon = D.icon, rp = D.rp;
  D.acts = D.acts || {};
  D.ins = D.ins || {};
  D.screens = D.screens || {};
  D.scenarios = D.scenarios || [];
  function S() { return D.S; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sum(list, f) { return list.reduce(function (t, x) { return t + f(x); }, 0); }
  var PAGE = 60;
  var SORTS = [['date-desc', 'Newest first'], ['date-asc', 'Oldest first'], ['amt-desc', 'Highest amount'], ['amt-asc', 'Lowest amount']];

  /* ---------- what is being looked for ---------- */
  function blank(s) {
    return {q: '', date: {kind: 'all', anchor: s.today, from: '', to: '', label: ''}, cats: [], min: null, max: null, src: 'any', sort: 'date-desc', limit: PAGE, paramKey: null};
  }
  D.find = function () { var s = S(); if (!s.find) s.find = blank(s); return s.find; };
  D.findKey = function (p) { p = p || {}; return JSON.stringify([p.cat || '', p.from || '', p.to || '', p.label || '', p.q || '']); };
  /* arriving from Spending (a category in a period) starts with those filters; arriving from a menu starts clean */
  function applyParams() {
    var s = S(), f = D.find(), p = D.params || {}, key = D.findKey(p);
    if (f.paramKey === key) return;
    var fresh = blank(s);
    fresh.paramKey = key;
    if (p.cat) fresh.cats = [p.cat];
    if (p.from || p.to) fresh.date = {kind: 'custom', anchor: s.today, from: p.from || '', to: p.to || '', label: p.label || ''};
    if (p.q) fresh.q = p.q;
    Object.keys(fresh).forEach(function (k) { f[k] = fresh[k]; });
  }

  function dateRange(d) {
    var T = D.dt;
    if (d.kind === 'day') return {from: d.anchor, to: d.anchor};
    if (d.kind === 'week') { var m = T.mondayOf(d.anchor); return {from: m, to: D.addDays(m, 6)}; }
    if (d.kind === 'month') return {from: T.monthStart(d.anchor), to: T.monthEnd(d.anchor)};
    if (d.kind === 'custom') return {from: d.from || '', to: d.to || ''};
    return null;
  }
  function dateLabel(d) {
    var r = dateRange(d), today = S().today;
    if (!r) return '';
    if (d.kind === 'day') return D.dlong(d.anchor);
    if (d.kind === 'week') return D.dt.rangeLabel(r.from, r.to, today, true);
    if (d.kind === 'month') return D.monthName(r.from) + ' ' + r.from.slice(0, 4);
    if (d.label) return d.label;
    if (r.from && r.to) return D.dt.rangeLabel(r.from, r.to, today, true);
    if (r.from) return 'From ' + D.dmy(r.from);
    if (r.to) return 'Until ' + D.dmy(r.to);
    return '';
  }
  function catsLabel(ids) {
    var names = ids.map(function (id) { return D.catOrMissing(id).name; });
    return names.length < 3 ? names.join(', ') : names.length + ' categories';
  }
  function amtLabel(f) {
    if (f.min != null && f.max != null) return rp(f.min) + ' to ' + rp(f.max);
    return f.min != null ? rp(f.min) + ' or more' : 'Up to ' + rp(f.max);
  }
  /* the filters that are on, one chip each (the search box is not a filter) */
  function active(f) {
    var a = [], lab = f.date.kind === 'all' ? '' : dateLabel(f.date);
    if (lab) a.push({k: 'date', label: lab});
    if (f.cats.length) a.push({k: 'cat', label: catsLabel(f.cats)});
    if (f.min != null || f.max != null) a.push({k: 'amt', label: amtLabel(f)});
    if (f.src !== 'any') a.push({k: 'src', label: f.src === 'shot' ? 'Screenshot' : 'Typed in'});
    return a;
  }

  function words(q) { return q.trim().toLowerCase().split(/\s+/).filter(Boolean); }
  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.n || 0) - (a.n || 0); }
  function results(f) {
    var ws = words(f.q), r = dateRange(f.date);
    var list = S().saved.filter(function (t) {
      if (ws.length) { var hay = (t.store + ' ' + (t.note || '')).toLowerCase(); for (var i = 0; i < ws.length; i++) if (hay.indexOf(ws[i]) < 0) return false; }
      if (r) { if (r.from && t.date < r.from) return false; if (r.to && t.date > r.to) return false; }
      if (f.cats.length && f.cats.indexOf(D.txCat(t)) < 0) return false;
      if (f.min != null && t.amount < f.min) return false;
      if (f.max != null && t.amount > f.max) return false;
      if (f.src !== 'any' && (t.src === 'hand' ? 'hand' : 'shot') !== f.src) return false;
      return true;
    });
    var sorter = f.sort === 'date-asc' ? function (a, b) { return byDateDesc(b, a); }
      : f.sort === 'amt-desc' ? function (a, b) { return b.amount - a.amount || byDateDesc(a, b); }
      : f.sort === 'amt-asc' ? function (a, b) { return a.amount - b.amount || byDateDesc(a, b); } : byDateDesc;
    return list.sort(sorter);
  }

  /* ---------- a row you can recognise at a glance (F5) ---------- */
  function reEsc(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hl(text, ws) {
    if (!ws.length) return esc(text);
    var re = new RegExp('(' + ws.map(reEsc).join('|') + ')', 'ig'), out = '', last = 0, m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
      if (!m[0].length) re.lastIndex++;
    }
    return out + esc(text.slice(last));
  }
  function dateText(iso) { return iso.slice(0, 4) === S().today.slice(0, 4) ? D.dshort(iso) : D.dlong(iso); }
  function row(t, ws) {
    var none = !D.catById(t.cat), c = D.catOrMissing(t.cat), sw = D.SWATCHES[c.sw] || D.SWATCHES.slate;
    var sub = none ? '<span class="fx-none">' + icon('alert', 16) + 'No category</span>' : esc(c.name);
    if (t.note) sub += ' · ' + hl(t.note, ws);
    var src = t.src === 'hand' ? icon('pencil', 14) + '<span class="sr">Typed in. </span>' : icon('image', 14) + '<span class="sr">From a screenshot. </span>';
    return '<li><button type="button" class="tx-line" data-act="open-tx" data-id="' + t.id + '" data-key="tx-' + t.id + '">' +
      '<span class="cat-em" style="background:' + sw[0] + '" aria-hidden="true">' + c.emoji + '</span>' +
      '<span class="tx-main"><span class="tx-store">' + hl(t.store, ws) + '</span><span class="tx-sub">' + sub + '</span></span>' +
      '<span class="tx-side"><b>' + rp(t.amount) + '</b><small>' + src + dateText(t.date) + '</small></span></button></li>';
  }

  /* ---------- the screen ---------- */
  function noResults(f, act) {
    var ws = words(f.q), what = [];
    if (ws.length) what.push('“' + esc(f.q.trim()) + '”');
    if (act.length) what.push(plural(act.length, 'filter', 'filters') + ' on');
    return '<div class="empty"><span class="empty-mark">' + icon('search') + '</span><p><b>No spends match.</b></p>' +
      (what.length ? '<p>Nothing for ' + what.join(' with ') + '.</p>' : '') +
      '<div class="empty-act"><button type="button" class="btn solid" data-act="f-clear-all" data-key="f-clear-all">Clear search and filters</button></div></div>';
  }
  function resultsHtml() {
    var f = D.find(), list = results(f), act = active(f), ws = words(f.q), out = '';
    if (act.length) {
      out += '<div class="fx-chips" role="group" aria-label="Filters on">' + act.map(function (a) {
        return '<button type="button" class="fx-chip" data-act="unfilter" data-k="' + a.k + '" data-key="chip-x-' + a.k + '" aria-label="Remove filter: ' + esc(a.label) + '">' + esc(a.label) + icon('close', 18) + '</button>';
      }).join('') + '<button type="button" class="btn quiet" data-act="f-clear" data-key="f-clear">Clear all</button></div>';
    }
    out += '<p class="fx-count" aria-live="polite">' + plural(list.length, 'spend', 'spends') + (list.length ? ' · ' + rp(sum(list, function (t) { return t.amount; })) : '') + '</p>';
    if (!list.length) return out + noResults(f, act);
    out += '<ul class="tx-list fx-list">' + list.slice(0, f.limit).map(function (t) { return row(t, ws); }).join('') + '</ul>';
    if (list.length > f.limit) out += '<button type="button" class="btn quiet more-btn" data-act="f-more" data-key="f-more">Show ' + Math.min(PAGE, list.length - f.limit) + ' more</button>';
    return out;
  }
  function updateResults() {
    var el = document.getElementById('res');
    if (el) el.innerHTML = resultsHtml();
    var b = document.getElementById('f-badge'), n = active(D.find()).length;
    if (b) { b.hidden = !n; b.innerHTML = n + '<span class="sr"> on</span>'; }
  }

  D.screens.transactions = {
    render: function () {
      if (D.firstUse()) {
        return D.subBarHtml('#/', 'Home') + '<main id="main" class="fx" tabindex="-1"><h1>All transactions</h1><div class="empty"><span class="empty-mark">' + icon('list') + '</span><p><b>No spends yet.</b></p>' +
          '<p>Accepted and typed-in spends show up here, ready to search.</p><div class="empty-act"><a class="btn solid" href="#/">Add screenshots</a></div></div></main>';
      }
      applyParams();
      var f = D.find(), n = active(f).length, p = D.params || {};
      var back = p.back === 'spending' ? ['#/spending', 'Spending'] : ['#/', 'Home'];
      var opts = SORTS.map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
      return D.subBarHtml(back[0], back[1]) + '<main id="main" class="fx" tabindex="-1"><h1>All transactions</h1>' +
        '<div class="fx-search"><span class="fx-ic" aria-hidden="true">' + icon('search') + '</span>' +
        '<input id="fx-q" class="input" type="search" data-in="fq" data-key="fq" value="' + esc(f.q) + '" placeholder="Search store or note" autocomplete="off" enterkeyhint="search" aria-label="Search store or note">' +
        '<button type="button" class="fx-x" id="fx-x" data-act="clear-search" data-key="fx-x" aria-label="Clear search"' + (f.q ? '' : ' hidden') + '>' + icon('close') + '</button></div>' +
        '<div class="fx-ctl"><button type="button" class="btn fbtn" data-act="f-open" data-key="f-open" aria-haspopup="dialog">' + icon('sliders') + 'Filters<span class="badge" id="f-badge"' + (n ? '' : ' hidden') + '>' + n + '<span class="sr"> on</span></span></button>' +
        '<label class="sort"><span class="sr">Order</span><select data-in="fsort" data-key="fsort">' + opts + '</select>' + icon('down') + '</label></div>' +
        '<div id="res">' + resultsHtml() + '</div></main>';
    },
    after: function () {
      if (D.params && D.params.focus === 'search' && !D._searchFocused) {
        D._searchFocused = true;
        var el = document.getElementById('fx-q');
        if (el) el.focus();
      }
    }
  };

  D.ins.fq = function (el) {
    var f = D.find();
    f.q = el.value; f.limit = PAGE;
    var x = document.getElementById('fx-x'); if (x) x.hidden = !f.q;
    updateResults();
  };
  D.ins.fsort = function (el) { var f = D.find(); f.sort = el.value; f.limit = PAGE; updateResults(); };
  D.acts['clear-search'] = function () {
    var f = D.find(), i = document.getElementById('fx-q');
    f.q = ''; f.limit = PAGE;
    if (i) { i.value = ''; i.focus(); }
    var x = document.getElementById('fx-x'); if (x) x.hidden = true;
    updateResults();
  };
  D.acts['f-more'] = function () { D.find().limit += PAGE; D.render(); };
  function clearFilters(f) { f.date.kind = 'all'; f.date.from = f.date.to = f.date.label = ''; f.cats = []; f.min = f.max = null; f.src = 'any'; f.limit = PAGE; }
  D.acts['unfilter'] = function (el) {
    var f = D.find(), k = el.dataset.k;
    if (k === 'date') { f.date.kind = 'all'; f.date.from = f.date.to = f.date.label = ''; }
    if (k === 'cat') f.cats = [];
    if (k === 'amt') { f.min = null; f.max = null; }
    if (k === 'src') f.src = 'any';
    f.limit = PAGE;
    D.render();
    D.live('Filter removed. ' + plural(results(f).length, 'spend', 'spends') + '.');
    var next = document.querySelector('#app [data-key="f-open"]'); if (next) next.focus();
  };
  D.acts['f-clear'] = function (el) {
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return;
    clearFilters(D.find());
    if (D.overlay.has('filters')) D.overlay.refresh('filters');
    else { D.render(); var b = document.querySelector('#app [data-key="f-open"]'); if (b) b.focus(); D.live('Filters cleared.'); }
  };
  D.acts['f-clear-all'] = function () {
    var f = D.find(); clearFilters(f); f.q = '';
    D.render();
    var i = document.getElementById('fx-q'); if (i) i.focus();
    D.live('Search and filters cleared.');
  };

  /* ---------- the filters sheet: changes apply as you go (F2, F3) ---------- */
  function chip(label, on, act, attrs, key) {
    return '<button type="button" class="chip' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-act="' + act + '" ' + attrs + ' data-key="' + key + '">' + label + '</button>';
  }
  function dateField(id, label, val, inName) {
    return '<div class="field"><span class="field-label" id="l-' + id + '">' + label + '</span><div class="date-box"><span>' + (val ? esc(D.dlong(val)) : 'Not set') + '</span>' + icon('calendar') +
      '<input type="date" id="' + id + '" data-in="' + inName + '" data-act="date-open" data-key="' + id + '" value="' + esc(val || '') + '" aria-labelledby="l-' + id + '"></div></div>';
  }
  function amountField(id, label, val, inName) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="amount-box"><span class="rp" aria-hidden="true">Rp</span><input class="input" id="' + id + '" type="text" inputmode="numeric" data-in="' + inName + '" data-key="' + id + '" value="' + (val != null ? D.dots(val) : '') + '" placeholder="Any" autocomplete="off"></div></div>';
  }
  function showLabel(n) { return n ? 'Show ' + plural(n, 'spend', 'spends') : 'No spends match'; }
  function sheetHtml() {
    var f = D.find(), s = S(), n = results(f).length, act = active(f), d = f.date, r = dateRange(d);
    var kinds = [['all', 'All time'], ['day', 'A day'], ['week', 'A week'], ['month', 'A month'], ['custom', 'Custom']];
    var dates = '<div class="chips" role="group" aria-label="Dates">' + kinds.map(function (k) { return chip(k[1], d.kind === k[0], 'f-kind', 'data-k="' + k[0] + '"', 'fk-' + k[0]); }).join('') + '</div>';
    if (d.kind === 'day' || d.kind === 'week' || d.kind === 'month') {
      var unit = d.kind, atNow = r.to >= s.today;
      dates += '<div class="dstep"><button type="button" class="step" data-act="f-step" data-d="-1" data-key="fs-prev" aria-label="Earlier ' + unit + '">' + icon('left') + '</button><p class="dstep-l">' + esc(dateLabel(d)) + '</p>' +
        '<button type="button" class="step" data-act="f-step" data-d="1" data-key="fs-next" aria-label="Later ' + unit + '"' + (atNow ? ' aria-disabled="true"' : '') + '>' + icon('right') + '</button></div>' +
        dateField('fs-anchor', 'Jump to a date', d.anchor, 'fanchor');
    }
    if (d.kind === 'custom') {
      dates += '<div class="two">' + dateField('fs-from', 'From', d.from, 'ffrom') + dateField('fs-to', 'To', d.to, 'fto') + '</div>' +
        (d.from && d.to && d.from > d.to ? '<p class="f-err">' + icon('alert', 18) + '<span>The end is before the start.</span></p>' : '');
    }
    var hasNone = s.saved.some(function (t) { return !D.catById(t.cat); }) || f.cats.indexOf('none') >= 0;
    var cats = s.cats.slice();
    if (hasNone) cats.push({id: 'none', name: 'No category', emoji: '❔'});
    var catChips = '<div class="chips" role="group" aria-label="Categories">' + cats.map(function (c) {
      return chip('<i aria-hidden="true">' + c.emoji + '</i>' + esc(c.name), f.cats.indexOf(c.id) >= 0, 'f-cat', 'data-cat="' + c.id + '"', 'fc-' + c.id);
    }).join('') + '</div>';
    var amount = '<div class="two">' + amountField('fs-min', 'At least', f.min, 'fmin') + amountField('fs-max', 'At most', f.max, 'fmax') + '</div>' +
      (f.min != null && f.max != null && f.min > f.max ? '<p class="f-err">' + icon('alert', 18) + '<span>The most is below the least.</span></p>' : '');
    var sources = [['any', 'Any'], ['shot', icon('image', 18) + 'Screenshot'], ['hand', icon('pencil', 18) + 'Typed in']];
    var src = '<div class="chips" role="group" aria-label="Source">' + sources.map(function (o) { return chip(o[1], f.src === o[0], 'f-src', 'data-s="' + o[0] + '"', 'fsrc-' + o[0]); }).join('') + '</div>';
    var body = '<fieldset class="fs"><legend>Dates</legend>' + dates + '</fieldset>' +
      '<fieldset class="fs"><legend>Categories</legend>' + catChips + '</fieldset>' +
      '<fieldset class="fs"><legend>Amount</legend>' + amount + '</fieldset>' +
      '<fieldset class="fs"><legend>Source</legend>' + src + '</fieldset>';
    var foot = '<div class="foot-row"><button type="button" class="btn big quiet" id="fs-clear" data-act="f-clear" data-key="fs-clear"' + (act.length ? '' : ' aria-disabled="true"') + '>Clear all</button>' +
      '<button type="button" class="btn solid big" id="fs-show" data-act="f-show" data-key="fs-show"' + (n ? '' : ' aria-disabled="true"') + '>' + showLabel(n) + '</button></div>';
    return '<div class="ov-head"><h2>Filters</h2>' + D.closeBtn() + '</div><div class="ov-body">' + body + '</div><div class="ov-foot">' + foot + '</div>';
  }
  function sheetMeta() {
    var f = D.find(), n = results(f).length, a = document.getElementById('fs-show'), c = document.getElementById('fs-clear');
    if (a) { a.textContent = showLabel(n); a.setAttribute('aria-disabled', n ? 'false' : 'true'); }
    if (c) c.setAttribute('aria-disabled', active(f).length ? 'false' : 'true');
  }
  D.acts['f-open'] = function () {
    D.overlay.open({key: 'filters', label: 'Filters', cls: 'filters', render: sheetHtml, onClose: function () { D.render(); }});
  };
  D.acts['f-show'] = function (el) { if (el.getAttribute('aria-disabled') !== 'true') D.overlay.close(); };
  D.acts['f-kind'] = function (el) {
    var f = D.find(), d = f.date, k = el.dataset.k, r = dateRange(d);
    if (k === d.kind) return;
    if (k === 'custom' && r) { d.from = r.from; d.to = r.to; d.label = ''; }
    if (k === 'all') { d.from = d.to = d.label = ''; }
    d.kind = k; f.limit = PAGE;
    D.overlay.refresh('filters');
  };
  D.acts['f-step'] = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') return;
    var f = D.find(), d = f.date, n = +el.dataset.d, s = S();
    d.anchor = d.kind === 'day' ? D.addDays(d.anchor, n) : d.kind === 'week' ? D.addDays(d.anchor, 7 * n) : D.dt.addMonths(d.anchor, n);
    f.limit = PAGE;
    D.overlay.refresh('filters');
  };
  D.acts['f-cat'] = function (el) {
    var f = D.find(), i = f.cats.indexOf(el.dataset.cat);
    if (i >= 0) f.cats.splice(i, 1); else f.cats.push(el.dataset.cat);
    f.limit = PAGE;
    D.overlay.refresh('filters');
  };
  D.acts['f-src'] = function (el) { var f = D.find(); f.src = el.dataset.s; f.limit = PAGE; D.overlay.refresh('filters'); };
  function dateIn(key) {
    return function (el) { var f = D.find(); f.date[key] = el.value; f.date.label = ''; f.limit = PAGE; D.overlay.refresh('filters'); };
  }
  D.ins.fanchor = function (el) { if (el.value) dateIn('anchor')(el); };
  D.ins.ffrom = dateIn('from');
  D.ins.fto = dateIn('to');
  function amountIn(key) {
    return function (el) {
      var digits = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12), f = D.find();
      f[key] = digits ? parseInt(digits, 10) : null;
      el.value = digits ? D.dots(digits) : '';
      f.limit = PAGE;
      sheetMeta();
    };
  }
  D.ins.fmin = amountIn('min');
  D.ins.fmax = amountIn('max');

  /* ---------- delete, after confirming once (F7) ---------- */
  function savedById(id) { return S().saved.filter(function (t) { return t.id === id; })[0] || null; }
  function confirmHtml() {
    var d = D.del, t = savedById(d.id), c = D.catOrMissing(t.cat), sw = D.SWATCHES[c.sw] || D.SWATCHES.slate, busy = d.busy;
    return '<div class="ov-head"><h2>Delete this spend?</h2>' + (busy ? '' : D.closeBtn()) + '</div><div class="ov-body">' +
      '<div class="del-card"><span class="cat-em" style="background:' + sw[0] + '" aria-hidden="true">' + c.emoji + '</span><span class="tx-main"><span class="tx-store">' + esc(t.store) + '</span><span class="tx-sub">' + esc(dateText(t.date)) + '</span></span><b>' + rp(t.amount) + '</b></div>' +
      "<p class=\"f-note\">It is removed for good and stops counting in your totals.</p>" + (d.error ? '<p class="f-err net" role="alert">' + icon('alert', 18) + '<span>' + esc(d.error) + '</span></p>' : '') + "</div>" +
      '<div class="ov-foot"><div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="del-cancel"' + (busy ? ' aria-disabled="true"' : ' data-autofocus') + '>Cancel</button>' +
      '<button type="button" class="btn danger big' + (busy ? ' is-busy' : '') + '" data-act="tx-delete-yes" data-key="del-yes"' + (busy ? ' aria-disabled="true"' : '') + '>' + (busy ? '<span class="spin"></span>Deleting…' : 'Delete') + '</button></div></div>';
  }
  D.acts['tx-delete'] = function () {
    var f = D.form;
    if (!f || f.mode !== 'edit-saved') return;
    D.del = {id: f.id, busy: false};
    D.overlay.open({key: 'confirm', role: 'alertdialog', label: 'Delete this spend?', cls: 'confirm', render: confirmHtml,
      onClose: function () { if (D.del && !D.del.done) D.del = null; }});
  };
  D.acts['tx-delete-yes'] = function () {
    var d = D.del;
    if (!d || d.busy) return;
    if (D.offline()) { d.error = D.netError; D.overlay.refresh('confirm'); D.live(D.netError); return; }
    d.error = '';
    d.busy = true;
    D.overlay.refresh('confirm');
    if (S().frozen) return;
    D.later(finishDelete, 700);
  };
  function finishDelete() {
    var s = S(), d = D.del, t = d && savedById(d.id);
    if (!t) return;
    s.saved = s.saved.filter(function (x) { return x.id !== d.id; });
    d.done = true; D.del = null;
    D.overlay.closeAll();
    D.toast('Deleted ' + t.store + ', ' + rp(t.amount) + '.');
    D.live('Deleted ' + t.store + '.');
  }

  /* ---------- states for review ---------- */
  function preset(s, patch, params) {
    var f = blank(s); Object.assign(f, patch);
    f.paramKey = D.findKey(params || {});
    s.find = f;
  }
  function base(s) { s.waiting = []; D.batchFor(s); s.ui.openId = null; }
  var G = 'Find and fix';
  var T = 'transactions';
  function firstWith(s, pred) { return s.saved.filter(pred)[0]; }
  function breakCategories(s) {
    s.saved.filter(function (t) { return t.date >= '2026-10-01'; }).slice(0, 4).forEach(function (t) { t.cat = 'deleted-category'; });
  }
  D.addScenario({id: 'find-all', group: G, route: T, label: 'All transactions', run: function (s) { base(s); preset(s, {}); }});
  D.addScenario({id: 'find-search', group: G, route: T, label: 'Search: "kopi"', run: function (s) { base(s); preset(s, {q: 'kopi'}); }});
  D.addScenario({id: 'find-filters', group: G, route: T, label: 'Three filters on', run: function (s) {
    base(s); preset(s, {cats: ['food'], date: {kind: 'custom', anchor: s.today, from: '2026-09-01', to: '2026-09-25', label: ''}, min: 50000});
  }});
  D.addScenario({id: 'find-sheet', group: G, route: T, label: 'The filters sheet', run: function (s) {
    base(s); preset(s, {cats: ['food', 'groceries'], date: {kind: 'week', anchor: s.today, from: '', to: '', label: ''}});
  }, after: function () { D.acts['f-open'](); }});
  D.addScenario({id: 'find-sort', group: G, route: T, label: 'Highest amount first', run: function (s) { base(s); preset(s, {sort: 'amt-desc'}); }});
  D.addScenario({id: 'find-none', group: G, route: T, label: 'No results', run: function (s) { base(s); preset(s, {q: 'zzz', cats: ['food']}); }});
  D.addScenario({id: 'find-missing', group: G, route: T, label: 'Missing category', run: function (s) { base(s); breakCategories(s); preset(s, {cats: ['none']}); }});
  D.addScenario({id: 'find-missing-form', group: G, route: T, label: 'Missing category: choosing a new one', run: function (s) { base(s); breakCategories(s); preset(s, {cats: ['none']}); },
    after: function (s) { D.openForm('edit-saved', {id: firstWith(s, function (t) { return !D.catById(t.cat); }).id}); }});
  D.addScenario({id: 'find-form', group: G, route: T, label: 'Change a saved spend', run: function (s) { base(s); preset(s, {}); },
    after: function (s) { D.openForm('edit-saved', {id: firstWith(s, function (t) { return t.note && t.src === 'shot'; }).id}); }});
  D.addScenario({id: 'find-delete', group: G, route: T, label: 'Delete: confirming once', run: function (s) { base(s); preset(s, {}); },
    after: function (s) { D.openForm('edit-saved', {id: firstWith(s, function (t) { return t.note && t.src === 'shot'; }).id}); D.acts['tx-delete'](); }});
  D.addScenario({id: 'find-deleting', group: G, route: T, label: 'Deleting', run: function (s) { base(s); preset(s, {}); s.frozen = true; },
    after: function (s) { D.openForm('edit-saved', {id: firstWith(s, function (t) { return t.note && t.src === 'shot'; }).id}); D.acts['tx-delete'](); D.del.busy = true; D.overlay.refresh('confirm'); }});
})();
