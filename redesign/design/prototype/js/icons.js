/* Icons: one 24px outline set (1.9px stroke, round caps). Add new ones here only. */
(function(){
  var D = window.Daybook = window.Daybook || {};
  var P = {
    check:  '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    menu:   '<path d="M4 8h16M4 16h16"/>',
    right:  '<path d="M9 6l6 6-6 6"/>',
    left:   '<path d="M15 6l-6 6 6 6"/>',
    down:   '<path d="M6 9l6 6 6-6"/>',
    close:  '<path d="M6 6l12 12M18 6L6 18"/>',
    chart:  '<path d="M6 20v-7M12 20V5M18 20v-10"/>',
    list:   '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
    grid:   '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    repeat: '<path d="M17 3l3 3-3 3M20 6H9a5 5 0 0 0-5 5M7 21l-3-3 3-3M4 18h11a5 5 0 0 0 5-5"/>',
    "in":   '<path d="M17 7L7 17M7 9v8h8"/>',
    alert:  '<path d="M12 4.2l9 15.6H3z"/><path d="M12 10v4.2M12 17.3h.01"/>',
    tag:    '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z"/><path d="M8 8h.01"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19z"/><path d="M14.5 6.5l3 3"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    image:  '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17.5l4.2-4.2 3 3 2.8-2.8 4 4"/>',
    dash:   '<path d="M7 12h10"/>'
  };

  D.icon = function (name, px) {
    var s = px ? ' style="width:' + px + 'px;height:' + px + 'px"' : '';
    return '<svg class="i" aria-hidden="true" focusable="false"' + s + '><use href="#i-' + name + '"/></svg>';
  };

  D.sprite = function () {
    var out = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">';
    Object.keys(P).forEach(function (k) { out += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + P[k] + '</symbol>'; });
    return out + '</svg>';
  };

  /* working name and mark, carried over from direction D; branding is still open */
  D.logo = '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#14586F"/><path d="M19 0v15.5l-3.5-3-3.5 3V0z" fill="#FFE88A"/></svg>';
})();
