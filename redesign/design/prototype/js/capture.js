/* Group 1: capture and review (C1 to C4, R1 to R11). The home screen is the inbox. */
(function(){
  var D = window.Daybook;
  var esc = D.esc, icon = D.icon, rp = D.rp;
  D.acts = D.acts || {};
  D.ins = D.ins || {};
  D.scenarios = D.scenarios || [];
  D.epoch = D.epoch || 0;

  function S() { return D.S; }
  function find(id) { return S().waiting.filter(function (w) { return w.id === id; })[0] || null; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sum(list, f) { return list.reduce(function (t, x) { return t + f(x); }, 0); }
  /* timers that die when a state is reset */
  D.later = function (fn, ms) { var ep = D.epoch; return setTimeout(function () { if (ep === D.epoch) fn(); }, ms); };
  function focusKey(key) {
    var el = document.querySelector('#app [data-key="' + key + '"]');
    if (el) el.focus({preventScroll: false});
    return !!el;
  }
  function focusAfterChange(preferKey) {
    if (preferKey && focusKey(preferKey)) return;
    var a = document.activeElement;
    if (a && a !== document.body && document.getElementById('app').contains(a)) return;
    var t = document.querySelector('#app .tick') || document.querySelector('#app .add') || document.getElementById('main');
    if (t) t.focus();
  }

  /* ---------- state ---------- */
  D.makeState = function (opts) {
    opts = opts || {};
    D.epoch++;
    return {
      today: D.TODAY, cats: D.CATS.slice(), saved: D.buildSaved(),
      waiting: [], imports: null,
      ui: {openId: null, accepting: new Set(), leaving: new Set(), acceptingAll: false},
      seq: 100, poolI: 0, freshShots: 0, frozen: false, stress: !!opts.stress, scenario: null
    };
  };

  /* a line read from a screenshot, waiting to be checked */
  D.mkLine = function (s, o) {
    var dir = o.dir || 'out';
    var cat = o.cat === undefined ? D.suggest(o.store) : o.cat;
    var amount = o.amount === undefined ? null : o.amount;
    var w = {
      id: 'w' + (++s.seq), store: o.store, amount: amount, date: o.date,
      cat: cat || null, suggested: !!cat && o.cat === undefined, note: '', dir: dir,
      shot: {store: o.store, amount: o.shotAmount != null ? o.shotAmount : amount, date: o.date, dir: dir},
      fresh: !!o.fresh, cleared: false, dupOf: null
    };
    if (dir === 'out' && amount != null) {
      var dup = s.saved.filter(function (t) { return t.date === w.date && t.amount === w.amount && t.store === w.store; })[0];
      if (dup) w.dupOf = dup.id;
    }
    return w;
  };

  /* why a waiting line can't be accepted yet (first one is shown) */
  D.problems = function (w) {
    var p = [];
    if (w.dir === 'in' && !w.cleared) p.push('incoming');
    if (w.dupOf && !w.cleared) p.push('repeat');
    if (!(w.amount > 0)) p.push('amount');
    if (!String(w.store || '').trim()) p.push('store');
    if (!w.date) p.push('date');
    if (!w.cat) p.push('category');
    return p;
  };
  var REASONS = {
    incoming: {ic: 'in', why: "Money coming in, so it isn't counted as spending.", acts: [['throw', 'Throw away', 1], ['keep', "It's a spend", 0]]},
    repeat:   {ic: 'repeat', why: 'You already have this one: same store, day and amount.', acts: [['throw', 'Throw away', 1], ['keep', 'Keep it', 0]]},
    amount:   {ic: 'alert', alert: 1, why: "Couldn't read the amount. Check it against the screenshot.", acts: [['fix', 'Add amount', 1, 'amount'], ['throw', 'Throw away', 0]]},
    store:    {ic: 'alert', alert: 1, why: 'The store name is missing.', acts: [['fix', 'Add store', 1, 'store'], ['throw', 'Throw away', 0]]},
    date:     {ic: 'alert', alert: 1, why: 'The date is missing.', acts: [['fix', 'Add date', 1, 'date'], ['throw', 'Throw away', 0]]},
    category: {ic: 'tag', why: 'No category yet. Choose one to accept it.', acts: [['pick-cat', 'Choose category', 1], ['throw', 'Throw away', 0]]}
  };

  /* lines stay in the order they arrived (the bank's own order), so new ones never push the row you're about to tap */
  function sortWaiting(list) { return list.slice(); }

  /* ---------- the glance card: this month so far against the same days last month ---------- */
  D.glance = function () {
    var s = S(), to = s.today, dt = D.parse(to);
    var from = to.slice(0, 8) + '01';
    var pm = new Date(dt.getFullYear(), dt.getMonth() - 1, 1, 12);
    var pFrom = D.iso(pm);
    var pDay = Math.min(dt.getDate(), new Date(dt.getFullYear(), dt.getMonth(), 0).getDate());
    var pTo = pFrom.slice(0, 8) + (pDay < 10 ? '0' : '') + pDay;
    var total = D.sumRange(s.saved, from, to), prev = D.sumRange(s.saved, pFrom, pTo);
    var span = '1 to ' + pDay + ' ' + D.monthName(pFrom);
    var cmp;
    if (prev === 0) cmp = 'Nothing in ' + span + ' to compare with';
    else if (total === prev) cmp = 'Same as ' + span;
    else cmp = rp(Math.abs(total - prev)) + (total < prev ? ' lower' : ' higher') + ' than ' + span;
    var label = D.monthName(to) + ' so far';
    return '<a class="glance" href="#/spending" aria-label="' + esc(label + ', ' + rp(total) + '. Open spending.') + '">' +
      '<span class="g-top">' + esc(label) + icon('right', 20) + '</span>' +
      '<span class="g-amount"><small>Rp</small>' + D.dots(total) + '</span>' +
      '<span class="g-cmp">' + esc(cmp) + '</span></a>';
  };

  /* ---------- pieces of the home screen ---------- */
  D.barHtml = function () {
    return '<header class="bar"><a class="brand" href="#/">' + D.logo + 'Daybook</a><div class="tools">' +
      '<a class="icon-btn" href="#/transactions" aria-label="Search">' + icon('search') + '</a>' +
      '<button class="icon-btn" type="button" data-act="menu" data-key="menu-btn" aria-label="Menu">' + icon('menu') + '</button>' +
      '</div></header>';
  };

  function crop(w) {
    var sh = w.shot;
    return '<figure class="crop"><figcaption>From the screenshot</figcaption><div class="crop-row"><div><p>' + esc(sh.store) + '</p><small>' + D.dmy(sh.date) + '</small></div>' +
      '<b>' + D.dots(sh.amount) + ',00 ' + (sh.dir === 'in' ? 'CR' : 'DB') + '</b></div></figure>';
  }

  /* first few categories as chips, then "More". The chosen one is always visible. ctx names the actions. */
  function catChips(selId, ctx) {
    var cats = S().cats, shown = cats.slice(0, 4);
    if (selId && !shown.some(function (c) { return c.id === selId; })) { var c = D.catById(selId); if (c) shown[3] = c; }
    var out = '<div class="chips" role="group" aria-label="Category">';
    shown.forEach(function (c, i) {
      var on = c.id === selId;
      out += '<button type="button" class="chip' + (on ? ' on' : '') + (i === 3 ? ' opt4' : '') + '" aria-pressed="' + on + '" data-act="' + ctx.set + '"' +
        (ctx.id ? ' data-id="' + ctx.id + '"' : '') + ' data-cat="' + c.id + '" data-key="chip-' + ctx.key + '-' + c.id + '"><i aria-hidden="true">' + c.emoji + '</i>' + esc(c.name) + '</button>';
    });
    out += '<button type="button" class="chip more" data-act="' + ctx.more + '"' + (ctx.id ? ' data-id="' + ctx.id + '"' : '') + ' data-key="chip-' + ctx.key + '-more">More' + icon('down') + '</button></div>';
    return out;
  }

  function panel(w) {
    return '<div class="r-edit" id="p-' + w.id + '">' + crop(w) +
      '<label class="note"><span class="sr">What did you buy?</span><input class="input" type="text" data-in="note" data-id="' + w.id + '" data-key="note-' + w.id + '" value="' + esc(w.note) + '" placeholder="What did you buy? (optional)" maxlength="120" autocomplete="off"></label>' +
      '<div class="cat-wrap">' + (w.suggested ? '<p class="hint">Suggested from the store name</p>' : '') + catChips(w.cat, {set: 'set-cat', more: 'cat-more', id: w.id, key: w.id}) + '</div>' +
      '<div class="r-links"><button type="button" data-act="edit" data-id="' + w.id + '">Edit details</button><button type="button" data-act="throw" data-id="' + w.id + '">Throw away</button></div>' +
      '</div>';
  }

  function rowRight(w) {
    var ui = S().ui, open = ui.openId === w.id, busy = ui.accepting.has(w.id), leaving = ui.leaving.has(w.id);
    var tick = busy
      ? '<span class="tick is-busy" role="img" aria-label="Accepting ' + esc(w.store) + '"><span class="spin"></span></span>'
      : '<button type="button" class="tick" data-act="accept" data-id="' + w.id + '" data-key="tick-' + w.id + '" aria-label="Accept ' + esc(w.store) + ', ' + rp(w.amount) + '">' + icon('check') + '</button>';
    return '<li class="row' + (open ? ' open' : '') + (busy ? ' busy' : '') + (leaving ? ' leaving' : '') + '" data-id="' + w.id + '"><div class="row-in"><div class="r-head">' + tick +
      '<div class="r-main"><button type="button" class="r-store r-open" data-act="toggle" data-id="' + w.id + '" data-key="open-' + w.id + '" aria-expanded="' + open + '" aria-controls="p-' + w.id + '">' + esc(w.store) + '</button>' + D.pill(D.catById(w.cat)) + '</div>' +
      '<div class="r-side"><p class="r-amt">' + rp(w.amount) + '</p><p class="r-date">' + D.dshort(w.date) + '</p></div></div>' +
      (open ? panel(w) : '') + '</div></li>';
  }

  function rowLook(w) {
    var ui = S().ui, leaving = ui.leaving.has(w.id), why = REASONS[D.problems(w)[0]];
    var amt = w.amount > 0 ? '<p class="r-amt">' + rp(w.amount) + '</p>' : '<p class="r-amt-bad">' + icon('alert') + 'No amount</p>';
    var acts = why.acts.map(function (a, i) {
      return '<button type="button" class="btn big' + (a[2] ? ' solid' : '') + '" data-act="' + a[0] + '" data-id="' + w.id + '"' + (a[3] ? ' data-focus="' + a[3] + '"' : '') + ' data-key="act-' + w.id + '-' + i + '">' + a[1] + '</button>';
    }).join('');
    return '<li class="row nl' + (leaving ? ' leaving' : '') + '" data-id="' + w.id + '"><div class="row-in"><div class="r-head">' +
      '<span class="flag-ic' + (why.alert ? ' alert' : '') + '">' + icon(why.ic) + '</span>' +
      '<div class="r-main"><p class="r-store">' + esc(w.store || 'No store name') + '</p><p class="r-why">' + esc(why.why) + '</p></div>' +
      '<div class="r-side">' + amt + '<p class="r-date">' + (w.date ? D.dshort(w.date) : 'No date') + '</p></div></div>' +
      '<div class="r-act">' + acts + '</div></div></li>';
  }

  /* ---------- the import tray (C3, C4) ---------- */
  var BARS = [[20,14,17,12,15],[17,19,12,16,13],[14,17,19,12,16],[19,12,15,18,13]];
  function thumb(n) {
    var b = BARS[n % BARS.length], y = 20, out = '<svg class="thumb" viewBox="0 0 44 62" aria-hidden="true"><rect x=".75" y=".75" width="42.5" height="60.5" rx="6" fill="#fff" stroke="#DDD2A0" stroke-width="1.5"/><rect x="7" y="7" width="18" height="4" rx="2" fill="#B9C6CC"/>';
    b.forEach(function (w, i) { out += '<rect x="7" y="' + y + '" width="' + (10 + w) + '" height="3.5" rx="1.75" fill="#D5DDE0"/><rect x="' + (44 - 7 - 9) + '" y="' + y + '" width="9" height="3.5" rx="1.75" fill="' + (i === 1 ? '#FFE88A' : '#D5DDE0') + '"/>'; y += 8.5; });
    return out + '</svg>';
  }
  function shotLi(it) {
    var st = it.status, state, ic, extra = '', act = '';
    if (st === 'wait')    { state = 'Waiting'; ic = icon('dash'); }
    if (st === 'reading') { state = 'Reading…'; ic = '<span class="spin" style="color:var(--petrol)"></span>'; extra = '<div class="ind" role="progressbar" aria-label="Reading screenshot ' + it.n + '"></div>'; }
    if (st === 'ok')      { state = it.found ? 'Found ' + plural(it.found, 'transaction', 'transactions') : 'Read'; ic = icon('check'); }
    if (st === 'fail')    {
      state = "Couldn't read this one"; ic = icon('alert');
      extra = '<p class="shot-detail">It may be blurry or cut off. Retake it, or type the spends in.</p>';
      act = '<div class="shot-act"><button type="button" class="btn solid" data-act="tray-retry" data-n="' + it.n + '" data-key="shot-' + it.n + '-a">Try again</button>' +
        '<button type="button" class="btn" data-act="type-in" data-key="shot-' + it.n + '-b">Type in a spend</button>' +
        '<button type="button" class="btn quiet" data-act="tray-dismiss" data-n="' + it.n + '" data-key="shot-' + it.n + '-c">Dismiss</button></div>';
    }
    if (st === 'empty')   {
      state = 'Nothing found'; ic = icon('dash');
      extra = '<p class="shot-detail">This screenshot has no transactions. It needs to show the list of spending.</p>';
      act = '<div class="shot-act"><button type="button" class="btn" data-act="type-in" data-key="shot-' + it.n + '-a">Type in a spend</button>' +
        '<button type="button" class="btn quiet" data-act="tray-dismiss" data-n="' + it.n + '" data-key="shot-' + it.n + '-b">Dismiss</button></div>';
    }
    return '<li class="shot is-' + st + '">' + thumb(it.n) + '<div class="shot-body"><p class="shot-name">Screenshot ' + it.n + '</p><p class="shot-state">' + state + '</p>' +
      (st === 'fail' || st === 'empty' ? '' : extra) + '</div><span class="shot-ic">' + ic + '</span>' +
      (st === 'fail' || st === 'empty' ? '<div class="shot-extra">' + extra + '</div>' : '') + act + '</li>';
  }
  function trayHtml() {
    var T = S().imports;
    if (!T) return '';
    var items = T.items, total = items.length;
    var busy = items.some(function (i) { return i.status === 'reading' || i.status === 'wait'; });
    var okN = items.filter(function (i) { return i.status === 'ok'; }).length;
    var found = sum(items, function (i) { return i.found; });
    var them = total > 1 ? 'them' : 'it', title, sub;
    if (busy) { title = 'Reading ' + plural(total, 'screenshot', 'screenshots'); sub = "Keep this open until it's done."; }
    else if (okN === total) { title = total > 1 ? 'Read all ' + total + ' screenshots' : 'Read the screenshot'; sub = 'Found ' + plural(found, 'transaction', 'transactions') + '.'; }
    else if (okN > 0) { title = 'Read ' + okN + ' of ' + total + ' screenshots'; sub = 'Found ' + plural(found, 'transaction', 'transactions') + '. The rest need you.'; }
    else { title = 'Nothing added'; sub = 'Retake ' + them + ', or type the spends in.'; }
    return '<section class="tray" aria-labelledby="tray-t"><h2 id="tray-t">' + title + '</h2><p class="tray-sub">' + sub + '</p>' +
      '<ul class="shots">' + items.map(shotLi).join('') + '</ul></section>';
  }

  function emptyHtml() {
    return '<div class="empty"><span class="empty-mark">' + icon('check') + '</span>' +
      "<p>Add screenshots from your banking app and the spending in them shows up here to check.</p>" +
      '<div class="empty-act"><button class="add" type="button" data-act="add" data-key="add-2"' + (addOff() ? ' aria-disabled="true"' : '') + '>' + icon('plus') + '<span>Add screenshots</span></button>' +
      '<button class="btn" type="button" data-act="type-in" data-key="type-2">Type in a spend</button></div></div>';
  }

  function importing() {
    var T = S().imports;
    return !!T && T.items.some(function (i) { return i.status === 'reading' || i.status === 'wait'; });
  }
  function addOff() { return importing(); }

  function inboxSub(W) {
    var s = S();
    if (!W.length) return s.imports ? '' : 'Nothing is waiting.';
    var fresh = W.filter(function (w) { return w.fresh; }).length;
    if (fresh === W.length && s.freshShots) return 'From ' + plural(s.freshShots, 'screenshot', 'screenshots') + ', added just now';
    var oldest = W.reduce(function (m, w) { return w.date && w.date < m ? w.date : m; }, '9999');
    return 'Oldest is from ' + D.dshort(oldest);
  }

  function acceptBar(right, look) {
    if (right.length < 2) return '';
    var n = right.length, busy = S().ui.acceptingAll;
    var label = busy ? 'Accepting ' + n + '…' : look.length ? 'Accept the ' + n + ' that look right' : 'Accept all ' + n;
    return '<div class="actionbar"><button class="accept-all' + (busy ? ' is-busy' : '') + '" type="button" data-act="accept-all" data-key="accept-all"' + (busy ? ' aria-disabled="true"' : '') + '>' +
      (busy ? '<span class="spin"></span>' : icon('check')) + label + '</button></div>';
  }

  function inboxHtml() {
    var s = S(), W = sortWaiting(s.waiting), n = W.length;
    var look = W.filter(function (w) { return D.problems(w).length; });
    var right = W.filter(function (w) { return !D.problems(w).length; });
    var title = n ? n + ' to check' : (s.imports ? 'Nothing to check yet' : 'All checked');
    var sub = inboxSub(W);
    var out = '<section class="inbox" aria-labelledby="t"><div class="ib-head"><div><h1 id="t">' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      '<button class="add" type="button" data-act="add" data-key="add-1" aria-label="Add screenshots"' + (addOff() ? ' aria-disabled="true"' : '') + '>' + icon('plus') + '<span>Add<span class="long"> screenshots</span></span></button></div>';
    out += trayHtml();
    if (!n && !s.imports) out += emptyHtml();
    if (right.length) {
      out += '<section class="grp" aria-labelledby="g1"><div class="grp-head"><h2 id="g1" tabindex="-1">Look right <span>' + right.length + '</span></h2>' +
        (look.length ? '<button type="button" class="jump" data-act="jump" data-key="jump"><i class="dot"></i>' + look.length + ' need a look</button>' : '') + '</div>' +
        '<ul class="rows">' + right.map(rowRight).join('') + '</ul></section>';
    }
    if (look.length) {
      out += '<section class="grp look" aria-labelledby="g2"><h2 id="g2" tabindex="-1">Need a look <span>' + look.length + '</span></h2><ul class="rows">' + look.map(rowLook).join('') + '</ul></section>';
    }
    return out + acceptBar(right, look) + '</section>';
  }

  function hubHtml() {
    var chev = icon('right', 20);
    return '<nav class="hub" aria-label="More">' +
      '<a href="#/spending"><span class="h-ic">' + icon('chart') + '</span><span><b>Spending</b><small>Totals, categories and biggest spends</small></span>' + chev + '</a>' +
      '<a href="#/transactions"><span class="h-ic">' + icon('list') + '</span><span><b>All transactions</b><small>Search, filter and fix</small></span>' + chev + '</a>' +
      '<a href="#/categories"><span class="h-ic">' + icon('grid') + '</span><span><b>Categories</b><small>Emoji, colour and order</small></span>' + chev + '</a>' +
      '<button type="button" data-act="type-in" data-key="hub-type"><span class="h-ic">' + icon('pencil') + '</span><span><b>Type in a spend</b><small>Cash, or anything not in a screenshot</small></span>' + chev + '</button>' +
      '</nav>';
  }

  D.screens = D.screens || {};
  D.screens.home = {
    render: function () { return D.barHtml() + '<main id="main" class="home" tabindex="-1">' + D.glance() + inboxHtml() + hubHtml() + '</main>'; }
  };

  /* ---------- actions on waiting lines ---------- */
  function acceptIds(ids, all) {
    var s = S();
    ids = ids.filter(function (id) { return find(id) && !s.ui.accepting.has(id); });
    if (!ids.length) return;
    ids.forEach(function (id) { s.ui.accepting.add(id); });
    if (all) s.ui.acceptingAll = true;
    D.render();
    if (s.frozen) return;
    D.later(function () {
      ids.forEach(function (id) { s.ui.leaving.add(id); });
      D.render();
      D.later(function () { commitAccept(ids, all); }, 210);
    }, all ? 750 : 450);
  }
  function commitAccept(ids, all) {
    var s = S(), total = 0, count = 0;
    ids.forEach(function (id) {
      var w = find(id);
      s.ui.accepting.delete(id); s.ui.leaving.delete(id);
      if (!w) return;
      s.saved.push({id: 't' + (++s.seq), date: w.date, store: w.store.trim(), amount: w.amount, cat: w.cat, note: (w.note || '').trim(), src: 'shot'});
      s.waiting = s.waiting.filter(function (x) { return x.id !== id; });
      if (s.ui.openId === id) s.ui.openId = null;
      total += w.amount; count++;
    });
    if (all) { s.ui.acceptingAll = false; D.toast('Accepted ' + count + '. ' + rp(total) + ' added.'); }
    D.render();
    D.live('Accepted ' + count + '. ' + plural(s.waiting.length, 'line', 'lines') + ' left to check.');
    focusAfterChange();
  }
  D.acts.accept = function (el) { acceptIds([el.dataset.id]); };
  D.acts['accept-all'] = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') return;
    var ids = S().waiting.filter(function (w) { return !D.problems(w).length; }).map(function (w) { return w.id; });
    acceptIds(ids, true);
  };
  D.acts.toggle = function (el) {
    var ui = S().ui;
    ui.openId = ui.openId === el.dataset.id ? null : el.dataset.id;
    D.render();
  };
  D.acts.throw = function (el) {
    var id = el.dataset.id, w = find(id), s = S();
    if (!w) return;
    s.ui.leaving.add(id);
    D.render();
    D.later(function () {
      s.ui.leaving.delete(id);
      s.waiting = s.waiting.filter(function (x) { return x.id !== id; });
      if (s.ui.openId === id) s.ui.openId = null;
      D.render();
      D.live('Thrown away ' + w.store + '. ' + plural(s.waiting.length, 'line', 'lines') + ' left to check.');
      focusAfterChange();
    }, 210);
  };
  D.acts.keep = function (el) {
    var w = find(el.dataset.id);
    if (!w) return;
    w.cleared = true;
    D.render();
    var left = D.problems(w).length;
    D.live(left ? 'Kept. One more thing is needed before it can be accepted.' : 'Kept. It moved to Look right.');
    focusAfterChange(left ? 'act-' + w.id + '-0' : 'tick-' + w.id);
  };
  D.acts.jump = function () {
    var h = document.getElementById('g2');
    if (!h) return;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    h.scrollIntoView({behavior: calm ? 'auto' : 'smooth', block: 'start'});
    h.focus({preventScroll: true});
  };
  D.acts['set-cat'] = function (el) {
    var w = find(el.dataset.id);
    if (!w) return;
    w.cat = el.dataset.cat; w.suggested = false;
    D.render();
  };
  D.acts['cat-more'] = function (el) { D.openCatPicker({kind: 'line', id: el.dataset.id}); };
  D.acts['pick-cat'] = function (el) { D.openCatPicker({kind: 'line', id: el.dataset.id}); };
  D.acts.edit = function (el) { D.openForm('edit-waiting', {id: el.dataset.id}); };
  D.acts.fix = function (el) { D.openForm('edit-waiting', {id: el.dataset.id, focus: el.dataset.focus || 'amount'}); };
  D.acts['type-in'] = function () { D.openForm('add'); };
  D.ins.note = function (el) { var w = find(el.dataset.id); if (w) w.note = el.value; }; // kept as typed (R6)

  /* ---------- adding screenshots and reading them (C1, C3, C4) ---------- */
  var POOL = [
    ['ALFAMART PLAZA SENAYAN', 64300, 0], ['GOJEK*TRIP 5523', 38000, 0], ['STARBUCKS GI', 89000, 0], ['SHOPEE', 215000, -1],
    ['KIMIA FARMA 0452', 76500, -1], ['CGV GRAND INDONESIA', 120000, -1], ['MRT JAKARTA', 14000, 0], ['SPOTIFY P3F2A9', 59000, -1],
    ['WARUNG SATE KHAS SENAYAN', 152000, 0], ['INDOMARET POINT', 23800, 0], ['BLUE BIRD TAXI', 91000, -1], ['PT SUMBER REZEKI 77', 450000, -1]
  ];
  function poolLines(s, k) {
    var out = [];
    for (var i = 0; i < k; i++) {
      var p = POOL[s.poolI++ % POOL.length];
      out.push(D.mkLine(s, {store: p[0], amount: p[1], date: D.addDays(s.today, p[2]), fresh: true}));
    }
    return out;
  }

  D.acts.add = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') return;
    var input = document.getElementById('picker');
    if (input) input.click();
  };

  /* plan: one outcome per screenshot, 'ok' | 'fail' | 'empty'. opts.freeze keeps it on screen without running. */
  D.startImport = function (plan, opts) {
    var s = S();
    s.imports = {items: plan.map(function (o, i) { return {n: i + 1, outcome: o, status: 'wait', found: 0}; })};
    s.freshShots = plan.length;
    if (!(opts && opts.freeze)) readNext();
    D.render();
  };
  function readNext() {
    var s = S(), T = s.imports;
    if (!T) return;
    var it = T.items.filter(function (i) { return i.status === 'wait'; })[0];
    if (!it) {
      if (!T.items.some(function (i) { return i.status === 'reading'; })) finishImport();
      return;
    }
    it.status = 'reading';
    D.render();
    D.later(function () {
      if (it.outcome === 'ok') {
        var lines = poolLines(s, 3 + (it.n % 2));
        it.found = lines.length;
        lines.forEach(function (l) { s.waiting.push(l); });
        it.status = 'ok';
      } else {
        it.status = it.outcome === 'empty' ? 'empty' : 'fail';
      }
      D.render();
      D.live(it.status === 'ok' ? 'Screenshot ' + it.n + ' read. ' + plural(it.found, 'transaction', 'transactions') + ' found.' :
        it.status === 'fail' ? "Screenshot " + it.n + " couldn't be read." : 'Screenshot ' + it.n + ' has no transactions.');
      readNext();
    }, 1400 + it.n * 300);
  }
  function finishImport() {
    var s = S(), T = s.imports;
    if (!T || !T.items.every(function (i) { return i.status === 'ok'; })) return;
    D.later(function () { if (s.imports === T) { s.imports = null; D.render(); } }, 2600);
  }
  function endTrayIfDone() {
    var s = S(), T = s.imports;
    if (T && !T.items.some(function (i) { return i.status !== 'ok'; })) s.imports = null;
  }
  D.acts['tray-retry'] = function (el) {
    var it = S().imports.items.filter(function (i) { return i.n === +el.dataset.n; })[0];
    if (!it) return;
    it.status = 'wait'; it.outcome = 'ok';
    readNext();
  };
  D.acts['tray-dismiss'] = function (el) {
    var T = S().imports;
    T.items = T.items.filter(function (i) { return i.n !== +el.dataset.n; });
    endTrayIfDone();
    D.render();
    focusAfterChange('add-1');
  };

  /* ---------- the shared form: type in a spend (C2), correct a waiting line (R2), change a saved one (F6) ---------- */
  var FIELDS = ['store', 'amount', 'cat', 'date'];
  var FNAME = {store: 'store', amount: 'amount', cat: 'category', date: 'date'};
  var FCTL = {store: 'f-store', amount: 'f-amount', date: 'f-date'};

  D.invalid = function (d, f) {
    var e = {};
    if (!String(d.store || '').trim()) e.store = 'Add the store name.';
    if (!(d.amount > 0)) e.amount = f && f.unread && d.amount == null ? "Couldn't read this amount. Check the screenshot and type it in." : 'Enter an amount above Rp 0.';
    if (!d.cat) e.cat = 'Choose a category.';
    if (!d.date) e.date = 'Choose a date.';
    return e;
  };
  function missing(f) { var inv = D.invalid(f.data, f); return FIELDS.filter(function (k) { return inv[k]; }); }
  function names(keys) {
    var n = keys.map(function (k) { return FNAME[k]; });
    return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }

  D.openForm = function (mode, opts) {
    opts = opts || {};
    var s = S(), data, id = null, unread = false;
    if (mode === 'edit-waiting') { data = find(opts.id); id = data.id; unread = !(data.amount > 0); }
    else if (mode === 'edit-saved') {
      var t = s.saved.filter(function (x) { return x.id === opts.id; })[0];
      id = t.id; data = {store: t.store, amount: t.amount, date: t.date, cat: t.cat, note: t.note || ''};
    } else data = {store: '', amount: null, date: s.today, cat: null, note: ''};
    var f = D.form = {mode: mode, id: id, data: data, touched: {}, attempted: !!opts.attempted, saving: !!opts.saving, focus: opts.focus || (mode === 'add' ? 'store' : null), unread: unread};
    var label = mode === 'add' ? 'Type in a spend' : mode === 'edit-waiting' ? 'Edit details' : 'Change spend';
    D.overlay.open({key: 'form', label: label, cls: 'form', render: function () { return formHtml(f); },
      onClose: function () { D.form = null; D.render(); }});
  };

  function fieldErr(f, inv, k) {
    var show = (f.attempted || f.touched[k]) && inv[k];
    return '<p class="f-err" id="e-' + k + '" data-err="' + k + '"' + (show ? '' : ' hidden') + '>' + icon('alert', 18) + '<span>' + esc(inv[k] || '') + '</span></p>';
  }
  function formHtml(f) {
    var d = f.data, inv = D.invalid(d, f), keys = missing(f), busy = f.saving;
    var wait = f.mode === 'edit-waiting';
    var title = wait ? 'Edit details' : f.mode === 'add' ? 'Type in a spend' : 'Change spend';
    var show = function (k) { return (f.attempted || f.touched[k]) && inv[k]; };
    var bad = function (k) { return show(k) ? ' aria-invalid="true"' : ''; };
    var ro = busy ? ' readonly' : '';
    var af = function (k) { return f.focus === k ? ' data-autofocus' : ''; };
    var primary = wait ? (busy ? 'Accepting…' : 'Accept') : f.mode === 'add' ? (busy ? 'Saving…' : 'Add spend') : (busy ? 'Saving…' : 'Save changes');
    var secondary = wait ? 'Done' : 'Cancel';

    var body = '';
    if (wait) body += '<p class="f-note">Changes are kept as you go.</p>' + crop(d);
    body += '<div class="field"><label for="f-store">Store</label><input class="input" id="f-store" type="text" data-in="f-store" data-key="f-store" value="' + esc(d.store) + '" maxlength="80" autocomplete="off" aria-describedby="e-store"' + bad('store') + ro + af('store') + '>' + fieldErr(f, inv, 'store') + '</div>';
    body += '<div class="two"><div class="field"><label for="f-amount">Amount</label><div class="amount-box"><span class="rp" aria-hidden="true">Rp</span><input class="input" id="f-amount" type="text" inputmode="numeric" data-in="f-amount" data-key="f-amount" value="' + (d.amount > 0 ? D.dots(d.amount) : '') + '" placeholder="0" autocomplete="off" aria-describedby="e-amount"' + bad('amount') + ro + af('amount') + '></div>' + fieldErr(f, inv, 'amount') + '</div>';
    body += '<div class="field"><span class="field-label" id="l-date">Date</span><div class="date-box" id="date-box"' + bad('date') + '><span id="date-text">' + (d.date ? esc(D.dlong(d.date)) : 'Choose a date') + '</span>' + icon('calendar') +
      '<input type="date" id="f-date" data-in="f-date" data-act="date-open" data-key="f-date" value="' + esc(d.date || '') + '" aria-labelledby="l-date" aria-describedby="e-date"' + (busy ? ' disabled' : '') + af('date') + '></div>' + fieldErr(f, inv, 'date') + '</div></div>';
    body += '<div class="field"><span class="field-label" id="l-cat">Category</span>' + (wait && d.suggested ? '<p class="hint">Suggested from the store name</p>' : '') +
      catChips(d.cat, {set: 'form-cat', more: 'form-cat-more', key: 'form'}) + fieldErr(f, inv, 'cat') + '</div>';
    body += '<div class="field"><label for="f-note">Note <span class="hint">(optional)</span></label><input class="input" id="f-note" type="text" data-in="f-note" data-key="f-note" value="' + esc(d.note) + '" placeholder="What did you buy?" maxlength="120" autocomplete="off"' + ro + '></div>';

    var foot = '<p class="f-sum" id="f-sum"' + (keys.length ? '' : ' hidden') + '>Still needed: ' + names(keys) + '.</p>' +
      '<div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="f-cancel"' + (busy ? ' aria-disabled="true"' : '') + '>' + secondary + '</button>' +
      '<button type="button" class="btn solid big' + (busy ? ' is-busy' : '') + '" id="f-primary" data-act="form-submit" data-key="f-primary" aria-disabled="' + (keys.length || busy ? 'true' : 'false') + '">' + (busy ? '<span class="spin"></span>' : '') + primary + '</button></div>';
    return '<div class="ov-head"><h2>' + title + '</h2>' + D.closeBtn() + '</div><div class="ov-body">' + body + '</div><div class="ov-foot">' + foot + '</div>';
  }

  /* update messages and the main button as the person types, without redrawing the form */
  function formMeta() {
    var f = D.form;
    if (!f) return;
    var inv = D.invalid(f.data, f), keys = missing(f);
    FIELDS.forEach(function (k) {
      var p = document.getElementById('e-' + k), show = (f.attempted || f.touched[k]) && inv[k];
      if (p) { p.hidden = !show; if (show) p.querySelector('span').textContent = inv[k]; }
      var ctl = document.getElementById(k === 'date' ? 'date-box' : FCTL[k] || '');
      if (ctl) { if (show) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
    });
    var sumEl = document.getElementById('f-sum');
    if (sumEl) { sumEl.hidden = !keys.length; sumEl.textContent = 'Still needed: ' + names(keys) + '.'; }
    var btn = document.getElementById('f-primary');
    if (btn && !f.saving) btn.setAttribute('aria-disabled', keys.length ? 'true' : 'false');
  }
  D.formMeta = formMeta;
  D.ins['f-store'] = function (el) { D.form.data.store = el.value; formMeta(); };
  D.ins['f-note'] = function (el) { D.form.data.note = el.value; };
  D.ins['f-amount'] = function (el) {
    var digits = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
    D.form.data.amount = digits ? parseInt(digits, 10) : null;
    el.value = digits ? D.dots(digits) : '';
    formMeta();
  };
  D.ins['f-date'] = function (el) {
    D.form.data.date = el.value;
    document.getElementById('date-text').textContent = el.value ? D.dlong(el.value) : 'Choose a date';
    D.form.touched.date = true;
    formMeta();
  };
  D.touch = function (inName) {
    var f = D.form, k = {'f-store': 'store', 'f-amount': 'amount', 'f-date': 'date'}[inName];
    if (f && k && !f.touched[k]) { f.touched[k] = true; formMeta(); }
  };
  D.acts['date-open'] = function (el) { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } };
  D.acts['form-cat'] = function (el) {
    var f = D.form; f.data.cat = el.dataset.cat; f.data.suggested = false;
    D.overlay.refresh('form');
  };
  D.acts['form-cat-more'] = function () { D.openCatPicker({kind: 'form'}); };

  D.acts['form-submit'] = function () {
    var f = D.form;
    if (!f || f.saving) return;
    var keys = missing(f);
    if (keys.length) {
      f.attempted = true;
      D.overlay.refresh('form');
      var first = keys[0], t = first === 'cat' ? document.querySelector('[data-key^="chip-form-"]') : document.getElementById(FCTL[first]);
      if (t) t.focus();
      D.live('Not saved. Still needed: ' + names(keys) + '.');
      return;
    }
    f.saving = true;
    D.overlay.refresh('form');
    if (S().frozen) return;
    D.later(function () { finishSubmit(f); }, 650);
  };
  function finishSubmit(f) {
    var s = S(), d = f.data;
    f.saving = false;
    if (f.mode === 'add') {
      s.saved.push({id: 't' + (++s.seq), date: d.date, store: d.store.trim(), amount: d.amount, cat: d.cat, note: (d.note || '').trim(), src: 'hand'});
      D.overlay.close();
      D.toast('Added ' + d.store.trim() + ', ' + rp(d.amount) + '.');
    } else if (f.mode === 'edit-saved') {
      var t = s.saved.filter(function (x) { return x.id === f.id; })[0];
      if (t) { t.store = d.store.trim(); t.amount = d.amount; t.date = d.date; t.cat = d.cat; t.note = (d.note || '').trim(); }
      D.overlay.close();
      D.toast('Saved changes.');
    } else {
      var w = find(f.id);
      if (w) { w.cleared = true; D.overlay.close(); commitAccept([w.id], false); D.toast('Accepted ' + w.store.trim() + ', ' + rp(w.amount) + '.'); }
    }
  }

  /* ---------- category picker (all of them, in the owner's order) ---------- */
  D.openCatPicker = function (ctx) {
    D.pickerCtx = ctx;
    D.overlay.open({key: 'cats', label: 'Choose a category', cls: 'picker',
      render: function () {
        var cur = ctx.kind === 'line' ? (find(ctx.id) || {}).cat : D.form && D.form.data.cat;
        return '<div class="ov-head"><h2>Choose a category</h2>' + D.closeBtn() + '</div><div class="ov-body"><ul class="cat-list">' +
          S().cats.map(function (c) {
            var sw = D.SWATCHES[c.sw] || D.SWATCHES.slate, on = c.id === cur;
            return '<li><button type="button" class="cat-row' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="cat-choose" data-cat="' + c.id + '" data-key="cat-' + c.id + '"' + (on ? ' data-autofocus' : '') + '>' +
              '<span class="cat-em" style="background:' + sw[0] + '" aria-hidden="true">' + c.emoji + '</span><span>' + esc(c.name) + '</span>' + (on ? icon('check') : '<span></span>') + '</button></li>';
          }).join('') + '</ul></div>';
      },
      onClose: function () {
        D.render();
        if (D.form) {
          D.overlay.refresh('form');
          var t = document.querySelector('#overlays [data-key="chip-form-more"]');
          if (t) t.focus();
        }
      }});
  };
  D.acts['cat-choose'] = function (el) {
    var ctx = D.pickerCtx, id = el.dataset.cat;
    if (ctx.kind === 'line') { var w = find(ctx.id); if (w) { w.cat = id; w.suggested = false; } }
    else if (D.form) { D.form.data.cat = id; D.form.data.suggested = false; }
    D.overlay.close();
    if (ctx.kind === 'line') focusAfterChange('tick-' + ctx.id);
  };

  /* ---------- menu, with the review-only list of states ---------- */
  D.acts.menu = function () { D.overlay.open({key: 'menu', label: 'Menu', cls: 'menu', render: menuHtml}); };
  function menuHtml() {
    var chev = icon('right', 20), cur = S().scenario, groups = [], by = {};
    D.scenarios.forEach(function (sc) { if (!by[sc.group]) { by[sc.group] = []; groups.push(sc.group); } by[sc.group].push(sc); });
    var states = groups.map(function (g) {
      return '<h4>' + esc(g) + '</h4>' + by[g].map(function (sc) {
        return '<button type="button" class="state-btn" data-act="scenario" data-id="' + sc.id + '"' + (sc.id === cur ? ' aria-current="true"' : '') + '>' + esc(sc.label) + '</button>';
      }).join('');
    }).join('');
    var href = '?state=' + encodeURIComponent(cur || 'review-fresh') + (S().stress ? '' : '&stress');
    return '<div class="ov-head"><h2>Menu</h2>' + D.closeBtn() + '</div><div class="ov-body"><div class="menu-list">' +
      '<a class="menu-item" href="#/" data-act="nav"><span class="h-ic">' + icon('check') + '</span><span><b>To check</b><small>What is waiting to be accepted</small></span>' + chev + '</a>' +
      '<a class="menu-item" href="#/spending" data-act="nav"><span class="h-ic">' + icon('chart') + '</span><span><b>Spending</b><small>Totals, categories and biggest spends</small></span>' + chev + '</a>' +
      '<a class="menu-item" href="#/transactions" data-act="nav"><span class="h-ic">' + icon('list') + '</span><span><b>All transactions</b><small>Search, filter and fix</small></span>' + chev + '</a>' +
      '<a class="menu-item" href="#/categories" data-act="nav"><span class="h-ic">' + icon('grid') + '</span><span><b>Categories</b><small>Emoji, colour and order</small></span>' + chev + '</a>' +
      '<button type="button" class="menu-item" data-act="menu-type"><span class="h-ic">' + icon('pencil') + '</span><span><b>Type in a spend</b><small>Cash, or anything not in a screenshot</small></span>' + chev + '</button>' +
      '</div><div class="menu-sec"><h3>Prototype: jump to a state</h3><p>Not part of the app. For design review only.</p>' + states +
      '<a class="tog" href="' + href + '">' + (S().stress ? 'Back to normal data' : 'Use the stress data') + '</a></div></div>';
  }
  D.acts['menu-type'] = function () { D.overlay.closeAll(); D.openForm('add'); };

  /* ---------- states for review (the menu lists these) ---------- */
  function batchFresh(s) {
    var L = [
      {store: 'INDOMARET FRESH BSD', amount: 87450, date: '2026-10-25'},
      {store: 'GRAB* A-7XK2', amount: 43000, date: '2026-10-24'},
      {store: 'TOKOPEDIA', amount: 1249000, date: '2026-10-24'},
      {store: 'PLN PREPAID 5390 4421', amount: 200000, date: '2026-10-23'},
      {store: 'NETFLIX.COM', amount: 186000, date: '2026-10-23'},
      {store: 'KOPI KENANGAN SCBD', amount: 28000, date: '2026-10-25'},
      {store: 'TRSF E-BANKING CR', amount: 5000000, date: '2026-10-23', dir: 'in'}
    ];
    s.waiting = L.map(function (o) { return D.mkLine(s, Object.assign({fresh: true}, o)); });
    s.freshShots = 2;
    s.ui.openId = s.waiting[0].id;
  }
  function batchProblems(s) {
    batchFresh(s);
    s.waiting.push(D.mkLine(s, {store: 'ALFAMART CILANDAK TOWN SQ', amount: null, shotAmount: 132500, date: '2026-10-25', fresh: true}));
    s.waiting.push(D.mkLine(s, {store: 'CV MAJU JAYA 8841', amount: 350000, date: '2026-10-24', fresh: true}));
  }
  function batchLater(s) {
    var L = [
      ['BAKSO BOY SENAYAN', 54000, '2026-10-24'], ['GRAB* A-4TT1', 31500, '2026-10-24'], ['ALFAMART 1204', 27800, '2026-10-24'],
      ['SHOPEE', 189000, '2026-10-23'], ['KOPI KENANGAN LT', 29000, '2026-10-23'], ['PERTAMINA SPBU 3401', 200000, '2026-10-23'],
      ['HALODOC', 85000, '2026-10-22'], ['GOJEK*TRIP 5523', 22000, '2026-10-22'], ['INDOMARET 0192', 18500, '2026-10-22'],
      ['UNIQLO PLAZA SENAYAN', 399000, '2026-10-22']
    ];
    s.waiting = L.map(function (r) { return D.mkLine(s, {store: r[0], amount: r[1], date: r[2]}); });
    s.waiting.push(D.mkLine(s, {store: 'TRSF E-BANKING CR', amount: 750000, date: '2026-10-22', dir: 'in'}));
    s.waiting.push(D.mkLine(s, {store: 'PT SUMBER REZEKI 77', amount: 450000, date: '2026-10-22'}));
  }
  function batchStress(s) {
    var names = ['INDOMARET', 'GRAB* A-7XK2', 'KOPI KENANGAN SCBD', 'TOKOPEDIA', 'WARUNG PADANG SARI', 'PERTAMINA SPBU 3401', 'PT SUMBER REZEKI 77', 'SHOPEE', 'ALFAMART', 'BLUE BIRD TAXI'];
    var L = [
      {store: 'INDOMARET*POINT*KEMANG*RAYA*BLOK*C*NO*17*JAKARTA*SELATAN*DKI*JAKARTA*12730*BCA*DEBIT*2510*ID', amount: 48250000, date: '2026-10-25'},
      {store: 'PT TELEKOMUNIKASI SELULAR PAKET DATA', amount: 1000, date: '2026-10-25'},
      {store: 'TOKO-BESAR-ELEKTRONIK-JAKARTA-TIMUR-CABANG-CAWANG-KAV-12', amount: 1234567890, date: '2026-10-24'},
      {store: 'TRSF E-BANKING CR', amount: 25000000, date: '2026-10-24', dir: 'in'}
    ];
    for (var i = 0; i < 44; i++) {
      var o = {store: names[i % names.length] + (i % 3 ? '' : ' ' + (1000 + i * 7)), amount: Math.round(((i + 3) * 37123 % 900000 + 5000) / 500) * 500, date: D.addDays(s.today, -(i % 5))};
      if (i % 11 === 5) o.dir = 'in';
      if (i % 13 === 7) { o.shotAmount = o.amount; o.amount = null; }
      L.push(o);
    }
    s.waiting = L.map(function (o) { return D.mkLine(s, Object.assign({fresh: true}, o)); });
    s.freshShots = 6;
  }
  D.batchFor = function (s) { if (s.stress) batchStress(s); else batchFresh(s); };

  function addScenario(def) { D.scenarios.push(def); }
  D.addScenario = addScenario;
  function firstRight(s) { var w = sortWaiting(s.waiting).filter(function (x) { return !D.problems(x).length; })[0]; return w ? w.id : null; }

  addScenario({id: 'review-fresh', group: 'Review', label: 'A fresh batch: 7 to check', run: function (s) { D.batchFor(s); s.ui.openId = firstRight(s); }});
  addScenario({id: 'review-problems', group: 'Review', label: 'Lines that need you: no amount, no category', run: function (s) { batchProblems(s); s.ui.openId = null; }});
  addScenario({id: 'review-later', group: 'Review', label: 'Coming back later: 12 waiting', run: function (s) { batchLater(s); s.ui.openId = null; }});
  addScenario({id: 'review-clear', group: 'Review', label: 'All checked: nothing waiting', run: function (s) { s.waiting = []; }});
  addScenario({id: 'review-saving', group: 'Review', label: 'Saving: accepting the ones that look right', run: function (s) {
    batchFresh(s); s.ui.openId = null; s.frozen = true;
    s.waiting.forEach(function (w) { if (!D.problems(w).length) s.ui.accepting.add(w.id); });
    s.ui.acceptingAll = true;
  }});

  addScenario({id: 'import-reading', group: 'Import', label: 'Reading 3 screenshots', run: function (s) {
    s.waiting = [
      D.mkLine(s, {store: 'ALFAMART PLAZA SENAYAN', amount: 64300, date: s.today, fresh: true}),
      D.mkLine(s, {store: 'GOJEK*TRIP 5523', amount: 38000, date: s.today, fresh: true}),
      D.mkLine(s, {store: 'STARBUCKS GI', amount: 89000, date: s.today, fresh: true})
    ];
    D.startImport(['ok', 'ok', 'ok'], {freeze: true});
    var T = s.imports; T.items[0].status = 'ok'; T.items[0].found = 3; T.items[1].status = 'reading';
    s.freshShots = 3;
  }});
  addScenario({id: 'import-live', group: 'Import', label: 'Run it live: one fails, then try again', run: function (s) {
    s.waiting = [];
    D.startImport(['ok', 'fail', 'ok']);
  }});
  addScenario({id: 'import-mixed', group: 'Import', label: 'One read, one failed, one found nothing', run: function (s) {
    s.waiting = [
      D.mkLine(s, {store: 'ALFAMART PLAZA SENAYAN', amount: 64300, date: s.today, fresh: true}),
      D.mkLine(s, {store: 'GOJEK*TRIP 5523', amount: 38000, date: s.today, fresh: true}),
      D.mkLine(s, {store: 'STARBUCKS GI', amount: 89000, date: s.today, fresh: true})
    ];
    D.startImport(['ok', 'fail', 'empty'], {freeze: true});
    var T = s.imports; T.items[0].status = 'ok'; T.items[0].found = 3; T.items[1].status = 'fail'; T.items[2].status = 'empty';
    s.freshShots = 3;
  }});
  addScenario({id: 'import-failed', group: 'Import', label: "One screenshot, couldn't be read", run: function (s) {
    D.startImport(['fail'], {freeze: true}); s.imports.items[0].status = 'fail';
  }});
  addScenario({id: 'import-nothing', group: 'Import', label: 'One screenshot, nothing found', run: function (s) {
    D.startImport(['empty'], {freeze: true}); s.imports.items[0].status = 'empty';
  }});
  addScenario({id: 'import-done', group: 'Import', label: 'Finished: all 3 read', run: function (s) {
    D.batchFor(s); s.ui.openId = null;
    D.startImport(['ok', 'ok', 'ok'], {freeze: true});
    var T = s.imports; T.items.forEach(function (i) { i.status = 'ok'; i.found = 2; }); T.items[2].found = 3;
  }});

  addScenario({id: 'form-correct', group: 'Form (one form for all three)', label: 'Correct a waiting line', run: function (s) { D.batchFor(s); s.ui.openId = null; },
    after: function (s) { D.openForm('edit-waiting', {id: s.waiting[0].id}); }});
  addScenario({id: 'form-amount', group: 'Form (one form for all three)', label: "Amount couldn't be read", run: batchProblems,
    after: function (s) { var w = s.waiting.filter(function (x) { return !(x.amount > 0); })[0]; D.openForm('edit-waiting', {id: w.id, focus: 'amount'}); }});
  addScenario({id: 'form-notready', group: 'Form (one form for all three)', label: 'Not ready to save', run: function (s) { D.batchFor(s); },
    after: function () { D.openForm('add', {attempted: true}); }});
  addScenario({id: 'form-saving', group: 'Form (one form for all three)', label: 'Saving', run: function (s) { D.batchFor(s); s.frozen = true; },
    after: function (s) {
      D.openForm('edit-waiting', {id: s.waiting[0].id, saving: true});
    }});
  addScenario({id: 'form-add', group: 'Form (one form for all three)', label: 'Type in a spend', run: function (s) { D.batchFor(s); },
    after: function () { D.openForm('add'); }});
  addScenario({id: 'form-saved', group: 'Form (one form for all three)', label: 'Change a saved spend', run: function (s) { D.batchFor(s); },
    after: function (s) { D.openForm('edit-saved', {id: s.saved[3].id}); }});
  addScenario({id: 'picker', group: 'Form (one form for all three)', label: 'Choose a category', run: batchProblems,
    after: function (s) { var w = s.waiting.filter(function (x) { return !x.cat; })[0]; D.openCatPicker({kind: 'line', id: w.id}); }});

})();
