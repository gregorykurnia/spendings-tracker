/* Shared UI pieces: escaping, category pill, overlays (sheet on phone, dialog on desktop), toast, announcements. */
(function(){
  var D = window.Daybook = window.Daybook || {};

  D.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };

  /* a category as emoji + name on its own colour */
  D.pill = function (cat) {
    if (!cat) return '';
    var sw = D.SWATCHES[cat.sw] || D.SWATCHES.slate;
    return '<span class="pill" style="background:' + sw[0] + '"><i aria-hidden="true">' + cat.emoji + '</i>' + D.esc(cat.name) + '</span>';
  };

  /* ---------- announcements for screen readers, and a quiet toast ---------- */
  D.live = function (msg) {
    var el = document.getElementById('live');
    if (!el) return;
    el.textContent = '';
    setTimeout(function () { el.textContent = msg; }, 30);
  };
  var toastTimer;
  D.toast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 4200);
  };

  /* ---------- overlays ---------- */
  var stack = [];
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function renderInto(rec) {
    var panel = rec.el.querySelector('.panel');
    var body = panel.querySelector('.ov-body');
    var scroll = body ? body.scrollTop : 0;
    var a = document.activeElement;
    var key = a && panel.contains(a) && a.dataset ? a.dataset.key : null;
    panel.innerHTML = rec.cfg.render();
    var nb = panel.querySelector('.ov-body');
    if (nb) nb.scrollTop = scroll;
    if (key) { var t = panel.querySelector('[data-key="' + key + '"]'); if (t) t.focus({preventScroll: true}); }
  }

  D.overlay = {
    /* cfg: { key, label, cls, render(), onClose() } */
    open: function (cfg) {
      var el = document.createElement('div');
      el.className = 'ov';
      el.dataset.ov = cfg.key;
      el.innerHTML = '<div class="scrim" data-act="ov-close"></div>' +
        '<div class="panel ' + (cfg.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + D.esc(cfg.label) + '" tabindex="-1">' + cfg.render() + '</div>';
      document.getElementById('overlays').appendChild(el);
      stack.forEach(function (s) { s.el.inert = true; });
      document.getElementById('app').inert = true;
      var a = document.activeElement;
      var rec = {el: el, cfg: cfg, opener: a && a.dataset ? a.dataset.key || null : null};
      stack.push(rec);
      var panel = el.querySelector('.panel');
      var first = panel.querySelector('[data-autofocus]') || panel;
      first.focus({preventScroll: true});
      return rec;
    },
    close: function () {
      var rec = stack.pop();
      if (!rec) return;
      rec.el.remove();
      var top = stack[stack.length - 1];
      if (top) top.el.inert = false; else document.getElementById('app').inert = false;
      if (rec.cfg.onClose) rec.cfg.onClose();
      if (!top) {
        var back = rec.opener ? document.querySelector('#app [data-key="' + rec.opener + '"]') : null;
        var fallback = back || document.getElementById('main');
        if (fallback) fallback.focus({preventScroll: true});
      }
    },
    closeAll: function () { while (stack.length) D.overlay.close(); },
    top: function () { return stack[stack.length - 1] || null; },
    has: function (key) { return stack.some(function (s) { return s.cfg.key === key; }); },
    refresh: function (key) {
      stack.forEach(function (s) { if (!key || s.cfg.key === key) renderInto(s); });
    },
    onKey: function (e) {
      var top = D.overlay.top();
      if (!top) return;
      if (e.key === 'Escape') { e.preventDefault(); D.overlay.close(); return; }
      if (e.key !== 'Tab') return;
      var list = [].slice.call(top.el.querySelectorAll(FOCUSABLE)).filter(function (n) { return !n.hidden && n.getAttribute('aria-hidden') !== 'true'; });
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0], last = list[list.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === top.el.querySelector('.panel'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    }
  };

  /* the close button every overlay header carries */
  D.closeBtn = function (label) {
    return '<button type="button" class="icon-btn" data-act="ov-close" data-key="ov-x" aria-label="' + D.esc(label || 'Close') + '">' + D.icon('close') + '</button>';
  };
})();
