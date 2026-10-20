/* Profil Wilayah — memanfaatkan batas administrasi BIG (kecamatan & desa) */
(function () {
  const ui = UI;
  App.page('wilayah', {
    title: (r) => r.params[1] ? 'Profil Desa/Kelurahan' : r.params[0] ? 'Profil Kecamatan' : 'Profil Wilayah', crumb: 'Pemantauan', perm: 'region.view',
    render(el, r) {
      const kecs = D.userKecs(); const th = D.state.tahun;
      const kec = r.params[0] ? +r.params[0] : null, kel = r.params[1] ? +r.params[1] : null;
      if ((kec && !D.KEC_BY[kec]) || (kel && !D.DESA_BY[kec + '-' + kel])) { el.innerHTML = ui.state({ icon: 'search', title: 'Wilayah tidak ditemukan', desc: 'Kode wilayah tidak ada di referensi BIG.', action: '<a class="btn btn--primary" style="margin-top:12px" href="#/wilayah">Profil wilayah</a>' }); return; }
      if (kec && !kecs.includes(kec)) { el.innerHTML = App.forbidden(); return; }
      const ops = D.scopedOps().filter(o => (!kec || o.kec === kec) && (!kel || o.kel === kel));
      const a = D.aggregate(ops, th); const stats = M.desaStats(th);
      const units = kel ? [] : kec ? D.DESA.filter(d => d.kec === kec) : D.KEC.filter(k => kecs.includes(k.kec));
      const luas = kel ? D.DESA_BY[kec + '-' + kel].luas : kec ? D.DESA.filter(d => d.kec === kec).reduce((s, d) => s + d.luas, 0) : D.DESA.filter(d => kecs.includes(d.kec)).reduce((s, d) => s + d.luas, 0);
      const nama = kel ? D.DESA_BY[kec + '-' + kel].tipe + ' ' + D.DESA_BY[kec + '-' + kel].nama : kec ? 'Kecamatan ' + D.KEC_BY[kec].nama : (kecs.length === D.KEC.length ? 'Kabupaten Tegal' : 'Wilayah kerja Anda');
      const kode = kel ? D.DESA_BY[kec + '-' + kel].kode : kec ? D.KEC_BY[kec].kode : '33.28';
      const crumbs = '<a href="#/wilayah" class="t-sm">Kab. Tegal</a>' + (kec ? ' <span class="t-xs">/</span> <a href="#/wilayah/' + kec + '" class="t-sm">' + D.KEC_BY[kec].nama + '</a>' : '') + (kel ? ' <span class="t-xs">/</span> <span class="t-sm">' + ui.esc(D.DESA_BY[kec + '-' + kel].nama) + '</span>' : '');
      const nDesa = kel ? 1 : kec ? units.length : D.DESA.filter(d => kecs.includes(d.kec)).length;
      const kel_ = D.DESA.filter(d => (kec ? d.kec === kec : kecs.includes(d.kec)) && d.tipe === 'Kelurahan').length;

      el.innerHTML = '<div class="pagehead"><div><div class="row wrap">' + crumbs + '</div><div class="pagehead__title" style="margin-top:6px">' + ui.esc(nama) + '</div><p class="pagehead__desc">Kode wilayah <span class="t-mono">' + kode + '</span> · luas ' + luas.toFixed(2).replace('.', ',') + ' km²' + (!kel ? ' · ' + nDesa + ' desa/kelurahan (' + kel_ + ' kelurahan)' : '') + '. Batas: BIG — Batas Desa/Kelurahan 2022. Kode Kemendagri dicocokkan ke <span class="t-mono">NO_KEC_OP / NO_KEL_OP</span>.</p></div><div class="pagehead__actions">' + (D.can('map.view') ? '<a class="btn btn--primary" href="#/peta?' + (kel ? 'desa=' + kec + '-' + kel : kec ? 'kec=' + kec : '') + '">' + ui.icon('map') + 'Buka di peta</a>' : '') + (kel && D.can('coordinate.propose') ? '<a class="btn btn--secondary" href="#/koordinat?kec=' + kec + '&kel=' + kel + '">' + ui.icon('pin') + 'Belum terpetakan</a>' : '') + '</div></div>' +
        '<div class="grid-stats">' + ui.stat({ label: 'Objek pajak', value: ui.num(a.total), icon: 'building', meta: (luas ? (a.total / luas).toFixed(1).replace('.', ',') + ' objek/km²' : '') }) +
        ui.stat({ label: 'Kelengkapan koordinat', value: ui.pct(a.mapped, a.total).toString().replace('.', ',') + '%', icon: 'pin', tone: 'teal', bar: ui.pct(a.mapped, a.total), meta: ui.num(a.mapped) + ' terpetakan · ' + ui.num(a.total - a.mapped) + ' belum' }) +
        (D.can('payment.view') ? ui.stat({ label: 'Lunas Tahun ' + th, value: ui.pct(a.bayar.LUNAS, a.aktif - a.bayar.TIDAK_TERSEDIA).toFixed(0) + '%', icon: 'check-circle', tone: 'green', meta: ui.num(a.bayar.BELUM_LUNAS) + ' belum lunas · ' + ui.num(a.bayar.TIDAK_TERSEDIA) + ' data belum tersedia' }) : '') +
        (D.can('payment.view') ? ui.stat({ label: 'Realisasi / ketetapan', value: ui.rpShort(a.realisasi), icon: 'chart', tone: 'grey', meta: 'dari ' + ui.rpShort(a.ketetapan) + ' (' + ui.pct(a.realisasi, a.ketetapan).toFixed(0) + '%)' }) : '') + '</div>' +
        '<div class="grid12"><div class="card c8x"><div class="card__head"><div><div class="card__title">' + (kel ? 'Batas desa & sebaran objek' : 'Peta tematik ' + (kec ? 'desa/kelurahan' : 'kecamatan')) + '</div><div class="card__sub">Klik wilayah untuk menelusuri</div></div>' + (kel ? '' : '<select class="select" id="wSc" style="width:auto"><option value="kelengkapan">Kelengkapan koordinat</option>' + (D.can('payment.view') ? '<option value="lunas">Kepatuhan bayar</option>' : '') + '<option value="kepadatan">Kepadatan objek</option><option value="temuan">Temuan & usulan aktif</option></select>') + '</div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="wMap"></div><div id="wLeg" class="row wrap mt-s t-xs"></div></div></div>' +
        '<div class="card c4x"><div class="card__head"><div class="card__title">Komposisi jenis pajak</div></div><div class="card__body">' + ui.bars(D.JENIS.map(j => ({ label: j.short, value: ops.filter(o => o.jenis === j.id).length, color: 'var(--navy-600)' }))) +
        '<div class="hr"></div><div class="mapside__ttl">Kualitas koordinat</div>' + ui.stack([{ label: 'GIS', value: a.gis, color: '#087F8C' }, { label: 'Valid master', value: a.valid, color: '#21883C' }, { label: 'Perlu cek', value: a.perluCek, color: '#B77800' }, { label: 'Invalid', value: a.invalid, color: '#C62828' }, { label: 'Kosong', value: a.kosong, color: '#9AA6B4' }]) +
        '<div class="legend mt-s">' + [['Terverifikasi GIS', a.gis, '#087F8C'], ['Valid (master)', a.valid, '#21883C'], ['Perlu cek', a.perluCek, '#B77800'], ['Invalid', a.invalid, '#C62828'], ['Kosong', a.kosong, '#9AA6B4']].map(x => '<div class="legend__item"><span class="legend__swatch" style="background:' + x[2] + '"></span>' + x[0] + '<span class="legend__val">' + ui.num(x[1]) + '</span></div>').join('') + '</div></div></div>' +
        (kel ? '<div class="c12" id="wOps"></div>' : '<div class="c12" id="wTbl"></div>') + '</div>';

      if (!kel) {
        const rows = units.map(x => {
          const ds = kec ? [x] : D.DESA.filter(d => d.kec === x.kec);
          const s = ds.reduce((acc, d) => { const q = stats[d.id]; acc.total += q.total; acc.mapped += q.mapped; acc.lunas += q.lunas; acc.berTagihan += q.berTagihan; acc.temuan += q.temuan; acc.luas += d.luas; return acc; }, { total: 0, mapped: 0, lunas: 0, berTagihan: 0, temuan: 0, luas: 0 });
          return { x, s, nDesa: ds.length };
        });
        ui.table(ui.qs('#wTbl', el), {
          rows, pageSize: 30, sortKey: 0, onRow: row => location.hash = kec ? '#/wilayah/' + kec + '/' + row.x.kel : '#/wilayah/' + row.x.kec,
          cols: [
            { label: kec ? 'Desa/kelurahan' : 'Kecamatan', cell: w => '<div class="cell-title">' + ui.esc((kec ? w.x.tipe + ' ' : '') + w.x.nama) + '</div><div class="cell-sub t-mono">' + w.x.kode + '</div>', sort: w => w.x.nama },
            ...(kec ? [] : [{ label: 'Desa', cls: 'num', cell: w => w.nDesa, sort: w => w.nDesa }]),
            { label: 'Luas', cls: 'num', cell: w => w.s.luas.toFixed(2).replace('.', ',') + ' km²', sort: w => w.s.luas },
            { label: 'Objek', cls: 'num', cell: w => ui.num(w.s.total), sort: w => w.s.total },
            { label: 'Kepadatan', cls: 'num', cell: w => (w.s.total / (w.s.luas || 1)).toFixed(1).replace('.', ','), sort: w => w.s.total / (w.s.luas || 1) },
            { label: 'Koordinat', cell: w => { const p = w.s.total ? Math.round(w.s.mapped / w.s.total * 100) : 0; return '<div class="row" style="gap:8px"><div class="miniring" style="--p:' + p + '"><span>' + p + '%</span></div><span class="t-xs">' + w.s.mapped + '/' + w.s.total + '</span></div>'; }, sort: w => w.s.total ? w.s.mapped / w.s.total : 0 },
            ...(D.can('payment.view') ? [{ label: 'Lunas ' + th, cls: 'num', cell: w => w.s.berTagihan ? Math.round(w.s.lunas / w.s.berTagihan * 100) + '%' : '—', sort: w => w.s.berTagihan ? w.s.lunas / w.s.berTagihan : 0 }] : []),
            { label: 'Temuan aktif', cls: 'num', cell: w => w.s.temuan || '—', sort: w => w.s.temuan }
          ]
        });
      } else {
        ui.table(ui.qs('#wOps', el), {
          rows: ops, pageSize: 15, onRow: o => { if (D.can('object.detail')) location.hash = '#/objek/' + o.idop; },
          cols: [{ label: 'Objek', cell: o => '<div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub">' + ui.esc(o.alamat) + '</div>', sort: o => o.nama }, { label: 'Jenis', cell: o => D.JENIS_BY[o.jenis].short, sort: o => o.jenis }, { label: 'Koordinat', cell: o => ui.bQ(D.effLoc(o).q), sort: o => D.effLoc(o).q }].concat(D.can('payment.view') ? [{ label: 'Bayar ' + th, cell: o => ui.bBayar(o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') }] : []).concat([{ label: 'Status', cell: o => ui.bAktif(o) }])
        });
      }

      setTimeout(() => {
        const map = M.create(ui.qs('#wMap', el), { base: kel ? 'osm' : 'light' }); App.onLeave(() => map.remove());
        let lay; let scale = 'kelengkapan'; let once = false;
        const legend = () => { ui.qs('#wLeg', el).innerHTML = kel ? '' : '<b>' + M.SC[scale].nama + ':</b> ' + M.SC[scale].stops.map((x, i) => '<span class="row" style="gap:4px"><span class="chosw" style="background:' + x[1] + '"></span>' + (i < M.SC[scale].stops.length - 1 ? M.SC[scale].fmt(x[0]) + '–' + M.SC[scale].fmt(M.SC[scale].stops[i + 1][0]) : '≥' + M.SC[scale].fmt(x[0])) + '</span>').join(''); };
        const kecVal = (k) => { const ds = D.DESA.filter(d => d.kec === k); const s = ds.reduce((acc, d) => { const q = stats[d.id]; Object.keys(q).forEach(z => acc[z] = (acc[z] || 0) + q[z]); return acc; }, {}); return M.scaleValue(scale, s, { luas: ds.reduce((a, d) => a + d.luas, 0) }); };
        function draw() {
          if (lay) map.removeLayer(lay);
          if (kel) {
            const f = D.GEO.desa.features.find(x => x.properties.kec === kec && x.properties.kel === kel);
            M.desaLayer(map, { filter: x => x.properties.kec === kec, onClick: x => location.hash = '#/wilayah/' + kec + '/' + x.properties.kel, style: x => x.properties.kel === kel ? { color: '#087F8C', weight: 3, fillColor: '#087F8C', fillOpacity: 0.08 } : { color: '#526277', weight: 1, fillOpacity: 0.02 } });
            lay = L.geoJSON(f, { interactive: false, style: { fill: false, color: '#087F8C', weight: 3 } }).addTo(map); map.fitBounds(lay.getBounds(), { padding: [20, 20] });
            const cl = M.cluster(); ops.forEach(o => { const e = D.effLoc(o); if (e.lat == null) return; const m = L.marker([e.lat, e.lng], { icon: M.icon(D.can('payment.view') ? (o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') : 'TIDAK_TERSEDIA') }).bindTooltip(ui.esc(o.nama), { className: 'maptip' }); m._st = o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA'; cl.addLayer(m); }); map.addLayer(cl);
            D.state.candidates.filter(c => c.kec === kec && c.kel === kel).forEach(c => L.marker([c.lat, c.lng], { icon: M.icon('CALON') }).bindTooltip(ui.esc(c.nama) + ' (calon)', { className: 'maptip' }).addTo(map));
            return;
          }
          if (kec) {
            lay = M.desaLayer(map, { filter: f => f.properties.kec === kec, style: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return { fillColor: M.colorFor(scale, M.scaleValue(scale, stats[d.id], d)), fillOpacity: 0.78, color: '#fff', weight: 1 }; }, tooltip: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return '<b>' + d.tipe + ' ' + ui.esc(d.nama) + '</b><br>' + M.SC[scale].nama + ': <b>' + M.SC[scale].fmt(M.scaleValue(scale, stats[d.id], d)) + '</b>'; }, onClick: f => location.hash = '#/wilayah/' + kec + '/' + f.properties.kel });
            map.fitBounds(lay.getBounds(), { padding: [10, 10] });
            if (!once) D.DESA.filter(d => d.kec === kec).forEach(d => L.marker(d.center, { interactive: false, icon: L.divIcon({ className: 'kecLabel', html: '<span style="font-size:9px;text-transform:none">' + ui.esc(d.nama) + '</span>', iconSize: [0, 0] }) }).addTo(map));
          } else {
            lay = M.kecLayer(map, { style: f => ({ fillColor: kecs.includes(f.properties.kec) ? M.colorFor(scale, kecVal(f.properties.kec)) : '#ddd', fillOpacity: 0.82, color: '#fff', weight: 1.5 }), tooltip: f => '<b>Kec. ' + ui.esc(f.properties.nama) + '</b><br>' + M.SC[scale].nama + ': <b>' + M.SC[scale].fmt(kecVal(f.properties.kec)) + '</b><br><span class="t-xs">' + f.properties.jmlDesa + ' desa/kelurahan</span>', onClick: f => { if (kecs.includes(f.properties.kec)) location.hash = '#/wilayah/' + f.properties.kec; } });
            if (!once) { M.kecLabels(map, kecs); M.desaLayer(map, { tooltip: false, hover: false, style: () => ({ color: '#fff', weight: 0.4, opacity: 0.6 }) }).bringToBack(); }
          }
          legend(); once = true;
        }
        draw();
        const sc = ui.qs('#wSc', el); if (sc) sc.onchange = () => { scale = sc.value; draw(); };
      }, 20);
    }
  });
})();
