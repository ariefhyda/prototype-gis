/* Pendataan Koordinat (A6), Usulan & Verifikasi, Calon Objek (A7) */
(function () {
  const ui = UI;
  const nowISO = () => new Date().toISOString();

  /* ================= Pendataan Koordinat ================= */
  App.page('koordinat', {
    title: 'Pendataan Koordinat', crumb: 'Pendataan Lapangan', perm: ['coordinate.propose', 'verification.decide'],
    render(el, r) {
      const u = D.me(), st = D.state, kecs = D.userKecs(); const isSpv = D.can('verification.decide');
      const tab = r.q.tab || (isSpv ? 'verif' : 'antrean');
      const antrean = D.scopedOps().filter(o => o.aktif && !D.mapped(o) && !D.activeProposal(o.idop));
      const saya = st.proposals.filter(p => p.created_by === u.id);
      const verif = st.proposals.filter(p => p.status === 'DIAJUKAN' && kecs.includes(D.OP_BY[p.idop].kec));
      const semua = st.proposals.filter(p => kecs.includes(D.OP_BY[p.idop].kec));
      const tabs = [{ key: 'antrean', label: 'Belum terpetakan', count: antrean.length }].concat(D.can('coordinate.propose') && u.role === 'petugas' ? [{ key: 'saya', label: 'Usulan saya', count: saya.filter(p => p.status === 'DIKEMBALIKAN').length || null }] : []).concat(isSpv ? [{ key: 'verif', label: 'Perlu verifikasi', count: verif.length }, { key: 'semua', label: 'Semua usulan' }] : []);
      el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">Pendataan koordinat</div><p class="pagehead__desc">Usulan koordinat disimpan di tabel operasional GIS dan <b>tidak mengubah</b> <span class="t-mono">BSG_OP</span>. Koordinat yang disetujui dipakai di peta lalu diteruskan ke pengelola sistem utama.</p></div><div class="pagehead__actions"><a class="btn btn--secondary" href="#/peta?near=1">' + ui.icon('target') + 'Cari objek sekitar</a></div></div>' +
        ui.tabs(tabs, tab, 'id="kTabs"') + '<div id="kBody" style="margin-top:16px"></div>';
      ui.qsa('#kTabs button', el).forEach(b => b.onclick = () => location.hash = '#/koordinat?tab=' + b.dataset.tab);
      const body = ui.qs('#kBody', el);
      if (tab === 'antrean') antreanTab(body, antrean, r);
      else if (tab === 'saya') propTable(body, saya, { own: true });
      else if (tab === 'verif' && isSpv) propTable(body, verif.sort((a, b) => a.submitted_at < b.submitted_at ? -1 : 1), { verif: true });
      else if (tab === 'semua' && isSpv) propTable(body, semua.slice().reverse(), { filterStatus: true });
      else body.innerHTML = App.forbidden();
    }
  });
  function antreanTab(body, rows, r) {
    const kecs = D.userKecs(); const F = { kec: r.q.kec || '', kel: r.q.kel || '', jenis: '', q: '' };
    const qcount = { KOSONG: 0, INVALID: 0, PERLU_CEK: 0 }; rows.forEach(o => qcount[o.q] = (qcount[o.q] || 0) + 1);
    body.innerHTML = '<div class="grid-stats">' + ui.stat({ label: 'Tanpa koordinat', value: ui.num(qcount.KOSONG), icon: 'pin', tone: 'grey', meta: 'Kolom kosong atau 0' }) + ui.stat({ label: 'Koordinat tidak valid', value: ui.num(qcount.INVALID), icon: 'x', tone: 'red', meta: 'Format salah, tertukar, di luar kabupaten' }) + ui.stat({ label: 'Perlu dicek', value: ui.num(qcount.PERLU_CEK), icon: 'alert', tone: 'amber', meta: 'Di luar kecamatan objek / titik duplikat' }) + '</div>' +
      '<div class="filterbar mb"><div class="field" style="flex:2 1 220px"><label class="field__label" for="aQ">Cari</label><input class="input" id="aQ" type="search" placeholder="Nama objek, No OP, alamat"></div><div class="field"><label class="field__label" for="aK">Kecamatan</label><select class="select" id="aK">' + ui.kecOptions(F.kec, kecs) + '</select></div><div class="field"><label class="field__label" for="aD">Desa</label><select class="select" id="aD">' + ui.desaOptions(F.kec, F.kel) + '</select></div><div class="field"><label class="field__label" for="aJ">Jenis</label><select class="select" id="aJ">' + ui.jenisOptions('') + '</select></div></div><div id="aT"></div>';
    const tbl = ui.table(ui.qs('#aT', body), {
      rows: [], cols: [
        { label: 'Objek', cell: o => '<div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub t-mono">' + o.noOp + '</div>', sort: o => o.nama },
        { label: 'Jenis', cell: o => D.JENIS_BY[o.jenis].short, sort: o => o.jenis },
        { label: 'Alamat & wilayah', cell: o => ui.esc(o.alamat) + '<div class="cell-sub">' + ui.esc(D.desaName(o.kec, o.kel)) + ', ' + D.KEC_BY[o.kec].nama + '</div>', sort: o => D.KEC_BY[o.kec].nama + D.desaName(o.kec, o.kel) },
        { label: 'Kondisi master', cell: o => ui.bQ(o.q) + '<div class="cell-sub t-mono">' + (ui.esc(o.latRaw) || '∅') + ' / ' + (ui.esc(o.lngRaw) || '∅') + '</div>', sort: o => o.q },
        { label: 'Penugasan', cell: o => { const t = D.state.assignments.find(t => ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status) && t.targets.some(x => x.idop === o.idop)); return t ? '<a href="#/tugas/' + t.id + '">' + t.id + '</a>' : '<span class="t-xs">—</span>'; } },
        { label: '', cls: 'right', cell: o => D.can('coordinate.propose') ? '<a class="btn btn--sm btn--primary" href="#/usulan/baru/' + o.idop + '">' + ui.icon('pin') + 'Ajukan</a>' : '' }
      ]
    });
    function apply() { const q = F.q.toLowerCase(); tbl.rows = rows.filter(o => (!F.kec || o.kec === +F.kec) && (!F.kel || o.kel === +F.kel) && (!F.jenis || o.jenis === +F.jenis) && (!q || o.nama.toLowerCase().includes(q) || o.noOp.includes(q) || o.alamat.toLowerCase().includes(q))); }
    ui.qs('#aQ', body).oninput = e => { F.q = e.target.value; apply(); };
    ui.qs('#aK', body).onchange = e => { F.kec = e.target.value; F.kel = ''; ui.qs('#aD', body).innerHTML = ui.desaOptions(F.kec); apply(); };
    ui.qs('#aD', body).onchange = e => { F.kel = e.target.value; apply(); };
    ui.qs('#aJ', body).onchange = e => { F.jenis = e.target.value; apply(); };
    apply();
  }
  function propTable(body, rows, o) {
    let fs = '';
    body.innerHTML = (o.verif ? '<div class="note mb">' + ui.icon('shield') + '<div>Anda tidak dapat memutuskan usulan yang Anda buat sendiri (pemisahan tugas). Antrean diurutkan dari pengajuan terlama.</div></div>' : '') +
      (o.filterStatus ? '<div class="row wrap mb" id="pFs"><button class="chip is-active" data-s="">Semua</button>' + Object.keys(D.ST_USULAN).map(k => '<button class="chip" data-s="' + k + '">' + D.ST_USULAN[k].label + '</button>').join('') + '</div>' : '') + '<div id="pT"></div>';
    const tbl = ui.table(ui.qs('#pT', body), {
      rows: rows, onRow: p => location.hash = '#/usulan/' + p.id,
      empty: ui.state({ icon: 'check-circle', title: o.verif ? 'Antrean verifikasi kosong' : 'Belum ada usulan', desc: o.own ? 'Ajukan koordinat dari tab “Belum terpetakan” atau dari peta.' : '' }),
      cols: [
        { label: 'ID', cell: p => '<span class="t-mono">' + p.id + '</span>', sort: p => p.id },
        { label: 'Objek', cell: p => { const op = D.OP_BY[p.idop]; return '<div class="cell-title">' + ui.esc(op.nama) + '</div><div class="cell-sub">' + ui.esc(D.desaName(op.kec, op.kel)) + ', ' + D.KEC_BY[op.kec].nama + '</div>'; } },
        { label: 'Jenis usulan', cell: p => p.jenis === 'BARU' ? 'Koordinat baru' : 'Koreksi' },
        { label: 'Sumber & akurasi', cell: p => p.sumber.replace('_', ' ') + '<div class="cell-sub ' + (p.akurasi > D.state.cfg.akurasiMax ? 'acc-bad' : '') + '">±' + p.akurasi + ' m</div>', sort: p => p.akurasi },
        { label: 'Petugas', cell: p => ui.esc(D.user(p.created_by).nama) },
        { label: 'Diajukan', cell: p => ui.dateTime(p.submitted_at), sort: p => p.submitted_at },
        { label: 'Status', cell: p => ui.bUsulan(p.status), sort: p => p.status },
        { label: '', cls: 'right', cell: p => '<a class="btn btn--sm ' + (o.verif || p.status === 'DIKEMBALIKAN' ? 'btn--primary' : 'btn--secondary') + '" href="#/usulan/' + p.id + '">' + (o.verif ? 'Periksa' : p.status === 'DIKEMBALIKAN' && o.own ? 'Perbaiki' : 'Buka') + '</a>' }
      ]
    });
    ui.qsa('#pFs .chip', body).forEach(c => c.onclick = () => { ui.qsa('#pFs .chip', body).forEach(x => x.classList.toggle('is-active', x === c)); fs = c.dataset.s; tbl.rows = rows.filter(p => !fs || p.status === fs); });
  }

  /* ================= Usulan: form & verifikasi ================= */
  App.page('usulan', {
    title: (r) => r.params[0] === 'baru' ? 'Ajukan Koordinat' : 'Usulan ' + r.params[0], crumb: 'Pendataan Koordinat', nav: 'koordinat', perm: ['coordinate.propose', 'verification.decide'],
    render(el, r) {
      if (r.params[0] === 'baru') { const op = D.OP_BY[r.params[1]]; if (!op || !D.inScope(op)) { el.innerHTML = App.forbidden(); return; } if (!D.can('coordinate.propose')) { el.innerHTML = App.forbidden(); return; } const ap = D.activeProposal(op.idop); if (ap) { el.innerHTML = '<div style="max-width:560px;margin:48px auto">' + ui.state({ tone: 'warning', icon: 'clock', title: 'Objek sudah memiliki usulan aktif', desc: 'Satu objek hanya boleh memiliki satu usulan aktif. Buka ' + ap.id + ' untuk melihat statusnya.', action: '<a class="btn btn--primary" style="margin-top:12px" href="#/usulan/' + ap.id + '">Buka ' + ap.id + '</a>' }) + '</div>'; return; } return form(el, op, null, r.q); }
      const p = D.state.proposals.find(x => x.id === r.params[0]); if (!p) { el.innerHTML = ui.state({ icon: 'search', title: 'Usulan tidak ditemukan' }); return; }
      const op = D.OP_BY[p.idop]; if (!D.inScope(op) && p.created_by !== D.me().id) { el.innerHTML = App.forbidden(); return; }
      if ((p.status === 'DIKEMBALIKAN' || p.status === 'DRAF') && p.created_by === D.me().id && r.q.edit) return form(el, op, p, r.q);
      view(el, p, op);
    }
  });

  function form(el, op, p, q) {
    const cfg = D.state.cfg, u = D.me(); const e = D.effLoc(op); const old = e.lat != null ? [e.lat, e.lng] : (op.q === 'PERLU_CEK' && op.mLat ? [op.mLat, op.mLng] : null);
    const S = { lat: p ? p.lat : (q.lat ? +q.lat : null), lng: p ? p.lng : (q.lng ? +q.lng : null), acc: p ? p.akurasi : (q.acc ? +q.acc : null), sumber: p ? p.sumber : (q.lat ? (q.acc ? 'GPS' : 'MANUAL') : null), gpsRaw: null, adjusted: false, fotos: p ? p.fotos.slice() : [] };
    const myTugas = D.state.assignments.filter(t => t.petugas.includes(u.id) && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status) && t.targets.some(x => x.idop === op.idop));
    const lastV = p ? D.state.verifications.filter(v => v.target === 'proposal' && v.tid === p.id).pop() : null;
    el.innerHTML = '<div class="pagehead"><div><a href="' + (p ? '#/usulan/' + p.id : '#/koordinat') + '" class="t-sm">' + ui.icon('chevron-left') + ' Kembali</a><div class="pagehead__title" style="margin-top:6px">' + (p ? 'Perbaiki usulan ' + p.id : (old ? 'Ajukan koreksi koordinat' : 'Ajukan koordinat baru')) + '</div><p class="pagehead__desc">' + ui.esc(op.nama) + ' · <span class="t-mono">' + op.noOp + '</span> · ' + ui.esc(D.desaName(op.kec, op.kel)) + ', Kec. ' + D.KEC_BY[op.kec].nama + '</p></div></div>' +
      (lastV && p.status === 'DIKEMBALIKAN' ? '<div class="note note--warn mb">' + ui.icon('refresh') + '<div><b>Catatan supervisor (' + ui.esc(D.user(lastV.by).nama) + '):</b> ' + ui.esc(lastV.catatan) + '</div></div>' : '') +
      '<div class="steps"><span id="s1">1 · Titik lokasi</span><span id="s2">2 · Foto & keterangan</span><span id="s3">3 · Kirim</span></div>' +
      '<div class="grid12"><div class="c8x stack"><div class="card"><div class="card__head"><div><div class="card__title">Titik lokasi</div><div class="card__sub">Garis teal = batas ' + ui.esc(D.desaName(op.kec, op.kel)) + ' (BIG). Geser pin untuk menyesuaikan.</div></div></div><div class="card__body card__body--tight stack">' +
      '<div class="row wrap"><button class="btn btn--primary" id="fGps">' + ui.icon('target') + 'Ambil dari GPS</button><button class="btn btn--secondary" id="fMan">' + ui.icon('pin') + 'Pilih di peta</button><select class="select" id="fBase" style="width:auto">' + Object.keys(M.BASE).map(k => '<option value="' + k + '"' + (k === 'sat' ? ' selected' : '') + '>' + M.BASE[k].nama + '</option>').join('') + '</select></div>' +
      '<div class="minimap minimap--tall" id="fMap"></div><div id="fGpsBox"></div>' +
      '<div class="grid2"><div class="field"><label class="field__label" for="fLat">Lintang (lat)</label><input class="input t-mono" id="fLat" inputmode="decimal" placeholder="-6.98xxxx"></div><div class="field"><label class="field__label" for="fLng">Bujur (lng)</label><input class="input t-mono" id="fLng" inputmode="decimal" placeholder="109.1xxxxx"></div></div>' +
      '<div id="fVal"></div></div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Foto & keterangan</div></div><div class="card__body stack">' +
      '<div class="field"><span class="field__label">Foto lapangan (min. ' + cfg.fotoMin + ', maks. ' + cfg.fotoMax + ')</span><div id="fFoto"></div></div>' +
      '<div class="field"><label class="field__label" for="fAl">Alasan ' + (old ? '(wajib untuk koreksi)' : '') + '</label><input class="input" id="fAl" value="' + ui.esc(p ? p.alasan : (old ? '' : 'Koordinat belum ada di master')) + '"></div>' +
      '<div class="field"><label class="field__label" for="fCt">Catatan kondisi lapangan</label><textarea class="textarea" id="fCt" rows="3" placeholder="mis. usaha buka, papan nama terlihat, masuk gang 30 m">' + ui.esc(p ? p.catatan : '') + '</textarea></div>' +
      (myTugas.length ? '<div class="field"><label class="field__label" for="fTg">Kaitkan dengan penugasan</label><select class="select" id="fTg"><option value="">—</option>' + myTugas.map(t => '<option value="' + t.id + '"' + ((p && p.tugas === t.id) || (!p && myTugas.length === 1) ? ' selected' : '') + '>' + t.id + ' — ' + ui.esc(t.judul) + '</option>').join('') + '</select></div>' : '') +
      '</div></div></div>' +
      '<div class="c4x stack"><div class="card"><div class="card__head"><div class="card__title">Ringkasan objek</div></div><div class="card__body"><dl class="kv"><dt>Jenis pajak</dt><dd>' + D.JENIS_BY[op.jenis].short + '</dd><dt>Alamat</dt><dd>' + ui.esc(op.alamat) + '</dd><dt>Koordinat master</dt><dd class="t-mono">' + (ui.esc(op.latRaw) || '∅') + ' / ' + (ui.esc(op.lngRaw) || '∅') + '<div>' + ui.bQ(op.q) + '</div></dd><dt>Dipakai GIS saat ini</dt><dd>' + ui.esc(e.sumber) + '</dd></dl></div></div>' +
      '<div class="card"><div class="card__body stack"><div class="note">' + ui.icon('info') + '<div>Usulan ditinjau supervisor wilayah. Persetujuan <b>tidak otomatis</b> menimpa koordinat di master.</div></div><div class="field__error" id="fErr" hidden></div>' +
      '<button class="btn btn--primary btn--block btn--lg" id="fSend">' + ui.icon('send') + 'Kirim untuk verifikasi</button><button class="btn btn--secondary btn--block" id="fDraft">Simpan draf</button></div></div></div></div>';

    let map, pin, oldMk, picking = false;
    setTimeout(() => {
      const d = D.DESA_BY[op.kec + '-' + op.kel];
      map = M.mini(ui.qs('#fMap', el), { desa: d, base: 'sat' }); App.onLeave(() => map.remove());
      M.desaLayer(map, { filter: f => f.properties.kec === op.kec, tooltip: f => f.properties.nama, hover: false, style: () => ({ color: '#fff', weight: 0.8, opacity: 0.6 }) });
      if (old) { oldMk = L.marker(old, { icon: M.icon('LAMA') }).bindTooltip('Koordinat lama', { className: 'maptip', permanent: false }).addTo(map); }
      if (S.lat != null) placePin([S.lat, S.lng], false);
      map.on('click', ev => { if (!picking) return; picking = false; map.getContainer().style.cursor = ''; S.sumber = S.sumber === 'GPS' ? 'GPS_DISESUAIKAN' : 'MANUAL'; if (S.sumber === 'MANUAL') S.acc = null; placePin([ev.latlng.lat, ev.latlng.lng], true); });
    }, 20);
    function placePin(pt, user) {
      S.lat = +pt[0].toFixed(7); S.lng = +pt[1].toFixed(7);
      if (!pin) { pin = L.marker(pt, { icon: M.pinIcon('teal', 'Usulan'), draggable: true, zIndexOffset: 1000 }).addTo(map); pin.on('dragend', () => { const ll = pin.getLatLng(); if (S.sumber === 'GPS') { S.sumber = 'GPS_DISESUAIKAN'; S.adjusted = true; } else if (!S.sumber) S.sumber = 'MANUAL'; placePin([ll.lat, ll.lng], true); }); }
      else pin.setLatLng(pt);
      if (!user) map.setView(pt, 18);
      ui.qs('#fLat', el).value = S.lat; ui.qs('#fLng', el).value = S.lng; validate();
    }
    function validate() {
      const box = ui.qs('#fVal', el); if (S.lat == null) { box.innerHTML = ''; return null; }
      const v = D.validatePoint(S.lat, S.lng, op); let h = '';
      v.errors.forEach(x => h += '<div class="note note--danger">' + ui.icon('x') + '<div>' + ui.esc(x) + '</div></div>');
      v.warnings.forEach(x => h += '<div class="note note--warn">' + ui.icon('alert') + '<div>' + ui.esc(x) + ' Usulan tetap boleh dikirim — sertakan alasan.</div></div>');
      if (v.ok && !v.warnings.length) h += '<div class="note note--ok">' + ui.icon('check-circle') + '<div>Titik berada di dalam ' + ui.esc(v.desa ? v.desa.tipe + ' ' + v.desa.nama : 'wilayah objek') + ' sesuai data terdaftar.</div></div>';
      if (old) h += '<div class="t-sm">Jarak dari koordinat lama: <b>' + ui.dist(D.haversine(old, [S.lat, S.lng])) + '</b></div>';
      h += '<div class="t-xs">Sumber: <b>' + (S.sumber || '—').replace('_', ' ') + '</b>' + (S.acc ? ' · akurasi ±' + S.acc + ' m' : '') + '</div>';
      box.innerHTML = '<div class="stack" style="gap:8px">' + h + '</div>';
      ui.qs('#s1', el).className = v.ok ? 'is-done' : 'is-on'; ui.qs('#s2', el).className = S.fotos.length >= cfg.fotoMin ? 'is-done' : (v.ok ? 'is-on' : ''); return v;
    }
    function gpsBox() {
      const b = ui.qs('#fGpsBox', el); if (!S.acc || S.sumber === 'MANUAL') { b.innerHTML = ''; return; }
      const bad = S.acc > cfg.akurasiMax;
      b.innerHTML = '<div class="gpsbox"><div><div class="t-xs">Akurasi perangkat</div><div class="gpsbox__acc ' + (bad ? 'acc-bad' : 'acc-ok') + '">±' + S.acc + ' m</div></div><div class="grow t-sm">' + (bad ? 'Melebihi ambang ' + cfg.akurasiMax + ' m. Geser pin ke posisi bangunan yang tepat, lalu centang konfirmasi.' : 'Di bawah ambang ' + cfg.akurasiMax + ' m — layak dipakai.') + '</div>' + (bad ? '<label class="check"><input type="checkbox" id="fAdj"' + (S.adjusted ? ' checked' : '') + '><span>Saya sudah menyesuaikan pin secara manual</span></label>' : '') + '</div>';
      const c = ui.qs('#fAdj', b); if (c) c.onchange = () => S.adjusted = c.checked;
    }
    ui.qs('#fGps', el).onclick = () => {
      const btn = ui.qs('#fGps', el); btn.disabled = true; btn.innerHTML = ui.icon('refresh') + 'Mengambil lokasi…';
      const done = (pt, acc, sim) => { btn.disabled = false; btn.innerHTML = ui.icon('target') + 'Ambil ulang GPS'; S.sumber = 'GPS'; S.acc = Math.round(acc); S.adjusted = false; S.gpsRaw = pt; placePin(pt, false); gpsBox(); if (sim) ui.toast('Lokasi perangkat di luar Kabupaten Tegal/tidak tersedia — prototipe memakai <b>lokasi simulasi</b> di sekitar objek.', 'warning', 'GPS simulasi'); };
      const sim = () => { const t = op.truth; const acc = 4 + Math.random() * 30; done([t[0] + (Math.random() - 0.5) * acc / 111000, t[1] + (Math.random() - 0.5) * acc / 111000], acc, true); };
      if (!navigator.geolocation) return sim();
      navigator.geolocation.getCurrentPosition(pos => { const pt = [pos.coords.latitude, pos.coords.longitude]; if (!D.inKab(pt[0], pt[1])) return sim(); done(pt, pos.coords.accuracy); }, sim, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    };
    ui.qs('#fMan', el).onclick = () => { picking = true; map.getContainer().style.cursor = 'crosshair'; ui.toast('Ketuk lokasi objek di peta.', 'success'); };
    ui.qs('#fBase', el).onchange = (ev) => M.setBase(map, ev.target.value);
    ['#fLat', '#fLng'].forEach(s => ui.qs(s, el).onchange = () => { const pc = D.parseCoord(ui.qs('#fLat', el).value, ui.qs('#fLng', el).value); if (pc.lat == null) { ui.qs('#fVal', el).innerHTML = '<div class="note note--danger">' + ui.icon('x') + '<div>' + ui.esc(pc.alasan) + '</div></div>'; return; } S.sumber = 'MANUAL'; S.acc = null; gpsBox(); placePin([pc.lat, pc.lng], false); });
    ui.fotoPicker(ui.qs('#fFoto', el), S.fotos, { min: cfg.fotoMin, max: cfg.fotoMax });
    ui.qs('#fFoto', el).addEventListener('change', () => setTimeout(validate, 600));
    function collect(status) {
      const err = ui.qs('#fErr', el); err.hidden = true; const fail = (m) => { err.textContent = m; err.hidden = false; return null; };
      if (S.lat == null) return fail('Tentukan titik lokasi terlebih dahulu.');
      const v = validate(); if (status !== 'DRAF') {
        if (!v.ok) return fail(v.errors[0]);
        if (S.acc && S.acc > cfg.akurasiMax && !S.adjusted) return fail('Akurasi GPS ±' + S.acc + ' m melebihi ambang. Sesuaikan pin dan centang konfirmasi.');
        if (S.fotos.length < cfg.fotoMin) return fail('Lampirkan minimal ' + cfg.fotoMin + ' foto.');
        if (old && !ui.qs('#fAl', el).value.trim()) return fail('Alasan wajib diisi untuk koreksi koordinat.');
      }
      const tg = ui.qs('#fTg', el);
      return { idop: op.idop, jenis: old ? 'KOREKSI' : 'BARU', lat: S.lat, lng: S.lng, akurasi: S.acc || 0, sumber: S.sumber || 'MANUAL', observed_at: nowISO(), alasan: ui.qs('#fAl', el).value.trim(), catatan: ui.qs('#fCt', el).value.trim(), tugas: tg && tg.value ? tg.value : (p ? p.tugas : null), fotos: S.fotos.slice(), status, created_by: u.id, submitted_at: nowISO() };
    }
    function save(status) {
      const data = collect(status); if (!data) return;
      let rec; if (p) { Object.assign(p, data); rec = p; } else rec = D.newProposal(data);
      if (status === 'DIAJUKAN') {
        if (rec.tugas) { const t = D.state.assignments.find(x => x.id === rec.tugas); if (t) { const tg = t.targets.find(x => x.idop === op.idop); if (tg) tg.status = 'DIAJUKAN'; if (t.status === 'DITUGASKAN') t.status = 'DIKERJAKAN'; } }
        const spv = D.state.users.find(x => x.role === 'supervisor' && x.kec !== 'all' && x.kec.includes(op.kec)); if (spv && spv.id !== u.id) D.notify(spv.id, 'Usulan koordinat baru', op.nama + ' (' + rec.id + ') menunggu verifikasi.', '#/usulan/' + rec.id);
        D.audit('usulan.kirim', (p ? 'Mengirim ulang ' : 'Mengirim ') + 'usulan koordinat ' + rec.id + ' untuk ' + op.noOp, rec.id);
      } else D.audit('usulan.draf', 'Menyimpan draf usulan ' + rec.id, rec.id);
      D.save(); ui.toast(status === 'DIAJUKAN' ? 'Usulan <b>' + rec.id + '</b> terkirim ke supervisor.' : 'Draf disimpan.', 'success'); location.hash = '#/usulan/' + rec.id;
    }
    ui.qs('#fSend', el).onclick = () => save('DIAJUKAN');
    ui.qs('#fDraft', el).onclick = () => save('DRAF');
    setTimeout(gpsBox, 30);
  }

  function view(el, p, op) {
    const u = D.me(), cfg = D.state.cfg; const vs = D.state.verifications.filter(v => v.target === 'proposal' && v.tid === p.id);
    const masterOld = op.q === 'VALID' ? [op.mLat, op.mLng] : (op.q === 'PERLU_CEK' && op.mLat ? [op.mLat, op.mLng] : null);
    const prevLoc = D.state.locations.filter(l => l.idop === op.idop && l.proposal !== p.id).pop();
    const old = prevLoc ? [prevLoc.lat, prevLoc.lng] : masterOld;
    const v = D.validatePoint(p.lat, p.lng, op); const canDecide = D.can('verification.decide') && p.status === 'DIAJUKAN' && p.created_by !== u.id && D.userKecs().includes(op.kec);
    const own = p.created_by === u.id; const fw = D.state.forwards.find(f => f.target === 'proposal' && f.tid === p.id);
    const tl = [{ tone: 'done', icon: 'send', title: 'Diajukan oleh ' + ui.esc(D.user(p.created_by).nama), time: ui.dateTime(p.submitted_at), desc: ui.esc(p.catatan || '') }].concat(vs.map(x => ({ tone: x.keputusan === 'DISETUJUI' ? 'done' : x.keputusan === 'DITOLAK' ? 'danger' : 'current', icon: D.ST_USULAN[x.keputusan].ikon, title: D.ST_USULAN[x.keputusan].label + ' oleh ' + ui.esc(D.user(x.by).nama), time: ui.dateTime(x.at), desc: ui.esc(x.catatan) })));
    if (fw) tl.push({ tone: 'done', icon: 'arrow-right', title: D.ST_TERUS[fw.status].label, time: ui.dateTime(fw.at) + (fw.batch ? ' · batch ' + (D.state.batches.find(b => b.id === fw.batch) || {}).no : '') });
    el.innerHTML = '<div class="pagehead"><div><a href="#/koordinat' + (D.can('verification.decide') ? '?tab=verif' : '?tab=saya') + '" class="t-sm">' + ui.icon('chevron-left') + ' Pendataan koordinat</a><div class="pagehead__title" style="margin-top:6px">Usulan ' + p.id + '</div><div class="row wrap mt-s">' + ui.bUsulan(p.status) + '<span class="badge badge--outline">' + (p.jenis === 'BARU' ? 'Koordinat baru' : 'Koreksi koordinat') + '</span>' + (fw ? ui.bTerus(fw.status) : '') + '</div></div><div class="pagehead__actions">' +
      (own && ['DIKEMBALIKAN', 'DRAF'].includes(p.status) ? '<a class="btn btn--primary" href="#/usulan/' + p.id + '?edit=1">' + ui.icon('edit') + (p.status === 'DRAF' ? 'Lanjutkan draf' : 'Perbaiki & kirim ulang') + '</a><button class="btn btn--secondary" id="uCancel">Batalkan</button>' : '') + '</div></div>' +
      '<div class="grid12"><div class="c8x stack"><div class="card"><div class="card__head"><div><div class="card__title">Perbandingan lokasi</div><div class="card__sub">' + ui.esc(op.nama) + ' · batas ' + ui.esc(D.desaName(op.kec, op.kel)) + ' (BIG)</div></div><select class="select" id="vBase" style="width:auto">' + Object.keys(M.BASE).map(k => '<option value="' + k + '"' + (k === 'sat' ? ' selected' : '') + '>' + M.BASE[k].nama + '</option>').join('') + '</select></div><div class="card__body card__body--tight stack"><div class="minimap minimap--tall" id="vMap"></div>' +
      '<div class="cmpgrid"><div class="cmp"><div class="cmp__l">Usulan</div><div class="cmp__v">' + ui.coord(p.lat) + ', ' + ui.coord(p.lng) + '</div></div><div class="cmp"><div class="cmp__l">' + (prevLoc ? 'Lokasi GIS sebelumnya' : 'Koordinat master') + '</div><div class="cmp__v">' + (old ? ui.coord(old[0]) + ', ' + ui.coord(old[1]) : (ui.esc(op.latRaw) || '∅') + ' / ' + (ui.esc(op.lngRaw) || '∅') + ' (' + D.KUALITAS[op.q].short + ')') + '</div></div>' +
      '<div class="cmp"><div class="cmp__l">Jarak perubahan</div><div class="cmp__v">' + (old ? ui.dist(D.haversine(old, [p.lat, p.lng])) : '—') + '</div></div><div class="cmp"><div class="cmp__l">Akurasi · sumber</div><div class="cmp__v ' + (p.akurasi > cfg.akurasiMax ? 'acc-bad' : '') + '">' + (p.akurasi ? '±' + p.akurasi + ' m' : '—') + ' · ' + p.sumber.replace('_', ' ') + '</div></div></div>' +
      v.errors.concat(v.warnings).map(x => '<div class="note note--warn">' + ui.icon('alert') + '<div>' + ui.esc(x) + '</div></div>').join('') + (v.ok && !v.warnings.length ? '<div class="note note--ok">' + ui.icon('check-circle') + '<div>Titik berada di dalam desa/kelurahan terdaftar.</div></div>' : '') +
      '</div></div><div class="card"><div class="card__head"><div class="card__title">Foto lapangan (' + p.fotos.length + ')</div></div><div class="card__body"><div class="fotostrip">' + p.fotos.map(f => '<div>' + ui.fotoHTML(f) + '</div>').join('') + '</div></div></div></div>' +
      '<div class="c4x stack">' + (canDecide ? '<div class="card" style="border-color:var(--teal-600)"><div class="card__head"><div><div class="card__title">Keputusan verifikasi</div><div class="card__sub">Wajib catatan untuk kembalikan/tolak</div></div></div><div class="card__body stack"><button class="btn btn--primary btn--block" id="dOk">' + ui.icon('check') + 'Setujui</button><button class="btn btn--secondary btn--block" id="dBack">' + ui.icon('refresh') + 'Kembalikan untuk perbaikan</button><button class="btn btn--subtle-danger btn--block" id="dNo">' + ui.icon('x') + 'Tolak</button><p class="t-xs">Persetujuan membuat lokasi GIS terverifikasi dan memasukkannya ke antrean penerusan. Master <span class="t-mono">BSG_OP</span> tidak diubah.</p></div></div>' : (D.can('verification.decide') && own && p.status === 'DIAJUKAN' ? '<div class="note note--warn">' + ui.icon('lock') + '<div>Usulan ini dibuat oleh Anda sendiri — keputusan harus diambil supervisor lain.</div></div>' : '')) +
      '<div class="card"><div class="card__head"><div class="card__title">Detail</div></div><div class="card__body"><dl class="kv"><dt>Objek</dt><dd>' + (D.can('object.detail') ? '<a href="#/objek/' + op.idop + '">' + ui.esc(op.nama) + '</a>' : ui.esc(op.nama)) + '<div class="cell-sub t-mono">' + op.noOp + '</div></dd><dt>Wilayah</dt><dd>' + ui.esc(D.desaName(op.kec, op.kel)) + ', ' + D.KEC_BY[op.kec].nama + '</dd><dt>Petugas</dt><dd>' + ui.esc(D.user(p.created_by).nama) + '</dd><dt>Waktu amatan</dt><dd>' + ui.dateTime(p.observed_at) + '</dd><dt>Alasan</dt><dd>' + ui.esc(p.alasan || '—') + '</dd>' + (p.tugas ? '<dt>Penugasan</dt><dd><a href="#/tugas/' + p.tugas + '">' + p.tugas + '</a></dd>' : '') + '</dl></div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Riwayat</div></div><div class="card__body">' + ui.timeline(tl) + '</div></div></div></div>';
    setTimeout(() => {
      const map = M.mini(ui.qs('#vMap', el), { desa: D.DESA_BY[op.kec + '-' + op.kel], base: 'sat' }); App.onLeave(() => map.remove());
      const pts = [[p.lat, p.lng]];
      L.marker([p.lat, p.lng], { icon: M.pinIcon('teal', 'Usulan') }).addTo(map);
      if (old) { pts.push(old); L.marker(old, { icon: M.pinIcon('red', prevLoc ? 'GIS lama' : 'Master') }).addTo(map); L.polyline([old, [p.lat, p.lng]], { color: '#fff', dashArray: '4 6', weight: 2 }).addTo(map); }
      if (p.akurasi) L.circle([p.lat, p.lng], { radius: p.akurasi, color: '#0A97A6', weight: 1, fillOpacity: 0.12 }).addTo(map);
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.6), { maxZoom: 19 }); else map.setView(pts[0], 18);
      ui.qs('#vBase', el).onchange = (ev) => M.setBase(map, ev.target.value);
    }, 20);
    if (canDecide) {
      ui.qs('#dOk', el).onclick = () => ui.confirm({ title: 'Setujui usulan ' + p.id + '?', sub: 'Lokasi GIS terverifikasi akan dibuat untuk ' + ui.esc(op.nama) + ' dan ditampilkan di peta. Koordinat master tidak berubah sampai diterapkan pengelola sistem utama.', okLabel: 'Setujui', onOk: () => decide('DISETUJUI', 'Sesuai foto dan lokasi.') });
      ui.qs('#dBack', el).onclick = () => ui.prompt({ title: 'Kembalikan untuk perbaikan', label: 'Catatan perbaikan untuk petugas', required: true, placeholder: 'mis. akurasi terlalu rendah, foto tampak depan kurang jelas', okLabel: 'Kembalikan', onOk: (t) => decide('DIKEMBALIKAN', t) });
      ui.qs('#dNo', el).onclick = () => ui.prompt({ title: 'Tolak usulan', label: 'Alasan penolakan', required: true, danger: true, okLabel: 'Tolak', onOk: (t) => decide('DITOLAK', t) });
    }
    const cc = ui.qs('#uCancel', el); if (cc) cc.onclick = () => ui.confirm({ title: 'Batalkan usulan?', danger: true, okLabel: 'Batalkan usulan', onOk: () => { p.status = 'DIBATALKAN'; D.audit('usulan.batal', 'Membatalkan ' + p.id, p.id); D.save(); App.rerender(); } });
    function decide(k, note) {
      p.status = k; D.state.verifications.push({ id: 'v' + Date.now(), target: 'proposal', tid: p.id, keputusan: k, catatan: note, by: u.id, at: nowISO() });
      if (k === 'DISETUJUI') { D.state.locations.forEach(l => { if (l.idop === p.idop) l.aktif = false; }); D.state.locations.push({ idop: p.idop, lat: p.lat, lng: p.lng, akurasi: p.akurasi, sumber: p.sumber, proposal: p.id, by: u.id, at: nowISO(), aktif: true }); }
      if (p.tugas) { const t = D.state.assignments.find(x => x.id === p.tugas); if (t) { const tg = t.targets.find(x => x.idop === p.idop); if (tg) tg.status = k; } }
      D.notify(p.created_by, 'Usulan ' + D.ST_USULAN[k].label.toLowerCase(), op.nama + ' (' + p.id + ')' + (note && k !== 'DISETUJUI' ? ': ' + note : ''), '#/usulan/' + p.id);
      D.audit('verifikasi.' + k.toLowerCase(), D.ST_USULAN[k].label + ' usulan ' + p.id, p.id); D.save();
      ui.toast('Usulan ' + p.id + ' — ' + D.ST_USULAN[k].label.toLowerCase() + '.', k === 'DISETUJUI' ? 'success' : 'warning');
      const next = D.state.proposals.find(x => x.status === 'DIAJUKAN' && x.created_by !== u.id && D.userKecs().includes(D.OP_BY[x.idop].kec));
      location.hash = next ? '#/usulan/' + next.id : '#/koordinat?tab=verif';
    }
  }

  /* ================= Calon Objek ================= */
  App.page('calon', {
    title: (r) => r.params[0] ? 'Calon Objek ' + r.params[0] : 'Calon Objek Pajak', crumb: 'Pendataan Lapangan', perm: ['candidate.create', 'verification.decide'],
    render(el, r) { if (r.params[0]) return calonDetail(el, r.params[0]); calonList(el, r); }
  });
  function calonVisible(c) { const u = D.me(); return u.role === 'petugas' ? (c.created_by === u.id || D.userKecs().includes(c.kec)) : D.userKecs().includes(c.kec); }
  function calonList(el, r) {
    const all = D.state.candidates.filter(calonVisible).slice().reverse(); let fs = r.q.status || '';
    const cnt = {}; all.forEach(c => cnt[c.status] = (cnt[c.status] || 0) + 1);
    el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">Calon objek pajak</div><p class="pagehead__desc">Temuan lapangan yang diduga belum terdaftar. ID bersifat sementara; status <b>terverifikasi</b> berarti hasil pemeriksaan, bukan berarti sudah tercatat di data induk. Tidak ada deteksi otomatis.</p></div><div class="pagehead__actions">' + (D.can('candidate.create') ? '<a class="btn btn--primary" href="#/peta?calon=1">' + ui.icon('plus') + 'Catat calon objek</a>' : '') + '</div></div>' +
      '<div class="row wrap mb" id="cFs"><button class="chip' + (!fs ? ' is-active' : '') + '" data-s="">Semua (' + all.length + ')</button>' + Object.keys(D.ST_CALON).map(k => '<button class="chip' + (fs === k ? ' is-active' : '') + '" data-s="' + k + '">' + D.ST_CALON[k].label + ' (' + (cnt[k] || 0) + ')</button>').join('') + '</div>' +
      '<div class="grid12"><div class="c8x" id="cT"></div><div class="c4x"><div class="card"><div class="card__head"><div class="card__title">Sebaran temuan</div></div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="cMap"></div></div></div></div></div>';
    const tbl = ui.table(ui.qs('#cT', el), {
      rows: all.filter(c => !fs || c.status === fs), onRow: c => location.hash = '#/calon/' + c.id, pageSize: 15,
      cols: [
        { label: 'ID sementara', cell: c => '<span class="t-mono">' + c.id + '</span>', sort: c => c.id },
        { label: 'Nama / deskripsi', cell: c => '<div class="cell-title">' + ui.esc(c.nama) + '</div><div class="cell-sub">' + ui.esc((c.deskripsi || '').slice(0, 60)) + '</div>' },
        { label: 'Dugaan jenis', cell: c => D.JENIS_BY[c.dugaan].short },
        { label: 'Wilayah', cell: c => ui.esc(D.desaName(c.kec, c.kel)) + '<div class="cell-sub">' + D.KEC_BY[c.kec].nama + '</div>' },
        { label: 'Koordinat', cell: c => c.lat ? '<span class="badge badge--outline">' + ui.icon('pin') + '<span>Ada' + (c.akurasi ? ' ±' + c.akurasi + ' m' : '') + '</span></span>' : '—' },
        { label: 'Dicatat', cell: c => ui.date(c.created_at) + '<div class="cell-sub">' + ui.esc(D.user(c.created_by).nama) + '</div>', sort: c => c.created_at },
        { label: 'Status', cell: c => ui.bCalon(c.status), sort: c => c.status }
      ]
    });
    ui.qsa('#cFs .chip', el).forEach(c => c.onclick = () => { ui.qsa('#cFs .chip', el).forEach(x => x.classList.toggle('is-active', x === c)); fs = c.dataset.s; tbl.rows = all.filter(x => !fs || x.status === fs); });
    setTimeout(() => {
      const map = M.mini(ui.qs('#cMap', el), {}); App.onLeave(() => map.remove()); const pts = [];
      all.forEach(c => { pts.push([c.lat, c.lng]); L.marker([c.lat, c.lng], { icon: M.icon('CALON') }).bindTooltip('<b>' + ui.esc(c.nama) + '</b><br>' + D.ST_CALON[c.status].label, { className: 'maptip' }).on('click', () => location.hash = '#/calon/' + c.id).addTo(map); });
      M.scopeShade(map, D.userKecs()); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3));
    }, 20);
  }
  function calonDetail(el, id) {
    const c = D.state.candidates.find(x => x.id === id); const u = D.me();
    if (!c || !calonVisible(c)) { el.innerHTML = App.forbidden(); return; }
    const isSpv = D.can('verification.decide') && D.userKecs().includes(c.kec);
    if (isSpv && c.status === 'BARU' && c.created_by !== u.id) { c.status = 'DALAM_VERIFIKASI'; D.audit('calon.periksa', 'Mulai memeriksa ' + c.id, c.id); D.save(); }
    const dups = D.duplicates(c.lat, c.lng, c.nama, D.state.cfg.radiusDuplikat);
    const vs = D.state.verifications.filter(v => v.target === 'candidate' && v.tid === c.id);
    const canDecide = isSpv && ['DALAM_VERIFIKASI', 'BARU'].includes(c.status) && c.created_by !== u.id;
    const fw = D.state.forwards.find(f => f.target === 'candidate' && f.tid === c.id);
    el.innerHTML = '<div class="pagehead"><div><a href="#/calon" class="t-sm">' + ui.icon('chevron-left') + ' Calon objek pajak</a><div class="pagehead__title" style="margin-top:6px">' + ui.esc(c.nama) + '</div><div class="row wrap mt-s"><span class="t-mono t-sm">' + c.id + '</span>' + ui.bCalon(c.status) + (fw ? ui.bTerus(fw.status) : '') + '</div></div><div class="pagehead__actions">' + (c.created_by === u.id && c.status === 'PERLU_KELENGKAPAN' ? '<button class="btn btn--primary" id="cFix">' + ui.icon('upload') + 'Lengkapi & kirim ulang</button>' : '') + '</div></div>' +
      '<div class="note note--warn mb">' + ui.icon('info') + '<div>ID sementara, bukan nomor objek resmi. Persetujuan tidak menggantikan proses pendaftaran objek pajak secara resmi.</div></div>' +
      '<div class="grid12"><div class="c8x stack"><div class="card"><div class="card__head"><div><div class="card__title">Lokasi & objek terdaftar di sekitar</div><div class="card__sub">Kuning = temuan · bulat = objek terdaftar · lingkaran = radius cek duplikat ' + D.state.cfg.radiusDuplikat + ' m</div></div></div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="dMap"></div></div></div>' +
      '<div class="card"><div class="card__head"><div><div class="card__title">Kandidat duplikat</div><div class="card__sub">Gabungan jarak + kemiripan nama (trigram). Keputusan tetap oleh verifikator.</div></div></div><div class="card__body" style="padding:0">' +
      (dups.length ? '<table class="data"><thead><tr><th>Objek terdaftar</th><th>Jarak</th><th>Kemiripan nama</th><th>Skor</th>' + (canDecide ? '<th></th>' : '') + '</tr></thead><tbody>' + dups.map(x => '<tr><td><div class="cell-title">' + ui.esc(x.op.nama) + '</div><div class="cell-sub">' + D.JENIS_BY[x.op.jenis].short + ' · ' + ui.esc(x.op.alamat) + (x.tanpaKoordinat ? ' · <b>tanpa koordinat</b>' : '') + '</div></td><td>' + ui.dist(x.dist) + '</td><td>' + Math.round(x.sim * 100) + '%</td><td><span class="score"><i><b style="width:' + Math.round(x.score * 100) + '%"></b></i>' + Math.round(x.score * 100) + '</span></td>' + (canDecide ? '<td><button class="btn btn--sm btn--secondary" data-match="' + x.op.idop + '">Cocokkan</button></td>' : '') + '</tr>').join('') + '</tbody></table>' : '<div class="card__body">' + ui.state({ icon: 'check-circle', title: 'Tidak ada kandidat duplikat', desc: 'Tidak ditemukan objek terdaftar yang dekat atau bernama mirip.' }) + '</div>') + '</div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Foto (' + c.fotos.length + ')</div></div><div class="card__body"><div class="fotostrip">' + c.fotos.map(f => '<div>' + ui.fotoHTML(f) + '</div>').join('') + '</div></div></div></div>' +
      '<div class="c4x stack">' + (canDecide ? '<div class="card" style="border-color:var(--teal-600)"><div class="card__head"><div class="card__title">Keputusan verifikasi</div></div><div class="card__body stack"><button class="btn btn--primary btn--block" id="kOk">' + ui.icon('check') + 'Terverifikasi — layak didaftarkan</button><button class="btn btn--secondary btn--block" id="kLeng">' + ui.icon('alert') + 'Perlu kelengkapan</button><button class="btn btn--secondary btn--block" id="kOld">' + ui.icon('building') + 'Cocok dengan objek lama…</button><button class="btn btn--subtle-danger btn--block" id="kNo">' + ui.icon('x') + 'Tidak dilanjutkan</button></div></div>' : '') +
      '<div class="card"><div class="card__head"><div class="card__title">Data temuan</div></div><div class="card__body"><dl class="kv"><dt>Dugaan jenis</dt><dd>' + D.JENIS_BY[c.dugaan].nama + '</dd><dt>Alamat</dt><dd>' + ui.esc(c.alamat) + '</dd><dt>Wilayah</dt><dd>' + ui.esc(D.desaName(c.kec, c.kel)) + ', Kec. ' + D.KEC_BY[c.kec].nama + '</dd><dt>Koordinat</dt><dd class="t-mono">' + ui.coord(c.lat) + ', ' + ui.coord(c.lng) + '<div class="cell-sub" style="font-family:var(--font-ui)">' + c.sumber + (c.akurasi ? ' ±' + c.akurasi + ' m' : '') + '</div></dd>' +
      '<dt>Pemilik</dt><dd>' + (c.pemilik ? (D.can('taxpayer.pii') || c.created_by === u.id ? ui.esc(c.pemilik) : ui.esc(ui.maskNama(c.pemilik))) : '—') + '</dd><dt>Kontak</dt><dd>' + (c.kontak ? ui.masked(c.kontak, ui.maskHp(c.kontak), 'calon:' + c.id) : '—') + '</dd><dt>Skala</dt><dd>' + ui.esc(c.skala || '—') + '</dd><dt>Deskripsi</dt><dd>' + ui.esc(c.deskripsi || '—') + '</dd>' +
      (c.matched ? '<dt>Objek lama</dt><dd><a href="#/objek/' + c.matched + '">' + ui.esc(D.OP_BY[c.matched].nama) + '</a></dd>' : '') + (c.registeredIdop ? '<dt>IDOP resmi</dt><dd class="t-mono">' + c.registeredIdop + '</dd>' : '') + '<dt>Cek duplikat</dt><dd>' + (c.noMatchAt ? 'Petugas menyatakan tidak ada yang cocok · ' + ui.dateTime(c.noMatchAt) : '—') + '</dd></dl></div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Riwayat</div></div><div class="card__body">' + ui.timeline([{ icon: 'plus', title: 'Dicatat oleh ' + ui.esc(D.user(c.created_by).nama), time: ui.dateTime(c.created_at) }].concat(vs.map(v => ({ tone: v.keputusan === 'TIDAK_DILANJUTKAN' ? 'danger' : v.keputusan === 'PERLU_KELENGKAPAN' ? 'current' : 'done', icon: D.ST_CALON[v.keputusan].ikon, title: D.ST_CALON[v.keputusan].label + ' · ' + ui.esc(D.user(v.by).nama), time: ui.dateTime(v.at), desc: ui.esc(v.catatan) })))) + '</div></div></div></div>';

    setTimeout(() => {
      const map = M.mini(ui.qs('#dMap', el), { desa: D.DESA_BY[c.kec + '-' + c.kel], base: 'osm' }); App.onLeave(() => map.remove());
      L.circle([c.lat, c.lng], { radius: D.state.cfg.radiusDuplikat, color: '#B77800', weight: 1.5, dashArray: '5 5', fillOpacity: 0.06 }).addTo(map);
      L.marker([c.lat, c.lng], { icon: M.icon('CALON', true), zIndexOffset: 1000 }).bindTooltip(ui.esc(c.nama), { className: 'maptip', permanent: true, direction: 'top', offset: [0, -14] }).addTo(map);
      D.OP.forEach(o => { const e = D.effLoc(o); if (e.lat == null) return; if (D.haversine([c.lat, c.lng], [e.lat, e.lng]) > 600) return; L.marker([e.lat, e.lng], { icon: M.icon(o.aktif ? D.bayar(o, D.state.tahun).status : 'TIDAK_TERSEDIA') }).bindTooltip(ui.esc(o.nama) + '<br><span class="t-xs">' + D.JENIS_BY[o.jenis].short + '</span>', { className: 'maptip' }).addTo(map); });
      map.setView([c.lat, c.lng], 17);
    }, 20);
    const dec = (k, note, matched) => {
      c.status = k; if (matched) c.matched = matched;
      D.state.verifications.push({ id: 'v' + Date.now(), target: 'candidate', tid: c.id, keputusan: k, catatan: note, matched, by: u.id, at: nowISO() });
      D.notify(c.created_by, 'Temuan ' + D.ST_CALON[k].label.toLowerCase(), c.nama + ' (' + c.id + ')' + (note ? ': ' + note : ''), '#/calon/' + c.id);
      D.audit('calon.' + k.toLowerCase(), D.ST_CALON[k].label + ' ' + c.id, c.id); D.save(); ui.toast(c.id + ' — ' + D.ST_CALON[k].label + '.'); App.rerender();
    };
    if (canDecide) {
      ui.qs('#kOk', el).onclick = () => ui.prompt({ title: 'Tandai terverifikasi', label: 'Catatan verifikasi', placeholder: 'mis. layak diteruskan ke pendataan resmi', okLabel: 'Simpan keputusan', onOk: t => dec('TERVERIFIKASI', t || 'Layak diteruskan ke pendataan resmi.') });
      ui.qs('#kLeng', el).onclick = () => ui.prompt({ title: 'Minta kelengkapan', label: 'Daftar kekurangan', required: true, okLabel: 'Kirim ke petugas', onOk: t => dec('PERLU_KELENGKAPAN', t) });
      ui.qs('#kNo', el).onclick = () => ui.prompt({ title: 'Tidak dilanjutkan', label: 'Alasan', required: true, danger: true, okLabel: 'Simpan', onOk: t => dec('TIDAK_DILANJUTKAN', t) });
      const matchFlow = (idop) => { const o = D.OP_BY[idop]; ui.confirm({ title: 'Cocokkan dengan objek lama?', sub: 'Temuan akan ditautkan ke <b>' + ui.esc(o.nama) + '</b> (' + o.noOp + ').', body: (!D.mapped(o) && !D.activeProposal(o.idop) ? '<label class="check check--block"><input type="checkbox" id="mkProp" checked><span><span class="check__title">Jadikan usulan koordinat untuk objek ini</span><span class="check__desc">Titik & foto temuan dipakai sebagai usulan; objek ini belum berkoordinat.</span></span></label>' : ''), okLabel: 'Cocokkan', collect: m => { const x = ui.qs('#mkProp', m); return x && x.checked; }, onOk: (mk) => { dec('COCOK_OBJEK_LAMA', 'Sudah terdaftar sebagai ' + o.noOp, idop); if (mk) { const pr = D.newProposal({ idop, jenis: 'BARU', lat: c.lat, lng: c.lng, akurasi: c.akurasi || 0, sumber: c.sumber, observed_at: c.created_at, alasan: 'Dari temuan ' + c.id + ' (cocok objek lama)', catatan: c.deskripsi, status: 'DIAJUKAN', created_by: c.created_by, submitted_at: nowISO(), fotos: c.fotos.slice() }); D.save(); ui.toast('Usulan koordinat ' + pr.id + ' dibuat dari temuan.'); } } }); };
      ui.qsa('[data-match]', el).forEach(b => b.onclick = () => matchFlow(b.dataset.match));
      ui.qs('#kOld', el).onclick = () => { if (dups.length) { ui.toast('Pilih objek dari tabel kandidat duplikat, atau cari manual.', 'warning'); } ui.modal({ title: 'Cari objek lama', body: '<input class="input" id="moQ" placeholder="Nama objek / No OP"><div id="moR" class="mt-s"></div>', onOpen: m => { ui.qs('#moQ', m).oninput = (e) => { const v = e.target.value.toLowerCase(); ui.qs('#moR', m).innerHTML = v.length < 3 ? '' : D.scopedOps().filter(o => o.kec === c.kec && (o.nama.toLowerCase().includes(v) || o.noOp.includes(v))).slice(0, 8).map(o => '<div class="nearit"><div class="grow"><div class="t-sm" style="font-weight:600;color:var(--text-primary)">' + ui.esc(o.nama) + '</div><div class="t-xs">' + o.noOp + ' · ' + ui.esc(o.alamat) + '</div></div><button class="btn btn--sm btn--secondary" data-pk="' + o.idop + '">Pilih</button></div>').join(''); ui.qsa('[data-pk]', m).forEach(b => b.onclick = () => { ui.closeModal(); setTimeout(() => matchFlow(b.dataset.pk), 200); }); }; } }); };
    }
    const fx = ui.qs('#cFix', el); if (fx) fx.onclick = () => { const add = []; ui.modal({ title: 'Lengkapi temuan ' + c.id, body: '<div class="note note--warn mb">' + ui.icon('alert') + '<div>' + ui.esc((vs.filter(v => v.keputusan === 'PERLU_KELENGKAPAN').pop() || {}).catatan || '') + '</div></div><div class="field"><span class="field__label">Foto tambahan</span><div id="fxF"></div></div><div class="field mt"><label class="field__label" for="fxN">Keterangan tambahan</label><textarea class="textarea" id="fxN" rows="3"></textarea></div>', foot: '<button class="btn btn--secondary" data-close>Batal</button><button class="btn btn--primary" id="fxS">Kirim ulang</button>', onOpen: m => { ui.fotoPicker(ui.qs('#fxF', m), add, { max: 5 }); ui.qs('#fxS', m).onclick = () => { c.fotos = c.fotos.concat(add); const n = ui.qs('#fxN', m).value.trim(); if (n) c.deskripsi = (c.deskripsi ? c.deskripsi + '\n' : '') + '[Kelengkapan] ' + n; c.status = 'DALAM_VERIFIKASI'; D.audit('calon.lengkapi', 'Melengkapi ' + c.id, c.id); D.save(); ui.closeModal(); ui.toast('Kelengkapan dikirim.'); App.rerender(); }; } }); };
  }
})();
