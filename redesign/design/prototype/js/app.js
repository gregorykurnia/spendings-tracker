/* App shell: routing, rendering, events, and the review-only state switcher. Loads last. */
(function(){
  var D = window.Daybook;
  D.acts = D.acts || {};
  D.ins = D.ins || {};
  D.screens = D.screens || {};

  /* screens that later sessions design; until then they say so */
  var LATER = {
    spending: 'Spending',
    transactions: 'All transactions',
    categories: 'Categories'
  };
  Object.keys(LATER).forEach(function (k) {
    if (D.screens[k]) return;
    D.screens[k] = {render: function () {
      return D.barHtml() + '<main id="main" class="stub" tabindex="-1"><h1>' + LATER[k] + '</h1>' +
        '<p>This screen is designed in a later session of the prototype.</p>' +
        '<a class="btn" href="#/">Back to what is waiting</a></main>';
    }};
  });

  D.routeName = function () {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return h && D.screens[h] ? h : 'home';
  };

  D.render = function () {
    var app = document.getElementById('app');
    var a = document.activeElement;
    var key = a && app.contains(a) && a.dataset ? a.dataset.key : null;
    var scr = D.screens[D.route] || D.screens.home;
    app.innerHTML = '<a class="skip" href="#/" data-act="skip">Skip to the content</a>' + scr.render();
    document.body.classList.toggle('has-bar', !!app.querySelector('.actionbar'));
    if (key) {
      var t = app.querySelector('[data-key="' + key + '"]');
      if (t) t.focus({preventScroll: true});
    }
  };

  window.addEventListener('hashchange', function () {
    D.overlay.closeAll();
    D.route = D.routeName();
    D.render();
    window.scrollTo(0, 0);
    var m = document.getElementById('main');
    if (m) m.focus({preventScroll: true});
  });

  /* ---------- one listener for each kind of event ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-act]');
    if (!el) return;
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

  D.acts['ov-close'] = function () {
    var top = D.overlay.top();
    if (top && top.cfg.key === 'form' && D.form && D.form.saving) return;
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
    if (!boot && D.route !== 'home') { D.route = 'home'; try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) {} }
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
  D.route = D.routeName();
  var picker = document.getElementById('picker');
  if (picker) picker.addEventListener('change', function () {
    var n = picker.files ? picker.files.length : 0;
    picker.value = '';
    if (n) D.startImport(new Array(n).fill('ok'));
  });
  D.applyScenario(q.get('state') || 'review-fresh', true);
})();
