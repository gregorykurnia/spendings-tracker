/* Mock data and small helpers. Everything is invented. "Today" is fixed so every state is repeatable. */
(function(){
  var D = window.Daybook = window.Daybook || {};

  /* ---------- dates (local calendar days as 'YYYY-MM-DD'; weeks run Monday to Sunday) ---------- */
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONFULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function p2(n){ return (n < 10 ? '0' : '') + n; }

  D.TODAY = '2026-10-25'; // a Sunday
  D.parse = function (iso) { var a = iso.split('-'); return new Date(+a[0], +a[1] - 1, +a[2], 12); };
  D.iso = function (dt) { return dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()); };
  D.addDays = function (iso, n) { var dt = D.parse(iso); dt.setDate(dt.getDate() + n); return D.iso(dt); };
  D.dshort = function (iso) { var dt = D.parse(iso); return DOW[dt.getDay()] + ' ' + dt.getDate() + ' ' + MON[dt.getMonth()]; };
  D.dmy = function (iso) { var dt = D.parse(iso); return dt.getDate() + ' ' + MON[dt.getMonth()] + ' ' + dt.getFullYear(); };
  D.dlong = function (iso) { return D.dshort(iso) + ' ' + iso.slice(0, 4); };
  D.monthName = function (iso) { return MONFULL[D.parse(iso).getMonth()]; };

  /* ---------- money: whole rupiah, dots between thousands ---------- */
  D.dots = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  D.rp = function (n) { return 'Rp ' + D.dots(n); };

  /* ---------- categories: emoji and colour are the user's; the colour has a tint (pills) and a solid (charts) ---------- */
  D.SWATCHES = {
    apricot:['#FFE3C8','#D4701C'], mint:['#D9F0D6','#3F9A4E'], sky:['#D6E8FA','#2F7FC4'], rose:['#FAD9E6','#D14F86'],
    lilac:['#E4DCF8','#7C5FD0'], aqua:['#CFF0EB','#22998A'], coral:['#FFD9D0','#DB5B43'], sand:['#EFE3CF','#A27B4C'],
    lime:['#E6F2C2','#74991A'], indigo:['#D8DEF8','#4458C0'], slate:['#E3E8EA','#62767F'], plum:['#EBD3EE','#9C48A8'],
    cyan:['#D3EEF5','#2490B0']
  };
  /* the owner's order: the ones used most come first */
  D.CATS = [
    {id:'groceries', name:'Groceries',           emoji:'🛒', sw:'mint'},
    {id:'food',      name:'Food & Drink',        emoji:'🍽️', sw:'apricot'},
    {id:'transport', name:'Transport',           emoji:'🚗', sw:'sky'},
    {id:'shopping',  name:'Shopping',            emoji:'👗', sw:'rose'},
    {id:'subs',      name:'Subscriptions',       emoji:'🔧', sw:'aqua'},
    {id:'home',      name:'Home & Utilities',    emoji:'🏠', sw:'lilac'},
    {id:'health',    name:'Health',              emoji:'💊', sw:'coral'},
    {id:'fun',       name:'Entertainment',       emoji:'🎮', sw:'plum'},
    {id:'telco',     name:'Telecommunications',  emoji:'📶', sw:'indigo'},
    {id:'edu',       name:'Education',           emoji:'🎓', sw:'lime'},
    {id:'travel',    name:'Travel',              emoji:'✈️', sw:'cyan'},
    {id:'love',      name:'Relationship',        emoji:'💑', sw:'rose'},
    {id:'church',    name:'Church & Giving',     emoji:'⛪', sw:'sand'},
    {id:'biz',       name:'Business',            emoji:'💼', sw:'indigo'},
    {id:'invest',    name:'Investments',         emoji:'📈', sw:'slate'},
    {id:'other',     name:'Other',               emoji:'❓', sw:'slate'}
  ];
  D.catById = function (id, list) {
    var a = list || (D.S && D.S.cats) || D.CATS;
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  };

  /* the suggested category comes from the store name */
  var RULES = [
    [/INDOMARET|ALFAMART|ALFAMIDI|SUPERINDO|LOTTE MART/, 'groceries'],
    [/KOPI|STARBUCKS|WARUNG|AYAM|SATE|BAKSO|GOFOOD|GRABFOOD|PIZZA|KFC/, 'food'],
    [/GRAB\*|GOJEK|BLUE ?BIRD|MRT|KRL|COMMUTER|TRANSJAKARTA|TOLL|PERTAMINA/, 'transport'],
    [/TOKOPEDIA|SHOPEE|ZARA|UNIQLO|LAZADA|BLIBLI/, 'shopping'],
    [/NETFLIX|SPOTIFY|YOUTUBE|DISNEY|ICLOUD|GOOGLE ONE/, 'subs'],
    [/PLN|PDAM|GAS NEGARA/, 'home'],
    [/KIMIA FARMA|GUARDIAN|HALODOC|APOTEK|KLINIK/, 'health'],
    [/CGV|XXI|STEAM|PLAYSTATION/, 'fun'],
    [/TELKOMSEL|INDOSAT|BYU|INDIHOME/, 'telco'],
    [/GRAMEDIA|UDEMY|COURSERA/, 'edu'],
    [/TIKET\.COM|TRAVELOKA|GARUDA|AGODA/, 'travel'],
    [/GEREJA|YAYASAN|GKI|HKBP/, 'church']
  ];
  D.suggest = function (store) {
    var s = String(store).toUpperCase();
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(s)) return RULES[i][1];
    return null;
  };

  /* ---------- saved transactions: the same numbers every time ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var GEN = [
    ['INDOMARET {d4}','groceries',14000,150000,6,['Snacks','Water and bread','']],
    ['ALFAMART {d4}','groceries',12000,130000,5,['','Milk and eggs']],
    ['SUPERINDO KEMANG','groceries',140000,420000,1,['Weekly groceries']],
    ['KOPI KENANGAN {d3}','food',22000,48000,4,['Coffee','']],
    ['AYAM GEPREK BENSU','food',26000,60000,3,['Lunch','']],
    ['WARUNG PADANG SARI','food',30000,85000,3,['Lunch','Dinner']],
    ['STARBUCKS {d4}','food',55000,120000,2,['']],
    ['GRAB* A-{d1}{L}{L}{d1}','transport',16000,95000,6,['','Ride home']],
    ['GOJEK*TRIP {d4}','transport',14000,70000,3,['']],
    ['KRL COMMUTERLINE','transport',8000,30000,2,['Top up']],
    ['PERTAMINA SPBU {d4}','transport',100000,300000,1,['Fuel']],
    ['TOKOPEDIA','shopping',45000,900000,2,['']],
    ['SHOPEE','shopping',30000,600000,2,['']],
    ['UNIQLO PLAZA SENAYAN','shopping',199000,900000,0.5,['Shirts']],
    ['KIMIA FARMA {d4}','health',30000,250000,1,['Vitamins']],
    ['CGV GRAND INDONESIA','fun',60000,220000,1,['Movie']],
    ['TIKET.COM','travel',350000,1500000,0.3,['Train tickets']],
    ['GRAMEDIA PIM','edu',80000,320000,0.5,['Books']]
  ];
  var HAND = [ // typed in by hand: free text, not the bank's capitals
    ['Parkir','transport',2000,10000,['']],
    ['Warung dekat kantor','food',15000,40000,['Lunch, cash']],
    ['Tukang sayur','groceries',20000,80000,['Vegetables']]
  ];
  var MONTHLY = [ // day of month, store, category, amount
    [3,'INDIHOME FIBER','telco',385000],
    [4,'YAYASAN GEREJA KASIH','church',500000],
    [5,'SPOTIFY P3F2A9','subs',59000],
    [12,'GOOGLE ONE','subs',29000],
    [20,'PLN PREPAID 5390 4421','home',300000],
    [23,'NETFLIX.COM','subs',186000]
  ];
  var WEIGHT_TOTAL = GEN.reduce(function (s, g) { return s + g[4]; }, 0);
  var PER_DAY = [1,2,3,3,4,4,5];

  function deco(s, r) {
    return s.replace(/\{d(\d)\}/g, function (_, n) { var o = ''; for (var i = 0; i < +n; i++) o += Math.floor(r() * 10); return o; })
            .replace(/\{L\}/g, function () { return 'ABCDEFGHJKLMNPQRSTUVWXYZ'.charAt(Math.floor(r() * 24)); });
  }
  function pick(r) {
    var x = r() * WEIGHT_TOTAL;
    for (var i = 0; i < GEN.length; i++) { x -= GEN[i][4]; if (x <= 0) return GEN[i]; }
    return GEN[0];
  }
  function r500(n) { return Math.max(1000, Math.round(n / 500) * 500); }
  function days(from, to) { var o = [], d = from; while (d <= to) { o.push(d); d = D.addDays(d, 1); } return o; }

  /* all transactions from..to, adding up to exactly `target` once the fixed ones are counted */
  function genRange(r, from, to, target, o) {
    o = o || {};
    var fixed = o.fixed || [], noSpend = o.noSpend || [], skipMonthly = o.skipMonthly || [];
    var out = fixed.map(function (t) { return t; });
    var gen = [], monthly = [];
    days(from, to).forEach(function (day) {
      var dom = +day.slice(8);
      MONTHLY.forEach(function (m) {
        if (m[0] === dom && !skipMonthly.some(function (k) { return m[1].indexOf(k) === 0; })) monthly.push({date: day, store: m[1], amount: m[3], cat: m[2], note: '', src: 'shot'});
      });
      if (noSpend.indexOf(day) >= 0) return;
      var n = PER_DAY[Math.floor(r() * PER_DAY.length)];
      for (var k = 0; k < n; k++) {
        if (r() < 0.14) {
          var h = HAND[Math.floor(r() * HAND.length)];
          gen.push({date: day, store: h[0], amount: r500(h[2] + (h[3] - h[2]) * r()), cat: h[1], note: h[4][Math.floor(r() * h[4].length)], src: 'hand'});
        } else {
          var g = pick(r);
          var amt = g[2] + (g[3] - g[2]) * Math.pow(r(), 1.5);
          gen.push({date: day, store: deco(g[0], r), amount: r500(amt), cat: g[1], note: g[5][Math.floor(r() * g[5].length)], src: 'shot'});
        }
      }
    });
    var fixedSum = fixed.reduce(function (s, t) { return s + t.amount; }, 0);
    var monthlySum = monthly.reduce(function (s, t) { return s + t.amount; }, 0);
    var need = target - fixedSum - monthlySum;
    var genSum = gen.reduce(function (s, t) { return s + t.amount; }, 0);
    var scale = need / genSum, got = 0, big = gen[0];
    gen.forEach(function (t) { t.amount = r500(t.amount * scale); got += t.amount; if (t.amount > big.amount) big = t; });
    big.amount += need - got; // the largest one soaks up the rounding, so the total is exact
    return out.concat(monthly, gen);
  }

  /* stress set (?stress): hundreds of entries, store names with no spaces, spends up to tens of millions,
     empty notes, and a few whose category no longer exists */
  function stressSaved() {
    var r = rng(777), out = [];
    var names = [
      'INDOMARET*POINT*KEMANG*RAYA*BLOK*C*NO*17*JAKARTA*SELATAN*DKI*JAKARTA*12730*BCA*DEBIT*2510*ID',
      'TOKO-BESAR-ELEKTRONIK-JAKARTA-TIMUR-CABANG-CAWANG-KAV-12', 'PT-TELEKOMUNIKASI-SELULAR-PAKET-DATA-BULANAN',
      'WARUNG', 'GRAB* A-7XK2', 'KOPI KENANGAN SCBD', 'TOKOPEDIA', 'SHOPEE', 'BLUE BIRD TAXI', 'ALFAMART', 'PERTAMINA SPBU 3401'
    ];
    var ids = D.CATS.map(function (c) { return c.id; });
    for (var i = 0; i < 240; i++) {
      var big = i % 24 === 5;
      var amt = big ? Math.round((5000000 + r() * 43250000) / 50000) * 50000 : Math.max(1000, Math.round((5000 + r() * 395000) / 500) * 500);
      out.push({date: D.addDays('2026-10-25', -Math.floor(r() * 55)), store: names[i % names.length] + (i % 4 === 0 ? ' ' + (100 + i) : ''),
        amount: amt, cat: i % 37 === 11 ? 'deleted-category' : ids[Math.floor(r() * ids.length)], note: '', src: i % 5 === 0 ? 'hand' : 'shot'});
    }
    out.push({date: '2026-10-24', store: 'NOTARIS-DAN-PPAT-BIAYA-BALIK-NAMA-KAVLING-JAKARTA', amount: 48250000, cat: 'biz', note: '', src: 'hand'});
    return out;
  }

  D.buildSaved = function (stress) {
    var r = rng(20261025);
    var oct = genRange(r, '2026-10-01', '2026-10-25', 6842350, {
      fixed: [{date: '2026-10-25', store: 'KOPI KENANGAN SCBD', amount: 28000, cat: 'food', note: 'Coffee', src: 'shot'}],
      noSpend: ['2026-10-07', '2026-10-14'],
      skipMonthly: ['PLN', 'NETFLIX']
    });
    var sepA = genRange(r, '2026-09-01', '2026-09-25', 7318000, {noSpend: ['2026-09-09']});
    var sepB = genRange(r, '2026-09-26', '2026-09-30', 1450000, {skipMonthly: ['INDIHOME', 'SPOTIFY', 'GOOGLE', 'PLN', 'NETFLIX']});
    var aug = genRange(r, '2026-08-01', '2026-08-31', 8240000, {noSpend: ['2026-08-16']});
    var all = oct.concat(sepA, sepB, aug, stress ? stressSaved() : []);
    all.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    all.forEach(function (t, i) { t.id = 't' + (i + 1); t.n = all.length - i; });   // n: later means added later
    return all;
  };
  D.sumRange = function (list, from, to) {
    return list.reduce(function (s, t) { return t.date >= from && t.date <= to ? s + t.amount : s; }, 0);
  };
})();
