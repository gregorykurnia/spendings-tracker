/* Group 4: organise (O1 to O6). The Categories screen, one form to add or change a category,
   deleting with a check first, and the first-open "setting up" moment. */
(function(){
  var D = window.Daybook;
  var esc = D.esc, icon = D.icon;
  D.acts = D.acts || {};
  D.ins = D.ins || {};
  D.screens = D.screens || {};
  D.scenarios = D.scenarios || [];
  function S() { return D.S; }
  function plural(n, one, many) { return D.dots(n) + ' ' + (n === 1 ? one : many); }
  function cat(id) { return S().cats.filter(function (c) { return c.id === id; })[0] || null; }
  function sw(c) { return D.SWATCHES[c.sw] || D.SWATCHES.slate; }
  function used(id) { return S().saved.filter(function (t) { return t.cat === id; }).length; }
  function waitingUse(id) { return S().waiting.filter(function (w) { return w.cat === id; }).length; }
  D.org = function () { var s = S(); if (!s.org) s.org = {reorder: false}; return s.org; };

  var EMOJI = ['🛒', '🍽️', '☕', '🍔', '🚗', '🚌', '⛽', '✈️', '🏠', '💡', '📶', '📱', '💻', '👗', '👟', '💊', '🏥', '🎓', '📚', '🎮', '🎬', '🎁', '💑', '👶', '🐶', '⛪', '💼', '📈'];
  var EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  function firstGrapheme(str) {
    str = String(str || '').trim();
    if (!str) return '';
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var r = new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(str)[Symbol.iterator]().next();
      return r.done ? '' : r.value.segment;
    }
    return Array.from(str)[0];
  }
  function swName(k) { return k.charAt(0).toUpperCase() + k.slice(1); }
  /* the colour used least so far, so a new category starts as different as it can be */
  function nextSwatch() {
    var n = {}, keys = Object.keys(D.SWATCHES);
    keys.forEach(function (k) { n[k] = 0; });
    S().cats.forEach(function (c) { if (n[c.sw] != null) n[c.sw]++; });
    return keys.reduce(function (best, k) { return n[k] < n[best] ? k : best; }, keys[0]);
  }

  /* ---------- the list (O4, O5) ---------- */
  function listHtml() {
    var s = S(), o = D.org(), cats = s.cats, n = cats.length;
    var rows = cats.map(function (c, i) {
      var k = used(c.id), count = k ? plural(k, 'spend', 'spends') : 'No spends yet', disc = '<span class="cat-em" style="background:' + sw(c)[0] + '" aria-hidden="true">' + c.emoji + '</span>';
      var txt = '<span class="tx-main"><span class="tx-store">' + esc(c.name) + '</span><span class="tx-sub">' + count + '</span></span>';
      var cut = o.reorder && i === 4 ? '<li class="org-cut" aria-hidden="true"><span>Quick choices end here</span></li>' : '';
      if (!o.reorder) {
        return cut + '<li><button type="button" class="tx-line org-line" data-act="cat-edit" data-id="' + c.id + '" data-key="cat-' + c.id + '">' + disc + txt + '<span class="org-go">' + icon('right', 20) + '</span></button></li>';
      }
      var up = '<button type="button" class="step" data-act="cat-move" data-id="' + c.id + '" data-d="-1" data-key="mv-' + c.id + '-up" aria-label="Move up: ' + esc(c.name) + ', now ' + (i + 1) + ' of ' + n + '"' + (i === 0 ? ' aria-disabled="true"' : '') + '>' + icon('up') + '</button>';
      var dn = '<button type="button" class="step" data-act="cat-move" data-id="' + c.id + '" data-d="1" data-key="mv-' + c.id + '-down" aria-label="Move down: ' + esc(c.name) + ', now ' + (i + 1) + ' of ' + n + '"' + (i === n - 1 ? ' aria-disabled="true"' : '') + '>' + icon('down') + '</button>';
      return cut + '<li><div class="tx-line org-line moving">' + disc + txt + '<span class="org-mv">' + up + dn + '</span></div></li>';
    }).join('');
    return '<ul class="tx-list org-list">' + rows + '</ul>';
  }
  D.screens.categories = {
    render: function () {
      var s = S(), o = D.org(), n = s.cats.length;
      return D.subBarHtml('#/', 'Home') + '<main id="main" class="org" tabindex="-1">' +
        '<div class="org-head"><div><h1>Categories</h1><p class="org-sub">' + plural(n, 'category', 'categories') + (o.reorder ? '' : '. Tap one to change it.') + '</p></div>' +
        '<button class="add" type="button" data-act="cat-add" data-key="cat-add"' + (o.reorder ? ' aria-disabled="true"' : '') + ' aria-label="Add a category">' + icon('plus') + '<span>Add<span class="long"> category</span></span></button></div>' +
        '<div class="org-ctl"><button type="button" class="btn' + (o.reorder ? ' solid' : '') + '" data-act="cat-reorder" data-key="cat-reorder" aria-pressed="' + o.reorder + '">' + (o.reorder ? icon('check') + 'Done' : 'Change order') + '</button></div>' +
        (o.reorder ? '<p class="org-note">Use the arrows to move a category. The first four are the quick choices when you check a spend.</p>' : '') +
        listHtml() + '</main>';
    }
  };
  D.acts['cat-reorder'] = function () {
    var o = D.org(); o.reorder = !o.reorder; D.render();
    D.live(o.reorder ? 'Change order is on. Use the arrows.' : 'Order saved.');
  };
  D.acts['cat-move'] = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') return;
    var s = S(), id = el.dataset.id, d = +el.dataset.d, i = -1;
    s.cats.forEach(function (c, k) { if (c.id === id) i = k; });
    var j = i + d;
    if (i < 0 || j < 0 || j >= s.cats.length) return;
    var tmp = s.cats[i]; s.cats[i] = s.cats[j]; s.cats[j] = tmp;
    D.render();
    D.live(tmp.name + ' is now ' + (j + 1) + ' of ' + s.cats.length + '.');
    var at = document.querySelector('#app [data-key="mv-' + id + '-' + (d < 0 ? 'up' : 'down') + '"]');
    if (at && at.getAttribute('aria-disabled') === 'true') at = document.querySelector('#app [data-key="mv-' + id + '-' + (d < 0 ? 'down' : 'up') + '"]');
    if (at) at.focus();
  };

  /* ---------- add or change one (O2, O3): one form ---------- */
  D.catform = null;
  D.invalidCat = function (f) {
    var e = {}, n = f.data.name.trim();
    if (!n) e.name = 'Add a name.';
    else if (S().cats.some(function (c) { return c.id !== f.id && c.name.toLowerCase() === n.toLowerCase(); })) e.name = 'You already have a category called “' + n + '”.';
    if (!f.data.emoji || !EMOJI_RE.test(f.data.emoji)) e.emoji = 'Choose an emoji.';
    return e;
  };
  function cfKeys(f) { var e = D.invalidCat(f); return ['name', 'emoji'].filter(function (k) { return e[k]; }); }
  D.openCatForm = function (mode, opts) {
    opts = opts || {};
    var s = S(), c = mode === 'edit' ? cat(opts.id) : null;
    var f = D.catform = {mode: mode, id: c ? c.id : null, touched: {}, attempted: !!opts.attempted, saving: !!opts.saving,
      data: c ? {name: c.name, emoji: c.emoji, sw: c.sw} : {name: opts.name || '', emoji: '🏷️', sw: nextSwatch()}};
    D.overlay.open({key: 'catform', label: mode === 'edit' ? 'Change category' : 'Add a category', cls: 'form',
      render: function () { return catFormHtml(f); }, onClose: function () { D.catform = null; D.render(); }});
  };
  function preview(f) {
    var d = f.data, c = {name: d.name.trim() || 'Category name', emoji: d.emoji || '·', sw: d.sw}, sx = D.SWATCHES[d.sw] || D.SWATCHES.slate;
    return '<span class="cat-em big" style="background:' + sx[0] + '" aria-hidden="true">' + esc(c.emoji) + '</span><div class="cf-prev-r">' + D.pill(c) +
      '<span class="cl-bar" aria-hidden="true"><i style="width:62%;background:' + sx[1] + '"></i></span></div>';
  }
  function cfErr(f, inv, k) {
    var show = (f.attempted || f.touched[k]) && inv[k];
    return '<p class="f-err" id="e-c' + k + '" data-err="' + k + '"' + (show ? '' : ' hidden') + '>' + icon('alert', 18) + '<span>' + esc(inv[k] || '') + '</span></p>';
  }
  function catFormHtml(f) {
    var d = f.data, inv = D.invalidCat(f), keys = cfKeys(f), busy = f.saving, edit = f.mode === 'edit';
    var shown = function (k) { return (f.attempted || f.touched[k]) && inv[k]; };
    var ro = busy ? ' readonly' : '';
    var emojis = EMOJI.map(function (e) {
      return '<button type="button" class="emo' + (d.emoji === e ? ' on' : '') + '" aria-pressed="' + (d.emoji === e) + '" data-act="cf-emoji" data-e="' + e + '" data-key="em-' + e + '" aria-label="Emoji ' + e + '"' + (busy ? ' disabled' : '') + '>' + e + '</button>';
    }).join('');
    var swatches = Object.keys(D.SWATCHES).map(function (k) {
      var x = D.SWATCHES[k], on = d.sw === k;
      return '<button type="button" class="swatch' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="cf-sw" data-sw="' + k + '" data-key="sw-' + k + '" aria-label="' + swName(k) + '" style="background:' + x[0] + ';border-color:' + x[1] + '"' + (busy ? ' disabled' : '') + '>' + (on ? icon('check') : '') + '</button>';
    }).join('');
    var body = (edit ? '<p class="f-note">Changes show on every spend in this category.</p>' : '') +
      '<div class="cf-prev" id="cf-prev" aria-hidden="true">' + preview(f) + '</div>' +
      '<div class="field"><label for="cf-name">Name</label><input class="input" id="cf-name" type="text" data-in="cf-name" data-key="cf-name" value="' + esc(d.name) + '" maxlength="40" autocomplete="off" aria-describedby="e-cname"' + (shown('name') ? ' aria-invalid="true"' : '') + ro + (edit ? '' : ' data-autofocus') + '>' + cfErr(f, inv, 'name') + '</div>' +
      '<div class="field"><span class="field-label" id="l-emoji">Emoji</span><div class="emos" role="group" aria-labelledby="l-emoji">' + emojis + '</div>' +
      '<label class="own" for="cf-emoji-in"><span class="hint">Or type or paste your own</span></label><input class="input emoji-in" id="cf-emoji-in" type="text" data-in="cf-emoji" data-key="cf-emoji-in" value="' + (EMOJI.indexOf(d.emoji) >= 0 ? '' : esc(d.emoji)) + '" placeholder="🙂" autocomplete="off" aria-describedby="e-cemoji"' + (shown('emoji') ? ' aria-invalid="true"' : '') + ro + '>' + cfErr(f, inv, 'emoji') + '</div>' +
      '<div class="field"><span class="field-label" id="l-sw">Colour</span><div class="swatches" role="radiogroup" aria-labelledby="l-sw">' + swatches + '</div></div>';
    if (edit && !busy && S().cats.length > 1) body += '<div class="del-zone"><button type="button" class="btn danger-o" data-act="cat-delete" data-key="cf-delete">' + icon('trash') + 'Delete this category</button></div>';
    var primary = busy ? 'Saving…' : edit ? 'Save changes' : 'Add category';
    var foot = '<p class="f-sum" id="cf-sum"' + (keys.length ? '' : ' hidden') + '>Still needed: ' + (keys.length === 2 ? 'a name and an emoji' : keys[0] === 'name' ? 'a name' : 'an emoji') + '.</p>' +
      '<div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="cf-cancel"' + (busy ? ' aria-disabled="true"' : '') + '>Cancel</button>' +
      '<button type="button" class="btn solid big' + (busy ? ' is-busy' : '') + '" id="cf-primary" data-act="cf-submit" data-key="cf-primary" aria-disabled="' + (keys.length || busy ? 'true' : 'false') + '">' + (busy ? '<span class="spin"></span>' : '') + primary + '</button></div>';
    return '<div class="ov-head"><h2>' + (edit ? 'Change category' : 'Add a category') + '</h2>' + D.closeBtn() + '</div><div class="ov-body">' + body + '</div><div class="ov-foot">' + foot + '</div>';
  }
  function cfMeta() {
    var f = D.catform; if (!f) return;
    var inv = D.invalidCat(f), keys = cfKeys(f);
    ['name', 'emoji'].forEach(function (k) {
      var p = document.getElementById('e-c' + k), show = (f.attempted || f.touched[k]) && inv[k];
      if (p) { p.hidden = !show; if (show) p.querySelector('span').textContent = inv[k]; }
      var ctl = document.getElementById(k === 'name' ? 'cf-name' : 'cf-emoji-in');
      if (ctl) { if (show) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
    });
    var sum = document.getElementById('cf-sum');
    if (sum) { sum.hidden = !keys.length; sum.textContent = 'Still needed: ' + (keys.length === 2 ? 'a name and an emoji' : keys[0] === 'name' ? 'a name' : 'an emoji') + '.'; }
    var btn = document.getElementById('cf-primary');
    if (btn && !f.saving) btn.setAttribute('aria-disabled', keys.length ? 'true' : 'false');
    var pv = document.getElementById('cf-prev'); if (pv) pv.innerHTML = preview(f);
  }
  D.ins['cf-name'] = function (el) { D.catform.data.name = el.value; cfMeta(); };
  D.ins['cf-emoji'] = function (el) {
    var g = firstGrapheme(el.value);
    D.catform.data.emoji = g; D.catform.touched.emoji = true;
    if (el.value !== g) el.value = g;
    cfMeta();
    var all = document.querySelectorAll('.emos .emo');
    [].forEach.call(all, function (b) { var on = b.dataset.e === g; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  D.acts['cf-emoji'] = function (el) { var f = D.catform; f.data.emoji = el.dataset.e; D.overlay.refresh('catform'); };
  D.acts['cf-sw'] = function (el) { var f = D.catform; f.data.sw = el.dataset.sw; D.overlay.refresh('catform'); };
  D.acts['cf-submit'] = function () {
    var f = D.catform;
    if (!f || f.saving) return;
    var keys = cfKeys(f);
    if (keys.length) {
      f.attempted = true;
      D.overlay.refresh('catform');
      var t = document.getElementById(keys[0] === 'name' ? 'cf-name' : 'cf-emoji-in'); if (t) t.focus();
      D.live('Not saved. Still needed: ' + (keys.length === 2 ? 'a name and an emoji' : keys[0] === 'name' ? 'a name' : 'an emoji') + '.');
      return;
    }
    f.saving = true;
    D.overlay.refresh('catform');
    if (S().frozen) return;
    D.later(function () { finishCatForm(f); }, 600);
  };
  function finishCatForm(f) {
    var s = S(), d = f.data, name = d.name.trim();
    f.saving = false;
    if (f.mode === 'add') {
      s.cats.push({id: 'c' + (++s.seq), name: name, emoji: d.emoji, sw: d.sw});
      D.overlay.close();
      D.toast('Added ' + name + ' at the end of the list.');
    } else {
      var c = cat(f.id);
      if (c) { c.name = name; c.emoji = d.emoji; c.sw = d.sw; }
      D.overlay.close();
      D.toast('Saved changes to ' + name + '.');
    }
  }
  D.acts['cat-add'] = function (el) { if (el.getAttribute('aria-disabled') !== 'true') D.openCatForm('add'); };
  D.acts['cat-edit'] = function (el) { D.openCatForm('edit', {id: el.dataset.id}); };

  /* ---------- delete: check first, then "no spends" or "choose where they go" (O6) ---------- */
  D.catDel = null;
  function delHtml() {
    var d = D.catDel, c = cat(d.id), k = used(d.id), w = waitingUse(d.id), step = d.step;
    var card = '<div class="del-card"><span class="cat-em" style="background:' + sw(c)[0] + '" aria-hidden="true">' + c.emoji + '</span><span class="tx-main"><span class="tx-store">' + esc(c.name) + '</span><span class="tx-sub">' + (k ? plural(k, 'spend', 'spends') : 'No spends') + '</span></span></div>';
    var body, foot;
    if (step === 'checking') {
      body = card + '<p class="del-check" role="status"><span class="spin" style="color:var(--petrol)"></span>Checking if it is used…</p>';
      foot = '<div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="cd-cancel" data-autofocus>Cancel</button></div>';
    } else if (step === 'empty') {
      body = card + '<p class="f-note">No spends use it. It is removed for good.</p>';
      foot = '<div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="cd-cancel" data-autofocus>Cancel</button><button type="button" class="btn danger big" data-act="cd-yes" data-key="cd-yes">Delete</button></div>';
    } else {
      var busy = step === 'busy', dest = d.dest && cat(d.dest);
      var opts = S().cats.filter(function (x) { return x.id !== d.id; }).map(function (x) {
        var on = d.dest === x.id;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="cd-dest" data-cat="' + x.id + '" data-key="cd-d-' + x.id + '"' + (busy ? ' disabled' : '') + '><i aria-hidden="true">' + x.emoji + '</i>' + esc(x.name) + '</button>';
      }).join('');
      body = card + '<p class="f-note">' + (k ? plural(k, 'spend uses', 'spends use') + ' it.' + (w ? ' ' + plural(w, 'waiting line does', 'waiting lines do') + ' too.' : '') : 'No spends use it, but ' + plural(w, 'waiting line does', 'waiting lines do') + '.') + ' Choose where ' + (k + w === 1 ? 'it goes' : 'they go') + ' first.</p>' +
        '<div class="field"><span class="field-label" id="l-dest">Move to</span><div class="chips" role="radiogroup" aria-labelledby="l-dest">' + opts + '</div></div>';
      var label = busy ? '<span class="spin"></span>Moving and deleting…' : dest ? 'Move ' + D.dots(k + w) + ' and delete' : 'Choose a category';
      foot = '<div class="foot-row"><button type="button" class="btn big" data-act="ov-close" data-key="cd-cancel"' + (busy ? ' aria-disabled="true"' : ' data-autofocus') + '>Cancel</button>' +
        '<button type="button" class="btn danger big' + (busy ? ' is-busy' : '') + '" data-act="cd-yes" data-key="cd-yes" aria-disabled="' + (busy || !dest ? 'true' : 'false') + '">' + label + '</button></div>';
    }
    return '<div class="ov-head"><h2>Delete ' + esc(c.name) + '?</h2>' + (step === 'busy' ? '' : D.closeBtn()) + '</div><div class="ov-body">' + body + '</div><div class="ov-foot">' + foot + '</div>';
  }
  D.acts['cat-delete'] = function () {
    var f = D.catform;
    if (!f || f.mode !== 'edit') return;
    startDelete(f.id);
  };
  function startDelete(id, step) {
    D.catDel = {id: id, step: step || 'checking', dest: null};
    D.overlay.open({key: 'catdel', role: 'alertdialog', label: 'Delete this category?', cls: 'confirm', render: delHtml,
      onClose: function () { if (D.catDel && !D.catDel.done) D.catDel = null; }});
    if (step || S().frozen) return;
    D.later(function () {
      if (!D.catDel) return;
      D.catDel.step = used(id) + waitingUse(id) ? 'has' : 'empty';
      D.overlay.refresh('catdel');
      var b = document.querySelector('#overlays [data-key="cd-cancel"]'); if (b) b.focus();
    }, 700);
  }
  D.acts['cd-dest'] = function (el) { var d = D.catDel; if (d.step !== 'has') return; d.dest = el.dataset.cat; D.overlay.refresh('catdel'); };
  D.acts['cd-yes'] = function (el) {
    var d = D.catDel;
    if (!d || d.step === 'busy' || el.getAttribute('aria-disabled') === 'true') return;
    d.step = 'busy';
    D.overlay.refresh('catdel');
    if (S().frozen) return;
    D.later(finishDelete, 800);
  };
  function finishDelete() {
    var s = S(), d = D.catDel, c = d && cat(d.id);
    if (!c) return;
    var moved = 0, dest = d.dest && cat(d.dest);
    if (dest) {
      s.saved.forEach(function (t) { if (t.cat === d.id) { t.cat = dest.id; moved++; } });
      s.waiting.forEach(function (w) { if (w.cat === d.id) { w.cat = dest.id; w.suggested = false; moved++; } });
    }
    s.cats = s.cats.filter(function (x) { return x.id !== d.id; });
    if (s.find) s.find.cats = s.find.cats.filter(function (x) { return x !== d.id; });
    d.done = true; D.catDel = null;
    D.overlay.closeAll();
    D.toast('Deleted ' + c.name + (moved ? '. ' + plural(moved, 'spend', 'spends') + ' moved to ' + dest.name + '.' : '.'));
    D.live('Deleted ' + c.name + '.');
  }

  /* ---------- the very first open: starter categories being set up (O1) ---------- */
  D.screens['boot-setup'] = {
    render: function () {
      var b = S().boot, n = D.CATS.length, done = Math.min(b.done, n);
      var dots = D.CATS.map(function (c, i) {
        var x = D.SWATCHES[c.sw];
        return i < done ? '<span class="bd on" style="background:' + x[0] + '">' + c.emoji + '</span>' : '<span class="bd"></span>';
      }).join('');
      return '<main id="main" class="boot" tabindex="-1">' + D.logo.replace('width="30" height="30"', 'width="56" height="56"') +
        '<h1>Setting up</h1><p>Adding your starter categories. This takes a moment.</p>' +
        '<div class="bd-row" aria-hidden="true">' + dots + '</div>' +
        '<div class="bd-bar" role="progressbar" aria-label="Adding categories" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + done + '"><i style="width:' + Math.round(done / n * 100) + '%"></i></div>' +
        '<p class="bd-n">' + done + ' of ' + n + '</p></main>';
    }
  };
  D.runSetup = function () {
    var s = S(), n = D.CATS.length;
    s.boot = {kind: 'setup', done: 0};
    D.render();
    (function step() {
      D.later(function () {
        if (!s.boot) return;
        s.boot.done++;
        if (s.boot.done >= n) { D.later(function () { s.boot = null; D.render(); }, 600); }
        else step();
        D.render();
      }, 130);
    })();
  };

  /* ---------- states for review ---------- */
  var G = 'Organise';
  var R = 'categories';
  function base(s) { s.waiting = []; D.batchFor(s); s.ui.openId = null; s.org = {reorder: false}; }
  D.addScenario({id: 'org-list', group: G, route: R, label: 'Categories, with how many spends each has', run: base});
  D.addScenario({id: 'org-reorder', group: G, route: R, label: 'Changing the order', run: function (s) { base(s); s.org.reorder = true; }});
  D.addScenario({id: 'org-add', group: G, route: R, label: 'Add a category', run: base, after: function () { D.openCatForm('add'); }});
  D.addScenario({id: 'org-notready', group: G, route: R, label: 'Not ready to save: no name', run: base, after: function () { D.openCatForm('add', {attempted: true}); }});
  D.addScenario({id: 'org-edit', group: G, route: R, label: 'Change a category', run: base, after: function () { D.openCatForm('edit', {id: 'food'}); }});
  D.addScenario({id: 'org-del-checking', group: G, route: R, label: 'Delete: checking if it is used', run: function (s) { base(s); s.frozen = true; },
    after: function () { D.openCatForm('edit', {id: 'food'}); D.acts['cat-delete'](); }});
  D.addScenario({id: 'org-del-empty', group: G, route: R, label: 'Delete: no spends, delete it', run: base,
    after: function () { startDelete('invest', 'empty'); }});
  D.addScenario({id: 'org-del-has', group: G, route: R, label: 'Delete: has spends, choose where they go', run: base,
    after: function () { startDelete('food', 'has'); }});
  D.addScenario({id: 'org-del-moving', group: G, route: R, label: 'Delete: moving and deleting', run: function (s) { base(s); s.frozen = true; },
    after: function () { startDelete('food', 'has'); D.catDel.dest = 'groceries'; D.catDel.step = 'busy'; D.overlay.refresh('catdel'); }});
  D.addScenario({id: 'org-setup', group: G, route: 'home', label: 'First open: setting up the starter categories', run: function (s) { base(s); s.frozen = true; s.boot = {kind: 'setup', done: 9}; }});
  D.addScenario({id: 'org-setup-live', group: G, route: 'home', label: 'First open, running', run: base, after: function () { D.runSetup(); }});
})();
