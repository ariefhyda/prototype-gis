/* Peta Objek Pajak — Leaflet + batas BIG + cluster + radius + temuan */
(function () {
  const ui = UI;
  App.page('peta', {
    title: 'Peta Objek Pajak', crumb: 'Pemantauan', perm: 'map.view', full: true,
    render(el, r) {
      const st = D.state, th = st.tahun, u = D.me(), cfg = st.cfg; const kecs = D.userKecs();
      const F = { jenis: '', kec: r.q.kec || '', kel: '', bayar: { LUNAS: true, SEBAGIAN: true, BELUM_LUNAS: true, TIDAK_TERSEDIA: true }, mode: 'titik', scale: 'kelengkapan', lyKec: true, lyDesa: false, lyLabel: true, lyCalon: true, lyUsulan: D.can('verification.decide') || u.role === 'petugas', base: cfg.basemap, radius: cfg.radiusDefault };
      let center = null, centerAcc = null, pickMode = null, sel = null;

      el.innerHTML = '<div class="mapwrap"><aside class="mapside" id="mside"><div class="mapside__scroll">' +
        '<div><div class="mapside__ttl">Tampilan</div><div class="segment" id="mMode" style="width:100%"><button class="is-active" data-m="titik" style="flex:1">' + ui.icon('pin') + ' Titik objek</button><button data-m="tematik" style="flex:1">' + ui.icon('layers') + ' Tematik desa</button></div>' +
        '<div id="mScaleBox" hidden class="mt-s"><select class="select" id="mScale"><option value="kelengkapan">Kelengkapan koordinat (%)</option><option value="lunas">Kepatuhan bayar — lunas (%)</option><option value="kepadatan">Kepadatan objek (/km²)</option><option value="temuan">Temuan & usulan aktif</option></select></div></div>' +
        '<div><div class="mapside__ttl">Filter <button class="linkish t-xs" id="mReset">Reset</button></div><div class="stack" style="gap:10px">' +
        '<div class="field"><label class="field__label" for="mKec">Kecamatan</label><select class="select" id="mKec">' + ui.kecOptions(F.kec, kecs) + '</select></div>' +
        '<div class="field"><label class="field__label" for="mKel">Desa/kelurahan</label><select class="select" id="mKel">' + ui.desaOptions(F.kec) + '</select></div>' +
        '<div class="field"><label class="field__label" for="mJenis">Jenis pajak</label><select class="select" id="mJenis">' + ui.jenisOptions('') + '</select></div>' +
        (D.can('payment.view') ? '<div class="field"><span class="field__label">Status pembayaran · ' + th + '</span><div class="stack" style="gap:4px" id="mBayar">' + Object.keys(D.STATUS_BAYAR).map(k => '<label class="check"><input type="checkbox" data-b="' + k + '" checked><span class="row" style="gap:6px"><span class="lgsw" style="background:' + D.STATUS_BAYAR[k].color + '">' + ui.icon(D.STATUS_BAYAR[k].ikon) + '</span>' + D.STATUS_BAYAR[k].label + ' <span class="pill-n" data-bc="' + k + '">0</span></span></label>').join('') + '</div></div>' : '') +
        '</div></div>' +
        '<div><div class="mapside__ttl">Lapisan</div><div class="stack" style="gap:6px">' +
        sw('lyKec', 'Batas kecamatan (BIG)', F.lyKec) + sw('lyDesa', 'Batas desa/kelurahan (BIG)', F.lyDesa) + sw('lyLabel', 'Label kecamatan', F.lyLabel) + sw('lyCalon', 'Calon objek (temuan)', F.lyCalon) + sw('lyUsulan', 'Usulan koordinat menunggu', F.lyUsulan) +
        '</div><div class="field mt-s"><label class="field__label" for="mBase">Peta dasar</label><select class="select" id="mBase">' + Object.keys(M.BASE).map(k => '<option value="' + k + '"' + (k === F.base ? ' selected' : '') + '>' + M.BASE[k].nama + '</option>').join('') + '</select></div></div>' +
        '<div><div class="mapside__ttl">Ringkasan tampilan</div><div id="mSum" class="stack" style="gap:6px"></div></div>' +
        '</div></aside>' +
        '<div class="mapcanvas"><div id="lmap"></div>' +
        '<div class="mapfloat mapfloat--tl"><button class="mapchip mapsidetoggle" id="mSideT">' + ui.icon('filter') + 'Filter</button>' +
        '<div class="mapsearch2"><span class="input-wrap"><span class="icon--prefix">' + ui.icon('search') + '</span><input class="input" id="mQ" type="search" placeholder="Cari nama objek, No OP, alamat, nama WP…" autocomplete="off"></span><div class="searchres" id="mRes" hidden></div></div>' +
        '<button class="mapchip" id="mLoc">' + ui.icon('target') + 'Lokasi saya</button>' +
        '<select class="mapchip" id="mRad" aria-label="Radius">' + cfg.radiusList.map(x => '<option value="' + x + '"' + (x === F.radius ? ' selected' : '') + '>Radius ' + ui.dist(x) + '</option>').join('') + '</select>' +
        '<button class="mapchip" id="mPick">' + ui.icon('pin') + 'Pilih titik</button>' +
        (D.can('candidate.create') ? '<button class="mapchip mapchip--accent" id="mCalon">' + ui.icon('plus') + 'Catat calon objek</button>' : '') +
        '</div>' +
        '<div class="mapfloat mapfloat--bl"><div class="maplegend2" id="mLeg"></div></div>' +
        '<div class="mapfab">' + (D.can('candidate.create') ? '<button class="mapfab__b mapfab__b--accent" data-fab="mCalon" aria-label="Catat calon objek">' + ui.icon('plus') + '</button>' : '') + '<button class="mapfab__b" data-fab="mLoc" aria-label="Lokasi saya">' + ui.icon('target') + '</button></div>' +
        '<div class="mapmsg" id="mMsg" hidden></div>' +
        '<div class="mapdrawer2" id="mDr"></div></div></div>';

      const map = M.create(ui.qs('#lmap', el), { base: F.base, zoomPos: 'bottomright' });
      App.onLeave(() => map.remove());
      let kecLay = null, desaLay = null, labelLay = null, shade = null, them = null;
      const clu = M.cluster(); map.addLayer(clu);
      const calonLay = L.layerGroup().addTo(map), usulLay = L.layerGroup().addTo(map), meLay = L.layerGroup().addTo(map);
      const stats = M.desaStats(th);
      if (window.innerWidth < 768) ui.qs('#mLeg', el).classList.add('is-min');
      shade = M.scopeShade(map, kecs);
      if (kecs.length < D.KEC.length) map.fitBounds(L.geoJSON({ type: 'FeatureCollection', features: D.GEO.kecamatan.features.filter(f => kecs.includes(f.properties.kec)) }).getBounds(), { padding: [20, 20] });

      function sw(id, label, on) { return '<label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="switch__track"></span><span class="t-sm">' + label + '</span></label>'; }

      /* ---------- data terfilter ---------- */
      function filtered() {
        return D.scopedOps().filter(o => (!F.jenis || o.jenis === +F.jenis) && (!F.kec || o.kec === +F.kec) && (!F.kel || o.kel === +F.kel));
      }
      function drawBoundaries() {
        [kecLay, desaLay, labelLay, them].forEach(l => l && map.removeLayer(l)); kecLay = desaLay = labelLay = them = null;
        if (F.mode === 'tematik') {
          them = M.desaLayer(map, {
            filter: f => kecs.includes(f.properties.kec) && (!F.kec || f.properties.kec === +F.kec),
            style: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return { fillColor: M.colorFor(F.scale, M.scaleValue(F.scale, stats[d.id], d)), fillOpacity: 0.72, color: '#fff', weight: 0.9 }; },
            tooltip: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return '<b>' + d.tipe + ' ' + ui.esc(d.nama) + '</b><br>' + M.SC[F.scale].nama + ': <b>' + M.SC[F.scale].fmt(M.scaleValue(F.scale, stats[d.id], d)) + '</b>'; },
          });
        }
        if (F.lyDesa && F.mode !== 'tematik') desaLay = M.desaLayer(map, { interactive: false, filter: f => !F.kec || f.properties.kec === +F.kec });
        if (F.lyKec) kecLay = M.kecLayer(map, { interactive: false, style: f => ({ weight: F.kec && f.properties.kec === +F.kec ? 3 : 1.6, color: F.kec && f.properties.kec === +F.kec ? '#087F8C' : '#15324F' }) });
        if (F.lyLabel) labelLay = M.kecLabels(map, kecs);
        if (desaLay) desaLay.bringToBack();
      }
      function drawMarkers() {
        clu.clearLayers(); calonLay.clearLayers(); usulLay.clearLayers();
        const ops = filtered(); const cnt = { LUNAS: 0, SEBAGIAN: 0, BELUM_LUNAS: 0, TIDAK_TERSEDIA: 0 }; let unmapped = 0; const ms = [];
        ops.forEach(o => {
          const e = D.effLoc(o); if (e.lat == null) { unmapped++; return; }
          const b = o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA'; cnt[b]++;
          if (D.can('payment.view') && !F.bayar[b]) return;
          if (F.mode === 'tematik') return;
          const m = L.marker([e.lat, e.lng], { icon: M.icon(D.can('payment.view') ? b : 'TIDAK_TERSEDIA', sel === o.idop), title: o.nama, keyboard: false }); m._st = b; m._id = o.idop;
          m.on('click', () => { if (pickMode) return; openObj(o); }); ms.push(m);
        });
        clu.addLayers(ms);
        Object.keys(cnt).forEach(k => { const x = ui.qs('[data-bc="' + k + '"]', el); if (x) x.textContent = ui.num(cnt[k]); });
        if (F.lyCalon) D.state.candidates.filter(c => kecs.includes(c.kec) && (!F.kec || c.kec === +F.kec) && !['TIDAK_DILANJUTKAN', 'COCOK_OBJEK_LAMA'].includes(c.status)).forEach(c => {
          L.marker([c.lat, c.lng], { icon: M.icon('CALON'), title: c.nama }).on('click', () => openCalon(c)).bindTooltip(ui.esc(c.nama) + '<br><span class="t-xs">' + D.ST_CALON[c.status].label + '</span>', { className: 'maptip' }).addTo(calonLay);
        });
        if (F.lyUsulan) D.state.proposals.filter(p => p.status === 'DIAJUKAN' && (D.can('verification.decide') ? kecs.includes(D.OP_BY[p.idop].kec) : p.created_by === u.id)).forEach(p => {
          L.marker([p.lat, p.lng], { icon: M.icon('USULAN'), title: 'Usulan ' + p.id }).bindTooltip('Usulan ' + p.id + '<br>' + ui.esc(D.OP_BY[p.idop].nama), { className: 'maptip' }).on('click', () => location.hash = '#/usulan/' + p.id).addTo(usulLay);
        });
        const shown = ops.length - unmapped;
        ui.qs('#mSum', el).innerHTML = row('Objek sesuai filter', ui.num(ops.length)) + row('Tampil di peta', ui.num(shown)) +
          '<div class="row-between t-sm"><span>Tanpa koordinat valid</span><b>' + (D.can('coordinate.propose') ? '<a href="#/koordinat?kec=' + (F.kec || '') + '">' + ui.num(unmapped) + ' →</a>' : ui.num(unmapped)) + '</b></div>' +
          '<p class="t-xs">Objek tanpa koordinat valid <b>tidak ditempatkan</b> di peta, tetapi tetap dapat dicari.</p>';
        legend(cnt);
      }
      function row(a, b) { return '<div class="row-between t-sm"><span>' + a + '</span><b>' + b + '</b></div>'; }
      function legend(cnt) {
        const lg = ui.qs('#mLeg', el);
        if (F.mode === 'tematik') { lg.innerHTML = M.legendScale(F.scale) + '<div class="t-xs mt-s">Sumber batas: BIG 2022</div>'; return; }
        lg.innerHTML = '<div class="maplegend__title"><span>' + (D.can('payment.view') ? 'Status bayar · Tahun ' + th : 'Objek pajak') + '</span><button class="linkish t-xs" data-lgt>' + (lg.classList.contains('is-min') ? 'Tampilkan' : 'Sembunyikan') + '</button></div>' +
          (D.can('payment.view') ? Object.keys(D.STATUS_BAYAR).map(k => '<div class="maplegend__row"><span class="lgsw" style="background:' + D.STATUS_BAYAR[k].color + (k === 'TIDAK_TERSEDIA' ? ';background:repeating-linear-gradient(45deg,#7A8797 0 3px,#98A3B1 3px 6px)' : '') + '">' + ui.icon(D.STATUS_BAYAR[k].ikon) + '</span>' + D.STATUS_BAYAR[k].label + '<b style="margin-left:auto">' + ui.num(cnt[k]) + '</b></div>').join('') : '') +
          (F.lyCalon ? '<div class="maplegend__row"><span class="lgsw" style="background:#B77800;border-radius:3px">' + ui.icon('plus') + '</span>Calon objek (belum terdaftar)</div>' : '') +
          (F.lyUsulan ? '<div class="maplegend__row"><span class="lgsw" style="background:#087F8C">' + ui.icon('pin') + '</span>Usulan koordinat menunggu</div>' : '') +
          '<div class="maplegend__row t-xs" style="margin-top:4px">Lingkaran cluster = proporsi status</div>';
        ui.qs('[data-lgt]', lg).onclick = () => { lg.classList.toggle('is-min'); legend(cnt); };
      }
      function apply(fit) {
        drawBoundaries(); drawMarkers();
        if (fit && F.kec) {
          const g = F.kel ? D.GEO.desa.features.find(f => f.properties.kec === +F.kec && f.properties.kel === +F.kel) : D.GEO.kecamatan.features.find(f => f.properties.kec === +F.kec);
          if (g) map.fitBounds(L.geoJSON(g).getBounds(), { padding: [30, 30] });
        }
      }
      function syncKec() { ui.qs('#mKec', el).value = F.kec; ui.qs('#mKel', el).innerHTML = ui.desaOptions(F.kec); F.kel = ''; }

      /* ---------- Drawer ---------- */
      const dr = ui.qs('#mDr', el);
      function openDrawer(head, body, foot) {
        dr.innerHTML = '<div class="mapdrawer__head"><div style="min-width:0">' + head + '</div><button class="icon-btn" id="drX" aria-label="Tutup">' + ui.icon('x') + '</button></div><div class="mapdrawer__body">' + body + '</div>' + (foot ? '<div class="mapdrawer__foot">' + foot + '</div>' : '');
        dr.classList.add('is-open'); ui.qs('#drX', dr).onclick = closeDrawer;
      }
      function closeDrawer() { dr.classList.remove('is-open'); if (sel) { sel = null; drawMarkers(); } }
      function openObj(o) {
        sel = o.idop; drawMarkers();
        const e = D.effLoc(o), b = o.aktif ? D.bayar(o, th) : { status: 'TIDAK_TERSEDIA', alasan: 'Objek tutup' }; const wp = D.WP_BY[o.idwp]; const ap = D.activeProposal(o.idop);
        const detail = D.can('object.detail');
        const dist = center ? D.haversine(center, [e.lat, e.lng]) : null;
        openDrawer('<div class="t-xs">' + D.JENIS_BY[o.jenis].nama + '</div><div class="t-h3" style="margin-top:2px">' + ui.esc(o.nama) + '</div><div class="row wrap mt-s">' + (D.can('payment.view') ? ui.bBayar(b.status) : '') + ui.bQ(e.q) + ui.bAktif(o) + '</div>',
          '<dl class="kv"><dt>No OP</dt><dd class="t-mono">' + o.noOp + '</dd><dt>Alamat</dt><dd>' + ui.esc(o.alamat) + ' RT ' + o.rt + '/RW ' + o.rw + '</dd><dt>Wilayah</dt><dd>' + ui.esc(D.desaName(o.kec, o.kel)) + ', Kec. ' + D.KEC_BY[o.kec].nama + '</dd>' +
          '<dt>Wajib pajak</dt><dd>' + (detail ? ui.esc(wp.nama) + '<div class="cell-sub t-mono">' + wp.npwpd + '</div>' : '<span class="masked">' + ui.esc(ui.maskNama(wp.nama)) + '</span><div class="cell-sub">Identitas disamarkan untuk role Anda</div>') + '</dd>' +
          (D.can('payment.view') ? '<dt>Pembayaran ' + th + '</dt><dd>' + (b.ketetapan ? ui.rp(b.bayar) + ' dari ' + ui.rp(b.ketetapan) : ui.esc(b.alasan || '—')) + '<div class="cell-sub">Sumber: ' + ui.esc(b.sumber || '—') + '</div></dd>' : '') +
          '<dt>Koordinat</dt><dd class="t-mono">' + ui.coord(e.lat) + ', ' + ui.coord(e.lng) + '<div class="cell-sub" style="font-family:var(--font-ui)">' + ui.esc(e.sumber) + (e.akurasi ? ' · ±' + e.akurasi + ' m' : '') + (e.at ? ' · ' + ui.date(e.at) : '') + '</div></dd>' +
          (dist != null ? '<dt>Jarak dari titik</dt><dd>' + ui.dist(dist) + '</dd>' : '') + '</dl>' +
          (ap ? '<div class="note">' + ui.icon('clock') + '<div>Ada usulan koordinat aktif <a href="#/usulan/' + ap.id + '">' + ap.id + '</a> (' + D.ST_USULAN[ap.status].label + ').</div></div>' : ''),
          (detail ? '<a class="btn btn--primary" href="#/objek/' + o.idop + '">' + ui.icon('eye') + 'Detail</a>' : '') +
          '<a class="btn btn--secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + e.lat + ',' + e.lng + '">' + ui.icon('route') + 'Rute</a>' +
          (D.can('coordinate.propose') && !ap ? '<a class="btn btn--secondary" href="#/usulan/baru/' + o.idop + '">' + ui.icon('edit') + 'Ajukan koreksi</a>' : '') +
          '<button class="btn btn--ghost" id="drNear">' + ui.icon('target') + 'Cari sekitar sini</button>');
        ui.qs('#drNear', dr).onclick = () => setCenter([e.lat, e.lng], null, 'Titik objek');
      }
      function openCalon(c) {
        openDrawer('<div class="t-xs">' + c.id + ' · ID sementara</div><div class="t-h3" style="margin-top:2px">' + ui.esc(c.nama) + '</div><div class="row wrap mt-s">' + ui.bCalon(c.status) + '</div>',
          '<div class="note note--warn">' + ui.icon('info') + '<div>Calon objek belum memiliki nomor resmi. Status terverifikasi bukan berarti sudah terdaftar di data induk.</div></div>' +
          '<dl class="kv"><dt>Dugaan jenis</dt><dd>' + D.JENIS_BY[c.dugaan].nama + '</dd><dt>Alamat</dt><dd>' + ui.esc(c.alamat) + '</dd><dt>Wilayah</dt><dd>' + ui.esc(D.desaName(c.kec, c.kel)) + ', Kec. ' + D.KEC_BY[c.kec].nama + '</dd><dt>Pencatat</dt><dd>' + ui.esc(D.user(c.created_by).nama) + '<div class="cell-sub">' + ui.dateTime(c.created_at) + '</div></dd></dl>',
          (D.can('candidate.create') || D.can('verification.decide') ? '<a class="btn btn--primary" href="#/calon/' + c.id + '">' + ui.icon('eye') + 'Buka temuan</a>' : ''));
      }
      function openDesa(d) {
        const s = stats[d.id]; const ops = D.OP.filter(o => o.kec === d.kec && o.kel === d.kel && D.inScope(o));
        openDrawer('<div class="t-xs">Kec. ' + ui.esc(d.kecNama) + ' · ' + d.kode + '</div><div class="t-h3" style="margin-top:2px">' + d.tipe + ' ' + ui.esc(d.nama) + '</div>',
          '<div class="grid2"><div class="cmp"><div class="cmp__l">Objek</div><div class="t-h3">' + s.total + '</div></div><div class="cmp"><div class="cmp__l">Terpetakan</div><div class="t-h3">' + ui.pct(s.mapped, s.total) + '%</div></div><div class="cmp"><div class="cmp__l">Luas wilayah</div><div class="t-h3">' + String(d.luas).replace('.', ',') + ' km²</div></div><div class="cmp"><div class="cmp__l">Lunas ' + th + '</div><div class="t-h3">' + (s.berTagihan ? ui.pct(s.lunas, s.berTagihan) + '%' : '—') + '</div></div></div>' +
          '<div><div class="mapside__ttl">Per jenis pajak</div>' + ui.bars(D.JENIS.map(j => ({ label: j.short, value: ops.filter(o => o.jenis === j.id).length, color: 'var(--navy-600)' })).filter(x => x.value)) + '</div>' +
          '<p class="t-xs">Batas wilayah: BIG (' + ui.esc(d.kode) + '). Kode desa ini dicocokkan ke kolom NO_KEC_OP/NO_KEL_OP pada BSG_OP.</p>',
          '<a class="btn btn--primary" href="#/wilayah/' + d.kec + '/' + d.kel + '">' + ui.icon('globe') + 'Profil desa</a>' + (D.can('coordinate.propose') ? '<a class="btn btn--secondary" href="#/koordinat?kec=' + d.kec + '&kel=' + d.kel + '">' + ui.icon('pin') + 'Belum terpetakan</a>' : '') +
          '<button class="btn btn--ghost" id="drFit">Perbesar</button>');
        ui.qs('#drFit', dr).onclick = () => { const f = D.GEO.desa.features.find(x => x.properties.kec === d.kec && x.properties.kel === d.kel); map.fitBounds(L.geoJSON(f).getBounds(), { padding: [30, 30] }); };
      }

      /* ---------- Lokasi & radius ---------- */
      function msg(html, btns) {
        const m = ui.qs('#mMsg', el); if (!html) { m.hidden = true; return; }
        m.innerHTML = html + (btns || ''); m.hidden = false;
      }
      function setCenter(pt, acc, label) {
        center = pt; centerAcc = acc; meLay.clearLayers();
        if (acc) L.circle(pt, { radius: acc, color: '#2B6CB0', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(meLay);
        L.circle(pt, { radius: F.radius, color: '#087F8C', weight: 2, dashArray: '6 6', fillOpacity: 0.04, interactive: false }).addTo(meLay);
        L.marker(pt, { icon: M.icon('ME'), zIndexOffset: 1000 }).bindTooltip(label || 'Titik pusat', { className: 'maptip' }).addTo(meLay);
        map.fitBounds(L.latLng(pt).toBounds(F.radius * 2.4), { animate: true });
        nearList(label);
      }
      function nearList(label) {
        const list = D.scopedOps().map(o => { const e = D.effLoc(o); return e.lat == null ? null : { o, e, d: D.haversine(center, [e.lat, e.lng]) }; }).filter(x => x && x.d <= F.radius && (!F.jenis || x.o.jenis === +F.jenis)).sort((a, b) => a.d - b.d);
        const cnt = { LUNAS: 0, SEBAGIAN: 0, BELUM_LUNAS: 0, TIDAK_TERSEDIA: 0 }; list.forEach(x => cnt[x.o.aktif ? D.bayar(x.o, th).status : 'TIDAK_TERSEDIA']++);
        openDrawer('<div class="t-xs">' + ui.esc(label || 'Titik pusat') + (centerAcc ? ' · akurasi ±' + Math.round(centerAcc) + ' m' : '') + '</div><div class="t-h3" style="margin-top:2px">' + list.length + ' objek dalam ' + ui.dist(F.radius) + '</div>' +
          (D.can('payment.view') ? '<div class="row wrap mt-s">' + Object.keys(cnt).filter(k => cnt[k]).map(k => ui.badge(D.STATUS_BAYAR[k], '(' + cnt[k] + ')')).join('') + '</div>' : ''),
          (centerAcc && centerAcc > cfg.akurasiMax ? '<div class="note note--warn">' + ui.icon('alert') + '<div>Akurasi ±' + Math.round(centerAcc) + ' m melebihi ambang ' + cfg.akurasiMax + ' m. Hasil pencarian tetap bisa dipakai; untuk usulan koordinat, geser pin secara manual.</div></div>' : '') +
          '<p class="t-xs">Hanya objek dalam cakupan wilayah Anda. Objek tanpa koordinat valid tidak ikut dihitung.</p>' +
          (list.length ? '<div class="nearlist">' + list.slice(0, 60).map(x => '<div class="nearit" data-id="' + x.o.idop + '"><span class="lgsw" style="background:' + (D.can('payment.view') ? D.STATUS_BAYAR[x.o.aktif ? D.bayar(x.o, th).status : 'TIDAK_TERSEDIA'].color : '#526277') + '">' + ui.icon('pin') + '</span><div style="min-width:0"><div class="t-sm" style="color:var(--text-primary);font-weight:600">' + ui.esc(x.o.nama) + '</div><div class="t-xs">' + D.JENIS_BY[x.o.jenis].short + ' · ' + ui.esc(x.o.alamat) + '</div></div><span class="nearit__d">' + ui.dist(x.d) + '</span></div>').join('') + '</div>' : ui.state({ icon: 'search', title: 'Tidak ada objek terpetakan', desc: 'Perbesar radius, atau periksa daftar objek tanpa koordinat di desa ini.' })),
          (D.can('candidate.create') ? '<button class="btn btn--secondary" id="drCalon">' + ui.icon('plus') + 'Catat calon objek di titik ini</button>' : '') + '<button class="btn btn--ghost" id="drClr">Hapus titik</button>');
        ui.qsa('.nearit', dr).forEach(n => n.onclick = () => { const o = D.OP_BY[n.dataset.id]; const e = D.effLoc(o); map.setView([e.lat, e.lng], 18); openObj(o); });
        const c = ui.qs('#drCalon', dr); if (c) c.onclick = () => calonFlow(center, centerAcc);
        ui.qs('#drClr', dr).onclick = () => { center = null; meLay.clearLayers(); closeDrawer(); };
      }
      function simulated() {
        const d = D.DESA.find(x => x.kec === kecs[0] && D.OP.some(o => o.kec === x.kec && o.kel === x.kel && D.mapped(o))) || D.DESA[0];
        const o = D.OP.find(x => x.kec === d.kec && x.kel === d.kel && D.mapped(x)); const e = o ? D.effLoc(o) : { lat: d.center[0], lng: d.center[1] };
        return [e.lat + 0.0007, e.lng - 0.0005];
      }
      function locate(then) {
        msg(ui.icon('target') + ' Meminta lokasi perangkat…');
        const fallback = (why) => {
          msg(ui.icon('alert') + ' ' + why, ' <button id="mSim">Gunakan lokasi simulasi</button> <button id="mMan">Pilih manual</button> <button id="mCl">×</button>');
          ui.qs('#mSim', el).onclick = () => { msg(null); setCenter(simulated(), 14, 'Lokasi simulasi petugas'); then && then(); };
          ui.qs('#mMan', el).onclick = () => { msg(null); startPick('center'); };
          ui.qs('#mCl', el).onclick = () => msg(null);
        };
        if (!navigator.geolocation || !window.isSecureContext && location.protocol !== 'file:') { fallback('Lokasi perangkat tidak tersedia di browser ini.'); return; }
        navigator.geolocation.getCurrentPosition(p => {
          const pt = [p.coords.latitude, p.coords.longitude];
          if (!D.inKab(pt[0], pt[1])) { fallback('Lokasi Anda (±' + Math.round(p.coords.accuracy) + ' m) di luar Kabupaten Tegal.'); return; }
          msg(null); setCenter(pt, p.coords.accuracy, 'Lokasi saya'); then && then();
        }, err => fallback(err.code === 1 ? 'Izin lokasi ditolak.' : 'Lokasi tidak dapat diambil (' + (err.code === 3 ? 'waktu habis' : 'tidak tersedia') + ').'), { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 });
      }
      function startPick(kind) {
        pickMode = kind; map.getContainer().style.cursor = 'crosshair';
        msg(ui.icon('pin') + (kind === 'calon' ? ' Ketuk lokasi calon objek di peta' : ' Ketuk titik pusat pencarian di peta'), ' <button id="mCl">Batal</button>');
        ui.qs('#mCl', el).onclick = stopPick;
      }
      function stopPick() { pickMode = null; map.getContainer().style.cursor = ''; msg(null); }
      map.on('click', e => {
        if (!pickMode) {
          /* klik area kosong: info desa/kelurahan (batas BIG) bila layer desa atau tematik aktif */
          if (F.lyDesa || F.mode === 'tematik') { const d = D.desaAt(e.latlng.lat, e.latlng.lng); if (d && kecs.includes(d.kec)) openDesa(d); }
          return;
        }
        const pt = [e.latlng.lat, e.latlng.lng]; const k = pickMode; stopPick();
        if (!D.inKab(pt[0], pt[1])) { ui.toast('Titik di luar batas Kabupaten Tegal.', 'error'); return; }
        if (k === 'calon') calonFlow(pt, null); else setCenter(pt, null, 'Titik pilihan manual');
      });

      /* ---------- Catat calon objek: cek dulu ---------- */
      function calonFlow(pt, acc) {
        if (!pt) { startPick('calon'); return; }
        const d = D.desaAt(pt[0], pt[1]);
        if (d && !kecs.includes(d.kec)) { ui.toast('Titik berada di Kec. ' + d.kecNama + ' — di luar wilayah tugas Anda.', 'error'); return; }
        const dup = D.duplicates(pt[0], pt[1], '', cfg.radiusDuplikat);
        const near = dup.filter(x => x.dist != null && x.dist <= cfg.radiusDuplikat);
        ui.modal({
          title: 'Langkah 1 — Cek objek terdaftar', wide: true,
          sub: 'Sebelum mencatat calon objek, pastikan usaha ini belum terdaftar. Objek terdaftar yang <b>belum berkoordinat</b> juga perlu dicari lewat nama/alamat.',
          body: '<div class="note mb">' + ui.icon('pin') + '<div>Titik: <span class="t-mono">' + pt[0].toFixed(6) + ', ' + pt[1].toFixed(6) + '</span>' + (d ? ' · ' + d.tipe + ' ' + ui.esc(d.nama) + ', Kec. ' + ui.esc(d.kecNama) : '') + (acc ? ' · ±' + Math.round(acc) + ' m' : '') + '</div></div>' +
            '<div class="mapside__ttl">Objek terdaftar dalam ' + cfg.radiusDuplikat + ' m (' + near.length + ')</div><div id="cfNear">' + candList(near) + '</div>' +
            '<div class="field mt"><label class="field__label" for="cfQ">Cari nama usaha / alamat (termasuk yang tanpa koordinat)</label><input class="input" id="cfQ" placeholder="mis. Sate, Warung Bu Siti, Jl. Pemuda"></div><div id="cfRes" class="mt-s"></div>',
          foot: '<button class="btn btn--secondary" data-close>Batal</button><button class="btn btn--primary" id="cfNone">' + ui.icon('check') + 'Tidak ada yang cocok — lanjut catat</button>',
          onOpen: m => {
            const q = ui.qs('#cfQ', m);
            q.oninput = () => { const v = q.value.trim().toLowerCase(); if (v.length < 3) { ui.qs('#cfRes', m).innerHTML = ''; return; } const hits = D.scopedOps().filter(o => o.kec === (d ? d.kec : o.kec) && (o.nama.toLowerCase().includes(v) || o.alamat.toLowerCase().includes(v))).slice(0, 8).map(o => { const e = D.effLoc(o); return { op: o, dist: e.lat != null ? D.haversine(pt, [e.lat, e.lng]) : null, tanpaKoordinat: e.lat == null }; }); ui.qs('#cfRes', m).innerHTML = candList(hits, true); wireMatch(m); };
            wireMatch(m);
            ui.qs('#cfNone', m).onclick = () => { ui.closeModal(); calonForm(pt, acc, d); };
          }
        });
        function wireMatch(m) { ui.qsa('[data-match]', m).forEach(b => b.onclick = () => { ui.closeModal(); const o = D.OP_BY[b.dataset.match]; if (D.activeProposal(o.idop)) { ui.toast('Objek ini sudah memiliki usulan aktif.', 'warning'); location.hash = '#/usulan/' + D.activeProposal(o.idop).id; return; } location.hash = '#/usulan/baru/' + o.idop + '?lat=' + pt[0] + '&lng=' + pt[1] + (acc ? '&acc=' + Math.round(acc) : ''); }); }
      }
      function candList(list, search) {
        if (!list.length) return '<p class="t-sm muted">' + (search ? 'Tidak ada hasil.' : 'Tidak ada objek terpetakan di sekitar titik ini.') + '</p>';
        return '<div class="nearlist">' + list.map(x => '<div class="nearit" style="cursor:default"><span class="stat__icon ' + (x.tanpaKoordinat ? 'stat__icon--amber' : 'stat__icon--teal') + '">' + ui.icon('building') + '</span><div style="min-width:0" class="grow"><div class="t-sm" style="color:var(--text-primary);font-weight:600">' + ui.esc(x.op.nama) + '</div><div class="t-xs">' + D.JENIS_BY[x.op.jenis].short + ' · ' + ui.esc(x.op.alamat) + ' · ' + (x.tanpaKoordinat ? '<b>tanpa koordinat</b>' : ui.dist(x.dist)) + '</div></div><button class="btn btn--sm btn--secondary" data-match="' + x.op.idop + '">Ini objeknya</button></div>').join('') + '</div>';
      }
      function calonForm(pt, acc, d) {
        const fotos = [];
        ui.modal({
          title: 'Langkah 2 — Catat calon objek', wide: true, sub: 'ID sementara diberikan otomatis (CO-2026-…). Tidak ada nomor resmi sampai melalui pendaftaran.',
          body: '<div class="grid2"><div class="field"><label class="field__label" for="cNm">Nama usaha / objek *</label><input class="input" id="cNm"></div><div class="field"><label class="field__label" for="cJ">Dugaan jenis pajak *</label><select class="select" id="cJ">' + D.JENIS.map(j => '<option value="' + j.id + '">' + j.nama + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="field__label" for="cAl">Alamat *</label><input class="input" id="cAl" placeholder="Jl. …"></div><div class="field"><label class="field__label">Wilayah (dari batas BIG)</label><input class="input" disabled value="' + (d ? ui.esc(d.tipe + ' ' + d.nama + ', Kec. ' + d.kecNama) : '-') + '"></div>' +
            '<div class="field"><label class="field__label" for="cPm">Nama pemilik/pengelola (opsional)</label><input class="input" id="cPm"></div><div class="field"><label class="field__label" for="cKt">Kontak (opsional)</label><input class="input" id="cKt" inputmode="tel"></div></div>' +
            '<div class="field mt"><label class="field__label" for="cDs">Deskripsi kegiatan & catatan lapangan</label><textarea class="textarea" id="cDs" rows="3"></textarea></div>' +
            '<div class="field mt"><span class="field__label">Foto (wajib min. ' + cfg.fotoMin + ')</span><div id="cFt"></div></div><div class="field__error" id="cErr" hidden></div>',
          foot: '<button class="btn btn--secondary" data-close>Batal</button><button class="btn btn--primary" id="cSave">' + ui.icon('send') + 'Kirim untuk verifikasi</button>',
          onOpen: m => {
            ui.fotoPicker(ui.qs('#cFt', m), fotos, { min: cfg.fotoMin, max: cfg.fotoMax });
            ui.qs('#cSave', m).onclick = () => {
              const nm = ui.qs('#cNm', m).value.trim(), al = ui.qs('#cAl', m).value.trim(); const err = ui.qs('#cErr', m);
              if (!nm || !al) { err.textContent = 'Nama usaha dan alamat wajib diisi.'; err.hidden = false; return; }
              if (fotos.length < cfg.fotoMin) { err.textContent = 'Lampirkan minimal ' + cfg.fotoMin + ' foto.'; err.hidden = false; return; }
              const c = D.newCandidate({ nama: nm, deskripsi: ui.qs('#cDs', m).value.trim(), dugaan: +ui.qs('#cJ', m).value, alamat: al, kec: d.kec, kel: d.kel, lat: pt[0], lng: pt[1], akurasi: acc ? Math.round(acc) : null, sumber: acc ? 'GPS' : 'MANUAL', pemilik: ui.qs('#cPm', m).value.trim(), kontak: ui.qs('#cKt', m).value.trim(), status: 'BARU', created_by: u.id, created_at: new Date().toISOString(), noMatchAt: new Date().toISOString(), fotos: fotos.slice() });
              const spv = D.state.users.find(x => x.role === 'supervisor' && x.kec !== 'all' && x.kec.includes(d.kec)); if (spv) D.notify(spv.id, 'Calon objek baru', c.nama + ' (' + c.id + ') menunggu verifikasi.', '#/calon/' + c.id);
              D.audit('calon.buat', 'Mencatat calon objek ' + c.id, c.id); D.save(); ui.closeModal(); drawMarkers();
              ui.toast('Calon objek <b>' + c.id + '</b> tercatat dan menunggu verifikasi supervisor.', 'success', 'Tersimpan');
            };
          }
        });
      }

      /* ---------- Pencarian ---------- */
      const qIn = ui.qs('#mQ', el), res = ui.qs('#mRes', el);
      qIn.oninput = () => {
        const v = qIn.value.trim().toLowerCase(); if (v.length < 2) { res.hidden = true; return; }
        const hits = D.scopedOps().filter(o => o.nama.toLowerCase().includes(v) || o.noOp.includes(v) || o.alamat.toLowerCase().includes(v) || (D.can('object.detail') && D.WP_BY[o.idwp].nama.toLowerCase().includes(v))).slice(0, 12);
        const desas = D.DESA.filter(d => kecs.includes(d.kec) && d.nama.toLowerCase().includes(v)).slice(0, 4);
        res.innerHTML = desas.map(d => '<div class="searchres__it" data-desa="' + d.id + '">' + ui.icon('globe') + '<div><div class="t-sm" style="font-weight:600">' + d.tipe + ' ' + ui.esc(d.nama) + '</div><div class="t-xs">Kec. ' + ui.esc(d.kecNama) + ' · batas wilayah</div></div></div>').join('') +
          hits.map(o => { const m = D.mapped(o); return '<div class="searchres__it" data-id="' + o.idop + '">' + ui.icon(m ? 'pin' : 'alert') + '<div style="min-width:0"><div class="t-sm" style="font-weight:600">' + ui.esc(o.nama) + '</div><div class="t-xs">' + o.noOp + ' · ' + ui.esc(D.desaName(o.kec, o.kel)) + '</div>' + (m ? '' : '<div class="mt-s">' + ui.bQ(o.q) + '</div>') + '</div></div>'; }).join('') || '<div class="searchres__it t-sm">Tidak ada hasil.</div>';
        res.hidden = false;
        ui.qsa('[data-id]', res).forEach(it => it.onclick = () => {
          res.hidden = true; const o = D.OP_BY[it.dataset.id];
          if (!D.mapped(o)) {
            ui.modal({ title: 'Objek belum terpetakan', sub: ui.esc(o.nama) + ' · ' + o.noOp, body: '<p class="t-sm">Objek ini terdaftar, tetapi koordinatnya <b>' + D.KUALITAS[o.q].label.toLowerCase() + '</b> sehingga tidak ditampilkan di peta (tidak ditempatkan sembarangan).</p><div class="cmpgrid mt"><div class="cmp"><div class="cmp__l">Lintang di master</div><div class="cmp__v">' + (ui.esc(o.latRaw) || '(kosong)') + '</div></div><div class="cmp"><div class="cmp__l">Bujur di master</div><div class="cmp__v">' + (ui.esc(o.lngRaw) || '(kosong)') + '</div></div></div>', foot: '<button class="btn btn--secondary" data-close>Tutup</button>' + (D.can('object.detail') ? '<a class="btn btn--secondary" href="#/objek/' + o.idop + '" data-close>Detail</a>' : '') + (D.can('coordinate.propose') ? '<a class="btn btn--primary" href="#/usulan/baru/' + o.idop + '" data-close>' + ui.icon('pin') + 'Data koordinat</a>' : '') });
            return;
          }
          const e = D.effLoc(o); map.setView([e.lat, e.lng], 18); openObj(o);
        });
        ui.qsa('[data-desa]', res).forEach(it => it.onclick = () => { res.hidden = true; const d = D.DESA_BY[it.dataset.desa]; F.kec = String(d.kec); syncKec(); F.kel = String(d.kel); ui.qs('#mKel', el).value = F.kel; apply(true); openDesa(d); });
      };
      document.addEventListener('click', hideRes); App.onLeave(() => document.removeEventListener('click', hideRes));
      function hideRes(e) { if (!e.target.closest('.mapsearch2')) res.hidden = true; }

      /* ---------- Kontrol ---------- */
      ui.qsa('#mMode button', el).forEach(b => b.onclick = () => { ui.qsa('#mMode button', el).forEach(x => x.classList.toggle('is-active', x === b)); F.mode = b.dataset.m; ui.qs('#mScaleBox', el).hidden = F.mode !== 'tematik'; apply(); });
      ui.qs('#mScale', el).onchange = (e) => { F.scale = e.target.value; apply(); };
      ui.qs('#mKec', el).onchange = (e) => { F.kec = e.target.value; ui.qs('#mKel', el).innerHTML = ui.desaOptions(F.kec); F.kel = ''; apply(true); if (!F.kec) map.fitBounds(D.GEO.bounds); };
      ui.qs('#mKel', el).onchange = (e) => { F.kel = e.target.value; apply(true); };
      ui.qs('#mJenis', el).onchange = (e) => { F.jenis = e.target.value; drawMarkers(); };
      ui.qsa('[data-b]', el).forEach(c => c.onchange = () => { F.bayar[c.dataset.b] = c.checked; drawMarkers(); });
      ['lyKec', 'lyDesa', 'lyLabel', 'lyCalon', 'lyUsulan'].forEach(id => ui.qs('#' + id, el).onchange = (e) => { F[id] = e.target.checked; apply(); });
      ui.qs('#mBase', el).onchange = (e) => M.setBase(map, e.target.value);
      ui.qs('#mReset', el).onclick = () => { F.kec = ''; F.kel = ''; F.jenis = ''; Object.keys(F.bayar).forEach(k => F.bayar[k] = true); ui.qsa('[data-b]', el).forEach(c => c.checked = true); ui.qs('#mJenis', el).value = ''; syncKec(); apply(); map.fitBounds(D.GEO.bounds); };
      ui.qs('#mLoc', el).onclick = () => locate();
      ui.qs('#mRad', el).onchange = (e) => { F.radius = +e.target.value; if (center) setCenter(center, centerAcc, 'Titik pusat'); };
      ui.qs('#mPick', el).onclick = () => startPick('center');
      const cb = ui.qs('#mCalon', el); if (cb) cb.onclick = () => { if (center) calonFlow(center, centerAcc); else { ui.modal({ title: 'Catat calon objek', sub: 'Tentukan lokasi calon objek terlebih dahulu.', body: '<div class="stack"><button class="btn btn--primary btn--block" id="ccGps">' + ui.icon('target') + 'Pakai lokasi perangkat (GPS)</button><button class="btn btn--secondary btn--block" id="ccMan">' + ui.icon('pin') + 'Ketuk lokasi di peta</button></div>', onOpen: m => { ui.qs('#ccGps', m).onclick = () => { ui.closeModal(); locate(() => calonFlow(center, centerAcc)); }; ui.qs('#ccMan', m).onclick = () => { ui.closeModal(); startPick('calon'); }; } }); } };
      ui.qsa('[data-fab]', el).forEach(b => b.onclick = () => { const t = ui.qs('#' + b.dataset.fab, el); if (t) t.click(); });
      ui.qs('#mSideT', el).onclick = () => ui.qs('#mside', el).classList.toggle('is-open');

      apply(!!F.kec);
      if (r.q.focus) { const o = D.OP_BY[r.q.focus]; if (o && D.mapped(o)) { const e = D.effLoc(o); map.setView([e.lat, e.lng], 18); openObj(o); } }
      if (r.q.desa) { const d = D.DESA_BY[r.q.desa]; if (d) { F.kec = String(d.kec); syncKec(); F.kel = String(d.kel); ui.qs('#mKel', el).value = F.kel; apply(true); openDesa(d); } }
      if (r.q.near) locate();
      if (r.q.calon) setTimeout(() => cb && cb.click(), 300);
    }
  });
})();
