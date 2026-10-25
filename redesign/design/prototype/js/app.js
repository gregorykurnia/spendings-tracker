/* App shell: routing, rendering, events, and the review-only state switcher. Loads last. */
(function(){
  var D = window.Daybook;
  D.acts = D.acts || {};
  D.ins = D.ins || {};
  D.screens = D.screens || {};

  /* screens that later sessions design; until then they say so */
  var LATER = {};
  D.stubHtml = function (title) {
    return D.barHtml() + '<main id="main" class="stub" tabindex="-1"><h1>' + title + '</h1>' +
      '<p>This screen is designed in a later session of the prototype.</p>' +
      '<a class="btn" href="#/">Back to what is waiting</a></main>';
  };
  Object.keys(LATER).forEach(function (k) {
    if (!D.screens[k]) D.screens[k] = {render: function () { return D.stubHtml(LATER[k]); }};
  });

  /* #/name?key=value */
  D.parseHash = function () {
    var a = location.hash.replace(/^#\/?/, '').split('?'), params = {};
    if (a[1]) a[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return {route: a[0] && D.screens[a[0]] ? a[0] : 'home', params: params};
  };
  D.routeName = function () { return D.parseHash().route; };
  function hashFor(route, params) {
    var q = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return route === 'home' ? '#/' : '#/' + route + (q ? '?' + q : '');
  }

  D.render = function () {
    var app = document.getElementById('app');
    var a = document.activeElement;
    var key = a && app.contains(a) && a.dataset ? a.dataset.key : null;
    var boot = D.S && D.S.boot && D.screens['boot-' + D.S.boot.kind];   // a whole-app state replaces the screen
    var scr = boot || D.screens[D.route] || D.screens.home;
    app.innerHTML = '<a class="skip" href="#/" data-act="skip">Skip to the content</a>' + scr.render();
    document.body.classList.toggle('has-bar', !!app.querySelector('.actionbar'));
    document.body.classList.toggle('offline', D.offline());
    if (scr.after) scr.after();
    if (key) {
      var t = app.querySelector('[data-key="' + key + '"]');
      if (t) t.focus({preventScroll: true});
    }
  };

  window.addEventListener('hashchange', function () {
    D.overlay.closeAll();
    var r = D.parseHash();
    D.route = r.route; D.params = r.params; D._searchFocused = false;
    D.render();
    window.scrollTo(0, 0);
    var m = document.getElementById('main');
    if (m) m.focus({preventScroll: true});
  });

  /* ---------- one listener for each kind of event ---------- */
  /* with no connection the app is read-only: these change data, so they say why they did nothing */
  var WRITES = {accept: 1, 'accept-all': 1, throw: 1, keep: 1, 'set-cat': 1, add: 1, 'tray-retry': 1, 'cat-move': 1};
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return;
    if (WRITES[el.dataset.act] && D.offline()) { D.toast(D.netShort); D.live(D.netShort); return; }
    var fn = D.acts[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('[data-in]');
    if (el && D.ins[el.dataset.in]) D.ins[el.dataset.in](el, e);
  });
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (el && el.dataset && el.dataset.in && D.touch) D.touch(el.dataset.in);
  });
  document.addEventListener('keydown', function (e) { D.overlay.onKey(e); });
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (D.chartPointer) D.chartPointer(e); });
  });

  D.acts['ov-close'] = function () {
    var top = D.overlay.top();
    if (top && top.cfg.key === 'form' && D.form && D.form.saving) return;
    if (top && top.cfg.key === 'confirm' && D.del && D.del.busy) return;
    if (top && top.cfg.key === 'catdel' && D.catDel && D.catDel.step === 'busy') return;
    if (top && top.cfg.key === 'catform' && D.catform && D.catform.saving) return;
    D.overlay.close();
  };
  D.acts.nav = function () { D.overlay.closeAll(); };
  D.acts.skip = function (el, e) { e.preventDefault(); var m = document.getElementById('main'); if (m) m.focus(); };
  D.acts.scenario = function (el) { D.applyScenario(el.dataset.id); };

  /* ---------- states ---------- */
  D.applyScenario = function (id, boot) {
    var def = D.scenarios.filter(function (sc) { return sc.id === id; })[0] || D.scenarios[0];
    D.overlay.closeAll();
    var s = D.S = D.makeState({stress: D.stress});
    s.scenario = def.id;
    /* a state names its screen; a link with its own #/screen wins at start */
    if (!(boot && location.hash.replace(/^#\/?/, '') !== '')) {
      D.route = def.route || 'home'; D.params = def.params || {}; D._searchFocused = false;
      try { history.replaceState(null, '', location.pathname + location.search + hashFor(D.route, D.params)); } catch (e) {}
    }
    def.run(s);
    D.render();
    if (!boot) { var m = document.getElementById('main'); if (m) m.focus({preventScroll: true}); }
    if (def.after) def.after(s);
    try { history.replaceState(null, '', '?state=' + encodeURIComponent(def.id) + (D.stress ? '&stress' : '') + location.hash); } catch (e) {}
    window.scrollTo(0, 0);
  };

  /* ---------- start ---------- */
  document.body.insertAdjacentHTML('afterbegin', D.sprite());
  var q = new URLSearchParams(location.search);
  D.stress = q.has('stress');
  var start = D.parseHash();
  D.route = start.route; D.params = start.params;
  var picker = document.getElementById('picker');
  if (picker) picker.addEventListener('change', function () {
    var n = picker.files ? picker.files.length : 0;
    picker.value = '';
    if (n) D.startImport(new Array(n).fill('ok'));
  });
  D.applyScenario(q.get('state') || 'review-fresh', true);
})();
