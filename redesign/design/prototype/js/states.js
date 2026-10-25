/* Group 5: app-wide states. Loading, failed to load, no connection (opening offline, and using it offline),
   and the first-use messages other screens borrow. Whole-app states are state.boot; "offline" is state.online. */
(function(){
  var D = window.Daybook;
  var esc = D.esc, icon = D.icon;
  D.acts = D.acts || {};
  D.screens = D.screens || {};
  D.scenarios = D.scenarios || [];
  function S() { return D.S; }

  /* ---------- no connection while the app is open: read-only ---------- */
  D.offline = function () { return !!(D.S && D.S.online === false); };
  D.netError = 'No connection. Nothing was saved. Try again when you are back online.';
  D.netShort = 'No connection. Try again when you are back online.';
  D.offlineBanner = function () {
    if (!D.offline()) return '';
    return '<div class="offline" role="status">' + icon('alert', 20) + '<p><b>No connection.</b> You can look around. Adding, saving, deleting and importing wait until you are online.</p></div>';
  };

  /* ---------- loading: the same layout in grey, so nothing jumps when it arrives ---------- */
  function rows(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<li class="sk-row"><i class="sk disc"></i><span class="sk-t"><i class="sk l1"></i><i class="sk l2"></i></span><i class="sk r"></i></li>';
    return '<ul class="sk-rows" aria-hidden="true">' + out + '</ul>';
  }
  var SK = {
    home: function () {
      return D.barHtml() + '<main id="main" class="home" tabindex="-1" aria-busy="true"><p class="sr" role="status">Loading your transactions</p>' +
        '<div class="glance sk-card" aria-hidden="true"><i class="sk l2"></i><i class="sk big"></i><i class="sk l1"></i></div>' +
        '<section class="inbox"><div class="ib-head" aria-hidden="true"><div><i class="sk h1"></i><i class="sk l2 gap"></i></div><i class="sk pillbtn"></i></div>' + rows(5) + '</section></main>';
    },
    spending: function () {
      return D.subBarHtml('#/', 'Home') + '<main id="main" class="sp" tabindex="-1" aria-busy="true"><p class="sr" role="status">Loading your spending</p>' +
        '<div class="sp-top" aria-hidden="true"><div class="sp-head"><i class="sk h1"></i><i class="sk seg"></i></div><div class="pnav"><i class="sk circ"></i><i class="sk l2 mid"></i><i class="sk circ"></i></div></div>' +
        '<div class="sp-left"><section class="hero sk-card" aria-hidden="true"><i class="sk l2"></i><i class="sk big"></i><i class="sk l1 gap"></i></section></div>' +
        '<div class="sp-right"><section class="sec sec-cats" aria-hidden="true"><i class="sk l2"></i>' + rows(5) + '</section></div></main>';
    },
    transactions: function () {
      return D.subBarHtml('#/', 'Home') + '<main id="main" class="fx" tabindex="-1" aria-busy="true"><p class="sr" role="status">Loading your transactions</p>' +
        '<div aria-hidden="true"><i class="sk h1"></i><i class="sk search"></i><div class="sk-ctl"><i class="sk pillbtn"></i><i class="sk pillbtn wide"></i></div></div>' + rows(7) + '</main>';
    },
    categories: function () {
      return D.subBarHtml('#/', 'Home') + '<main id="main" class="org" tabindex="-1" aria-busy="true"><p class="sr" role="status">Loading your categories</p>' +
        '<div class="org-head" aria-hidden="true"><div><i class="sk h1"></i><i class="sk l2 gap"></i></div><i class="sk pillbtn"></i></div>' + rows(8) + '</main>';
    }
  };
  D.screens['boot-loading'] = {render: function () { return (SK[D.route] || SK.home)(); }};
  D.runLoading = function (ms) {
    var s = S();
    s.boot = {kind: 'loading'};
    D.render();
    D.later(function () { s.boot = null; D.render(); }, ms || 1300);
  };

  /* ---------- failed to load ---------- */
  D.screens['boot-failed'] = {
    render: function () {
      var b = S().boot, cats = b.what === 'categories', what = cats ? 'categories' : 'transactions';
      var bar = D.route === 'home' ? D.barHtml() : D.subBarHtml('#/', 'Home');
      return bar + '<main id="main" class="failed" tabindex="-1"><span class="fail-mark">' + icon('alert', 28) + '</span>' +
        '<h1>Couldn’t load your ' + what + '</h1><p>Something went wrong while loading. Try again in a moment.</p>' +
        '<button type="button" class="btn solid big' + (b.retrying ? ' is-busy' : '') + '" data-act="boot-retry" data-key="boot-retry"' + (b.retrying ? ' aria-disabled="true"' : '') + '>' + (b.retrying ? '<span class="spin"></span>Trying again…' : 'Try again') + '</button></main>';
    }
  };

  /* ---------- no connection when the app opens: nothing can load ---------- */
  D.screens['boot-offline'] = {
    render: function () {
      var b = S().boot;
      return '<main id="main" class="boot" tabindex="-1">' + D.logo.replace('width="30" height="30"', 'width="56" height="56"') +
        '<h1>No connection</h1><p>Daybook needs the internet to load your spending. Check your connection, then try again.</p>' +
        '<button type="button" class="btn solid big boot-btn' + (b.retrying ? ' is-busy' : '') + '" data-act="boot-retry" data-key="boot-retry"' + (b.retrying ? ' aria-disabled="true"' : '') + '>' + (b.retrying ? '<span class="spin"></span>Trying again…' : 'Try again') + '</button>' +
        (b.note && !b.retrying ? '<p class="boot-note" role="status">' + esc(b.note) + '</p>' : '') + '</main>';
    }
  };

  D.acts['boot-retry'] = function (el) {
    var s = S(), b = s.boot;
    if (!b || b.retrying || (el && el.getAttribute && el.getAttribute('aria-disabled') === 'true')) return;
    b.retrying = true;
    D.render();
    if (s.frozen) return;
    D.later(function () {
      b.retrying = false;
      if (b.kind === 'offline' && !b.attempts) {          // the first try fails too, so the retry feedback can be seen
        b.attempts = 1; b.note = 'Still no connection.';
        D.render();
        var t = document.querySelector('#app [data-key="boot-retry"]'); if (t) t.focus();
        return;
      }
      s.online = true;
      s.boot = {kind: 'loading'};
      D.render();
      D.later(function () { s.boot = null; D.render(); }, 1100);
    }, 1000);
  };

  /* ---------- states for review ---------- */
  var G = 'App-wide';
  function seeded(s) { s.waiting = []; D.batchFor(s); s.ui.openId = null; }
  function frozen(s) { seeded(s); s.frozen = true; }
  D.addScenario({id: 'app-first', group: G, route: 'home', label: 'First use: nothing at all yet', run: function (s) { s.saved = []; s.waiting = []; }});
  D.addScenario({id: 'app-first-spending', group: G, route: 'spending', label: 'First use: Spending', run: function (s) { s.saved = []; s.waiting = []; }});
  D.addScenario({id: 'app-first-list', group: G, route: 'transactions', label: 'First use: All transactions', run: function (s) { s.saved = []; s.waiting = []; }});
  D.addScenario({id: 'app-loading', group: G, route: 'home', label: 'Loading: transactions', run: function (s) { frozen(s); s.boot = {kind: 'loading'}; }});
  D.addScenario({id: 'app-loading-spending', group: G, route: 'spending', label: 'Loading: Spending', run: function (s) { frozen(s); s.boot = {kind: 'loading'}; }});
  D.addScenario({id: 'app-loading-list', group: G, route: 'transactions', label: 'Loading: All transactions', run: function (s) { frozen(s); s.boot = {kind: 'loading'}; }});
  D.addScenario({id: 'app-loading-cats', group: G, route: 'categories', label: 'Loading: categories', run: function (s) { frozen(s); s.boot = {kind: 'loading'}; }});
  D.addScenario({id: 'app-failed', group: G, route: 'home', label: "Failed to load: transactions", run: function (s) { frozen(s); s.boot = {kind: 'failed', what: 'transactions'}; }});
  D.addScenario({id: 'app-failed-cats', group: G, route: 'categories', label: "Failed to load: categories", run: function (s) { frozen(s); s.boot = {kind: 'failed', what: 'categories'}; }});
  D.addScenario({id: 'app-failed-retrying', group: G, route: 'home', label: 'Failed to load: trying again', run: function (s) { frozen(s); s.boot = {kind: 'failed', what: 'transactions', retrying: true}; }});
  D.addScenario({id: 'app-failed-live', group: G, route: 'home', label: 'Failed to load, running: try again', run: function (s) { seeded(s); s.boot = {kind: 'failed', what: 'transactions'}; }});
  D.addScenario({id: 'app-offline-boot', group: G, route: 'home', label: 'No connection: opening the app', run: function (s) { frozen(s); s.online = false; s.boot = {kind: 'offline', attempts: 0}; }});
  D.addScenario({id: 'app-offline-boot-live', group: G, route: 'home', label: 'No connection, running: try again twice', run: function (s) { seeded(s); s.online = false; s.boot = {kind: 'offline', attempts: 0}; }});
  D.addScenario({id: 'app-offline', group: G, route: 'home', label: 'No connection while using it', run: function (s) { seeded(s); s.online = false; s.ui.openId = s.waiting[0].id; }});
  D.addScenario({id: 'app-offline-save', group: G, route: 'home', label: 'No connection: saving', run: function (s) { seeded(s); s.online = false; },
    after: function (s) { D.openForm('edit-waiting', {id: s.waiting[0].id}); D.acts['form-submit'](); }});
})();
