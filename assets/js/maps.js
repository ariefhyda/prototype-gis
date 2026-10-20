/* ============================================================
   GIS Pajak — helper peta (Leaflet) + batas wilayah BIG
   ============================================================ */
window.M = (function () {
  'use strict';
  const BASE = {
    osm: { nama: 'Jalan (OSM)', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap contributors', max: 19 },
    light: { nama: 'Polos (abu-abu)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri', max: 16 },
    sat: { nama: 'Citra satelit', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri', max: 19 }
  };
  const ATTR_BIG = 'Batas wilayah: BIG (Batas Desa/Kelurahan 2022)';
  const SC = {
    kelengkapan: { nama: 'Kelengkapan koordinat', unit: '%', stops: [[0, '#FBE4E4'], [40, '#F6C9A8'], [55, '#F0E2A0'], [70, '#B9E0C4'], [85, '#5DB57A']], fmt: v => Math.round(v) + '%' },
    kepadatan: { nama: 'Kepadatan objek', unit: '/km²', stops: [[0, '#EEF3F8'], [1, '#C9DAEC'], [3, '#8DB3D9'], [6, '#4A82BC'], [12, '#1D4066']], fmt: v => v.toFixed(1).replace('.', ',') + '/km²' },
    lunas: { nama: 'Kepatuhan bayar (lunas)', unit: '%', stops: [[0, '#FBE4E4'], [40, '#F6C9A8'], [55, '#F0E2A0'], [70, '#B9E0C4'], [85, '#5DB57A']], fmt: v => Math.round(v) + '%' },
    temuan: { nama: 'Temuan & usulan aktif', unit: '', stops: [[0, '#F4F7FA'], [1, '#DDF1F3'], [2, '#8FD0D8'], [4, '#0A97A6'], [7, '#065F68']], fmt: v => v + ' entri' }
  };
  function colorFor(scale, v) { const s = SC[scale].stops; let c = s[0][1]; s.forEach(x => { if (v >= x[0]) c = x[1]; }); return c; }

  function create(el, o) {
    o = o || {};
    const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: false, minZoom: 9, maxBounds: L.latLngBounds(D.GEO.bounds).pad(0.6), maxBoundsViscosity: 0.8 });
    L.control.zoom({ position: o.zoomPos || 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution(ATTR_BIG);
    map._base = null; setBase(map, o.base || D.state.cfg.basemap || 'osm');
    if (o.fit !== false) map.fitBounds(D.GEO.bounds, { padding: [10, 10] });
    if (o.mask !== false) kabMask(map);
    map.on('unload', () => { map._dead = true; });
    setTimeout(() => { if (!map._dead) map.invalidateSize(); }, 60);
    return map;
  }
  function setBase(map, key) {
    if (map._base) map.removeLayer(map._base);
    const b = BASE[key] || BASE.osm;
    map._base = L.tileLayer(b.url, { attribution: b.attr, maxZoom: b.max, crossOrigin: true }).addTo(map);
    map._baseKey = key;
    map._base.on('tileerror', () => { if (!map._tileWarned) { map._tileWarned = true; UI.toast('Sebagian ubin peta dasar gagal dimuat. Batas wilayah dan objek tetap dapat digunakan.', 'warning', 'Peta dasar'); } });
  }
  function kabMask(map) {
    const g = D.GEO.kab.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const world = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    const holes = polys.map(p => p[0].map(c => [c[1], c[0]]));
    L.polygon([world].concat(holes), { stroke: false, fillColor: '#0E2338', fillOpacity: 0.18, interactive: false }).addTo(map);
    L.geoJSON(D.GEO.kab, { style: { color: '#0E2338', weight: 2.5, fill: false }, interactive: false }).addTo(map);
  }
  function kecLayer(map, o) {
    o = o || {};
    const lay = L.geoJSON(D.GEO.kecamatan, {
      interactive: o.interactive !== false,
      style: f => Object.assign({ color: '#15324F', weight: 1.6, opacity: 0.85, fillOpacity: 0, dashArray: null }, o.style ? o.style(f) : {}),
      onEachFeature: (f, l) => {
        if (o.tooltip !== false) l.bindTooltip(o.tooltip ? o.tooltip(f) : ('Kec. ' + f.properties.nama), { sticky: true, className: 'maptip' });
        if (o.onClick) l.on('click', (e) => o.onClick(f, e));
        if (o.hover !== false) { l.on('mouseover', () => l.setStyle({ weight: 3 })); l.on('mouseout', () => lay.resetStyle(l)); }
      }
    });
    if (o.add !== false) lay.addTo(map);
    return lay;
  }
  function desaLayer(map, o) {
    o = o || {};
    const fc = o.filter ? { type: 'FeatureCollection', features: D.GEO.desa.features.filter(o.filter) } : D.GEO.desa;
    const lay = L.geoJSON(fc, {
      interactive: o.interactive !== false,
      style: f => Object.assign({ color: '#526277', weight: 0.7, opacity: 0.7, fillOpacity: 0 }, o.style ? o.style(f) : {}),
      onEachFeature: (f, l) => {
        if (o.tooltip !== false) l.bindTooltip(o.tooltip ? o.tooltip(f) : (f.properties.tipe + ' ' + f.properties.nama + '<br><span class="t-xs">Kec. ' + f.properties.kecNama + '</span>'), { sticky: true, className: 'maptip' });
        if (o.onClick) l.on('click', (e) => o.onClick(f, e));
        if (o.hover !== false) { l.on('mouseover', () => l.setStyle({ weight: 2.2, color: '#087F8C' })); l.on('mouseout', () => lay.resetStyle(l)); }
      }
    });
    if (o.add !== false) lay.addTo(map);
    return lay;
  }
  function kecLabels(map, kecs) {
    const g = L.layerGroup();
    D.KEC.filter(k => !kecs || kecs.includes(k.kec)).forEach(k => L.marker(k.center, { interactive: false, icon: L.divIcon({ className: 'kecLabel', html: '<span>' + UI.esc(k.nama) + '</span>', iconSize: [0, 0] }) }).addTo(g));
    g.addTo(map); return g;
  }
  function scopeShade(map, kecs) {
    if (!kecs || kecs.length === D.KEC.length) return null;
    const fc = { type: 'FeatureCollection', features: D.GEO.kecamatan.features.filter(f => !kecs.includes(f.properties.kec)) };
    return L.geoJSON(fc, { style: { stroke: false, fillColor: '#526277', fillOpacity: 0.32 }, interactive: false }).addTo(map);
  }
  function icon(kind, sel) {
    const ic = { LUNAS: 'check', SEBAGIAN: 'clock', BELUM_LUNAS: 'alert', TIDAK_TERSEDIA: 'help', CALON: 'plus', USULAN: 'pin', LAMA: 'x', ME: 'user' }[kind] || 'pin';
    return L.divIcon({ className: 'mk mk--' + kind.toLowerCase() + (sel ? ' is-sel' : ''), html: '<span>' + UI.icon(ic) + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  function pinIcon(tone, label) {
    const col = { teal: '#087F8C', red: '#C62828', grey: '#7A8797', amber: '#B77800' }[tone || 'teal'];
    return L.divIcon({ className: 'pinmk', html: '<span class="pinmk__b"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="' + col + '" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="3.2" fill="#fff"/></svg></span>' + (label ? '<span class="pinmk__l">' + UI.esc(label) + '</span>' : ''), iconSize: [30, 40], iconAnchor: [15, 38] });
  }
  function cluster() {
    return L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 52, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 18, chunkedLoading: true,
      iconCreateFunction: c => {
        const ms = c.getAllChildMarkers(); const n = ms.length; const cnt = { LUNAS: 0, BELUM_LUNAS: 0, SEBAGIAN: 0, TIDAK_TERSEDIA: 0 };
        ms.forEach(m => { if (m._st) cnt[m._st]++; });
        const tot = Math.max(1, n); const p1 = cnt.LUNAS / tot * 100, p2 = p1 + cnt.SEBAGIAN / tot * 100, p3 = p2 + cnt.BELUM_LUNAS / tot * 100;
        const sz = n < 20 ? 36 : n < 100 ? 44 : 52;
        return L.divIcon({ className: 'clu', html: '<div class="clu__ring" style="width:' + sz + 'px;height:' + sz + 'px;background:conic-gradient(#21883C 0 ' + p1 + '%,#B77800 0 ' + p2 + '%,#C62828 0 ' + p3 + '%,#9AA6B4 0 100%)"><span>' + n + '</span></div>', iconSize: [sz, sz] });
      }
    });
  }
  function mini(el, o) {
    o = o || {};
    const map = create(el, { fit: false, zoomPos: 'topright', base: o.base, mask: o.mask });
    if (o.desa) {
      const d = o.desa; const f = D.GEO.desa.features.find(x => x.properties.kec === d.kec && x.properties.kel === d.kel);
      if (f) { const lay = L.geoJSON(f, { style: { color: '#087F8C', weight: 2, fillColor: '#087F8C', fillOpacity: 0.06 }, interactive: false }).addTo(map); map.fitBounds(lay.getBounds(), { padding: [10, 10] }); }
    } else map.fitBounds(D.GEO.bounds);
    if (o.kecOutline !== false) kecLayer(map, { tooltip: false, hover: false, style: () => ({ weight: 1, opacity: 0.5 }) });
    return map;
  }
  function legendScale(scale) {
    const s = SC[scale];
    return '<div class="maplegend__title"><span>' + s.nama + '</span></div>' + s.stops.map((x, i) => '<div class="maplegend__row"><span class="chosw" style="background:' + x[1] + '"></span>' + (i < s.stops.length - 1 ? s.fmt(x[0]) + ' – ' + s.fmt(s.stops[i + 1][0]) : '≥ ' + s.fmt(x[0])) + '</div>').join('');
  }
  function desaStats(th) {
    const out = {};
    D.DESA.forEach(d => out[d.id] = { total: 0, mapped: 0, aktif: 0, lunas: 0, berTagihan: 0, temuan: 0 });
    D.OP.forEach(o => {
      const s = out[o.kec + '-' + o.kel]; if (!s) return;
      s.total++; if (D.mapped(o)) s.mapped++;
      if (o.aktif) { s.aktif++; const b = D.bayar(o, th); if (b.status !== 'TIDAK_TERSEDIA') { s.berTagihan++; if (b.status === 'LUNAS') s.lunas++; } }
    });
    D.state.candidates.forEach(c => { const s = out[c.kec + '-' + c.kel]; if (s && ['BARU', 'DALAM_VERIFIKASI', 'PERLU_KELENGKAPAN'].includes(c.status)) s.temuan++; });
    D.state.proposals.forEach(p => { const o = D.OP_BY[p.idop]; const s = out[o.kec + '-' + o.kel]; if (s && ['DIAJUKAN', 'DIKEMBALIKAN'].includes(p.status)) s.temuan++; });
    return out;
  }
  function scaleValue(scale, s, d) {
    if (scale === 'kelengkapan') return s.total ? s.mapped / s.total * 100 : 0;
    if (scale === 'kepadatan') return d.luas ? s.total / d.luas : 0;
    if (scale === 'lunas') return s.berTagihan ? s.lunas / s.berTagihan * 100 : 0;
    return s.temuan;
  }
  return { BASE, SC, create, setBase, kecLayer, desaLayer, kecLabels, scopeShade, icon, pinIcon, cluster, mini, colorFor, legendScale, desaStats, scaleValue };
})();
