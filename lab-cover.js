/* Which BOM items the lab already owns: Lab Inventory items with status "use" and a BOM id (the inventory's "covers" field).
   Used by the costed BOM (equipment.html) and the Spain-style cost box (qs-bench.html). No prices here.
   LabCover.enabled() is the main on/off switch, kept in this browser (same value on both pages). */
(function () {
  var LS = 'rb87-inventory-v1', PREF = 'rb87-use-inventory';
  function items() {
    var seed = window.LAB_INVENTORY || { version: 0, items: [] }, list = seed.items.slice();
    try {
      var j = JSON.parse(localStorage.getItem(LS) || 'null');
      if (j && Array.isArray(j.items)) {
        list = j.items;
        if (j.v !== seed.version) { var have = {}; list.forEach(function (i) { have[i.id] = 1; }); seed.items.forEach(function (s) { if (!have[s.id]) list.push(s); }); }
      }
    } catch (e) { }
    return list;
  }
  function qtyOf(i) { var m = /\d+/.exec(String(i.qty == null ? '' : i.qty)); return m ? Math.max(1, parseInt(m[0], 10)) : 1; }
  function allocator() {
    var pool = items().filter(function (i) { return i.status === 'use' && i.bom; }).map(function (i) {
      return { id: i.id, name: i.name, ids: String(i.bom).split(/[,;]\s*/).map(function (s) { return s.trim(); }).filter(Boolean), left: qtyOf(i) };
    });
    return {
      take: function (bomId, need) {
        var got = 0;
        pool.forEach(function (p) { if (got >= need || p.left <= 0 || p.ids.indexOf(bomId) < 0) return; var t = Math.min(p.left, need - got); p.left -= t; got += t; });
        return got;
      }
    };
  }
  function enabled() { try { return localStorage.getItem(PREF) !== '0'; } catch (e) { return true; } }
  function setEnabled(v) { try { localStorage.setItem(PREF, v ? '1' : '0'); } catch (e) { } }
  window.LabCover = { items: items, allocator: allocator, enabled: enabled, setEnabled: setEnabled };
})();
