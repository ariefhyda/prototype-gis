/* Data Objek Pajak (A4), Detail (A4d), Data Wajib Pajak (A5) */
(function () {
  const ui = UI;

  App.page('objek', {
    title: (r) => r.params[0] ? 'Detail Objek Pajak' : 'Data Objek Pajak', crumb: 'Data Pokok', perm: 'object.view',
    render(el, r) { if (r.params[0]) return detail(el, r.params[0]); list(el, r); }
  });

  function list(el, r) {
    const th = D.state.tahun; const kecs = D.userKecs();
    const F = { q: r.q.q || '', kec: r.q.kec || '', kel: '', jenis: '', bayar: '', koor: r.q.koor || '', aktif: false };
    el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">Data objek pajak</div><p class="pagehead__desc">Baca-saja dari <span class="t-mono">PBB.BSG_OP</span> (simulasi) dalam cakupan wilayah Anda. Status pembayaran dan status keaktifan ditampilkan di kolom terpisah.</p></div><div class="pagehead__actions">' + (D.can('report.export') ? '<button class="btn btn--secondary" id="oExp">' + ui.icon('download') + 'Ekspor CSV</button>' : '') + '</div></div>' +
      '<div id="oStats" class="grid-stats"></div>' +
      '<div class="filterbar mb"><div class="field" style="flex:2 1 240px"><label class="field__label" for="fQ">Pencarian</label><span class="input-wrap"><span class="icon--prefix">' + ui.icon('search') + '</span><input class="input" id="fQ" type="search" value="' + ui.esc(F.q) + '" placeholder="No OP, nama objek, alamat' + (D.can('object.detail') ? ', nama WP' : '') + '"></span></div>' +
      '<div class="field"><label class="field__label" for="fKec">Kecamatan</label><select class="select" id="fKec">' + ui.kecOptions(F.kec, kecs) + '</select></div>' +
      '<div class="field"><label class="field__label" for="fKel">Desa/kelurahan</label><select class="select" id="fKel">' + ui.desaOptions(F.kec) + '</select></div>' +
      '<div class="field"><label class="field__label" for="fJ">Jenis pajak</label><select class="select" id="fJ">' + ui.jenisOptions('') + '</select></div>' +
      (D.can('payment.view') ? '<div class="field"><label class="field__label" for="fB">Pembayaran ' + th + '</label><select class="select" id="fB"><option value="">Semua status</option>' + Object.keys(D.STATUS_BAYAR).map(k => '<option value="' + k + '">' + D.STATUS_BAYAR[k].label + '</option>').join('') + '</select></div>' : '') +
      '<div class="field"><label class="field__label" for="fK">Kualitas koordinat</label><select class="select" id="fK"><option value="">Semua</option><option value="map"' + (F.koor === 'map' ? ' selected' : '') + '>Tampil di peta</option><option value="nomap"' + (F.koor === 'nomap' ? ' selected' : '') + '>Belum terpetakan</option>' + Object.keys(D.KUALITAS).map(k => '<option value="' + k + '"' + (F.koor === k ? ' selected' : '') + '>' + D.KUALITAS[k].label + '</option>').join('') + '</select></div>' +
      '<div class="field" style="flex:0 0 auto;min-width:auto"><label class="check check--block"><input type="checkbox" id="fA"><span><span class="check__title">Hanya aktif</span></span></label></div></div>' +
      '<div id="oTbl"></div>';
    let rows = [];
    const tbl = ui.table(ui.qs('#oTbl', el), {
      rows: [], pageSize: 20, onRow: (o) => { if (D.can('object.detail')) location.hash = '#/objek/' + o.idop; },
      cols: [
        { label: 'No OP', cell: o => '<span class="t-mono" style="font-size:12px">' + o.noOp + '</span>', sort: o => o.noOp },
        { label: 'Objek', cell: o => '<div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub">' + ui.esc(o.alamat) + '</div>', sort: o => o.nama },
        { label: 'Jenis pajak', cell: o => ui.esc(D.JENIS_BY[o.jenis].short), sort: o => o.jenis },
        { label: 'Wilayah', cell: o => ui.wilayah(o), sort: o => D.KEC_BY[o.kec].nama + D.desaName(o.kec, o.kel) },
        { label: 'Koordinat', cell: o => ui.bQ(D.effLoc(o).q), sort: o => D.effLoc(o).q },
        ...(D.can('payment.view') ? [{ label: 'Pembayaran ' + th, cell: o => ui.bBayar(o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA'), sort: o => D.bayar(o, th).status }] : []),
        { label: 'Status objek', cell: o => ui.bAktif(o), sort: o => o.aktif ? 0 : 1 },
        { label: '', cls: 'right', cell: o => '<span class="actions">' + (D.mapped(o) ? '<a class="btn btn--sm btn--ghost" href="#/peta?focus=' + o.idop + '" title="Lihat di peta">' + ui.icon('map') + '</a>' : '<button class="btn btn--sm btn--ghost" disabled title="Belum ada koordinat valid — lengkapi lewat Pendataan Koordinat">' + ui.icon('map') + '</button>') + (D.can('coordinate.propose') && !D.mapped(o) && !D.activeProposal(o.idop) ? '<a class="btn btn--sm btn--secondary" href="#/usulan/baru/' + o.idop + '">' + ui.icon('pin') + 'Data</a>' : '') + '</span>' }
      ]
    });
    function apply() {
      const q = F.q.toLowerCase();
      rows = D.scopedOps().filter(o => {
        if (F.kec && o.kec !== +F.kec) return false; if (F.kel && o.kel !== +F.kel) return false; if (F.jenis && o.jenis !== +F.jenis) return false; if (F.aktif && !o.aktif) return false;
        if (F.bayar && (o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') !== F.bayar) return false;
        if (F.koor) { const e = D.effLoc(o); if (F.koor === 'map' && e.lat == null) return false; if (F.koor === 'nomap' && e.lat != null) return false; if (D.KUALITAS[F.koor] && e.q !== F.koor) return false; }
        if (q && !(o.nama.toLowerCase().includes(q) || o.noOp.includes(q) || o.alamat.toLowerCase().includes(q) || (D.can('object.detail') && D.WP_BY[o.idwp].nama.toLowerCase().includes(q)))) return false;
        return true;
      });
      const a = D.aggregate(rows, th);
      ui.qs('#oStats', el).innerHTML = ui.stat({ label: 'Objek sesuai filter', value: ui.num(a.total), icon: 'building', meta: ui.num(a.aktif) + ' aktif' }) + ui.stat({ label: 'Tampil di peta', value: ui.num(a.mapped), icon: 'pin', tone: 'teal', bar: ui.pct(a.mapped, a.total), meta: ui.pct(a.mapped, a.total).toString().replace('.', ',') + '%' }) +
        ui.stat({ label: 'Belum terpetakan', value: ui.num(a.total - a.mapped), icon: 'alert', tone: 'amber', meta: D.can('coordinate.propose') ? '<a href="#/koordinat">Ke Pendataan Koordinat →</a>' : 'Kosong, invalid, atau perlu cek' }) +
        (D.can('payment.view') ? ui.stat({ label: 'Belum lunas ' + th, value: ui.num(a.bayar.BELUM_LUNAS), icon: 'alert', tone: 'red', meta: ui.num(a.bayar.TIDAK_TERSEDIA) + ' data belum tersedia (dipisahkan)' }) : '');
      tbl.rows = rows;
    }
    let t; ui.qs('#fQ', el).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value.trim(); apply(); }, 200); };
    ui.qs('#fKec', el).onchange = (e) => { F.kec = e.target.value; F.kel = ''; ui.qs('#fKel', el).innerHTML = ui.desaOptions(F.kec); apply(); };
    ui.qs('#fKel', el).onchange = (e) => { F.kel = e.target.value; apply(); };
    ui.qs('#fJ', el).onchange = (e) => { F.jenis = e.target.value; apply(); };
    const fb = ui.qs('#fB', el); if (fb) fb.onchange = (e) => { F.bayar = e.target.value; apply(); };
    ui.qs('#fK', el).onchange = (e) => { F.koor = e.target.value; apply(); };
    ui.qs('#fA', el).onchange = (e) => { F.aktif = e.target.checked; apply(); };
    const ex = ui.qs('#oExp', el); if (ex) ex.onclick = () => {
      const pii = false;
      ui.downloadCSV('objek-pajak-' + th + '.csv', [['No OP', 'Nama objek', 'Jenis pajak', 'Kecamatan', 'Desa', 'Alamat', 'Kualitas koordinat', 'Lintang', 'Bujur', 'Status bayar ' + th, 'Status objek', 'Wajib pajak (tersamar)']].concat(rows.map(o => { const e = D.effLoc(o); return [o.noOp, o.nama, D.JENIS_BY[o.jenis].nama, D.KEC_BY[o.kec].nama, D.desaName(o.kec, o.kel), o.alamat, D.KUALITAS[e.q].label, e.lat, e.lng, D.STATUS_BAYAR[o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA'].label, o.aktif ? 'Aktif' : 'Tutup', pii ? D.WP_BY[o.idwp].nama : ui.maskNama(D.WP_BY[o.idwp].nama)]; })));
      D.audit('objek.ekspor', 'Ekspor ' + rows.length + ' objek (CSV, PII tersamar)'); D.save(); ui.toast('Ekspor ' + ui.num(rows.length) + ' baris. Tercatat di audit log.');
    };
    apply();
  }

  function detail(el, id) {
    const o = D.OP_BY[id]; const th = D.state.tahun;
    if (!o || !D.inScope(o)) { el.innerHTML = '<div style="max-width:560px;margin:48px auto">' + ui.state({ tone: 'warning', icon: 'lock', title: 'Objek tidak ditemukan atau di luar wilayah Anda', desc: 'Server menolak permintaan untuk objek di luar cakupan wilayah (403/404), meskipun ID-nya valid.', action: '<a class="btn btn--primary" href="#/objek" style="margin-top:12px">Kembali</a>' }) + '</div>'; return; }
    if (!D.can('object.detail')) { el.innerHTML = App.forbidden(); return; }
    const wp = D.WP_BY[o.idwp], e = D.effLoc(o), ap = D.activeProposal(o.idop); const pc = D.parseCoord(o.latRaw, o.lngRaw);
    const props = D.state.proposals.filter(p => p.idop === o.idop).slice().reverse();
    const pii = D.can('taxpayer.pii');
    el.innerHTML = '<div class="pagehead"><div><a href="#/objek" class="t-sm">' + ui.icon('chevron-left') + ' Data objek pajak</a><div class="pagehead__title" style="margin-top:6px">' + ui.esc(o.nama) + '</div><div class="row wrap mt-s"><span class="t-mono t-sm">' + o.noOp + '</span>' + ui.bAktif(o) + ui.bQ(e.q) + (D.can('payment.view') ? ui.bBayar(o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') : '') + '</div></div><div class="pagehead__actions">' +
      (e.lat != null ? '<a class="btn btn--secondary" href="#/peta?focus=' + o.idop + '">' + ui.icon('map') + 'Lihat di peta</a><a class="btn btn--secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + e.lat + ',' + e.lng + '">' + ui.icon('route') + 'Rute</a>' : '<button class="btn btn--secondary" disabled title="Belum ada koordinat valid">' + ui.icon('map') + 'Lihat di peta</button>') +
      (D.can('coordinate.propose') ? (ap ? '<a class="btn btn--primary" href="#/usulan/' + ap.id + '">' + ui.icon('clock') + 'Usulan aktif ' + ap.id + '</a>' : '<a class="btn btn--primary" href="#/usulan/baru/' + o.idop + '">' + ui.icon('pin') + (e.lat != null ? 'Ajukan koreksi koordinat' : 'Ajukan koordinat') + '</a>') : '') + '</div></div>' +
      '<div class="grid12"><div class="c8x stack">' +
      '<div class="card"><div class="card__head"><div class="card__title">Identitas objek</div><span class="t-xs">Sumber: PBB.BSG_OP (baca-saja)</span></div><div class="card__body"><dl class="kv">' +
      '<dt>IDOP</dt><dd class="t-mono">' + o.idop + '</dd><dt>Jenis pajak</dt><dd>' + D.JENIS_BY[o.jenis].nama + ' <span class="cell-sub">(IDPAJAK ' + o.jenis + ')</span></dd><dt>Alamat</dt><dd>' + ui.esc(o.alamat) + ', RT ' + o.rt + '/RW ' + o.rw + '</dd><dt>Desa/kelurahan</dt><dd>' + ui.esc(D.desaName(o.kec, o.kel)) + ' <span class="cell-sub t-mono">33.28.' + String(o.kec).padStart(2, '0') + '.' + o.kel + '</span></dd><dt>Kecamatan</dt><dd>' + D.KEC_BY[o.kec].nama + '</dd>' +
      '<dt>Terdaftar</dt><dd>' + ui.date(o.created) + '</dd><dt>Status</dt><dd>' + (o.aktif ? 'Aktif' : 'Tutup sejak ' + ui.date(o.tglTutup)) + '</dd>' + (o.omzet ? '<dt>Perkiraan omzet</dt><dd>' + ui.rp(o.omzet) + '/bulan <span class="cell-sub">(simulasi)</span></dd>' : '') +
      '<dt>Penanggung jawab</dt><dd>' + ui.esc(o.pj) + '</dd><dt>HP penanggung jawab</dt><dd>' + ui.masked(o.hpPj, ui.maskHp(o.hpPj), 'hpPj:' + o.idop) + '</dd></dl></div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Wajib pajak</div>' + (D.can('taxpayer.view') ? '<a class="btn btn--sm btn--secondary" href="#/wp/' + wp.idwp + '">Buka data WP</a>' : '') + '</div><div class="card__body"><dl class="kv"><dt>Nama</dt><dd>' + ui.esc(wp.nama) + '</dd><dt>NPWPD</dt><dd class="t-mono">' + wp.npwpd + '</dd><dt>Jenis WP</dt><dd>' + wp.jenis + '</dd><dt>NIK/NIB</dt><dd>' + ui.masked(wp.nik, ui.maskNik(wp.nik), 'nik:' + wp.idwp) + '</dd></dl>' + (!pii ? '<p class="t-xs mt-s">' + ui.icon('lock') + ' Data pribadi disamarkan. Hanya role dengan izin <i>Buka data pribadi WP</i> yang dapat membukanya, dan setiap akses tercatat.</p>' : '') + '</div></div>' +
      (D.can('payment.view') ? '<div class="card"><div class="card__head"><div><div class="card__title">Riwayat pembayaran per periode</div><div class="card__sub">' + (D.state.cfg.paymentConnected ? 'Sumber: V_GIS_PEMBAYARAN (simulasi) · diperbarui ' + ui.ago(new Date(Date.now() - 8 * 60000)) : 'Sumber pembayaran belum terhubung') + '</div></div></div><div class="card__body" style="padding:0"><table class="data"><thead><tr><th>Periode</th><th>Status</th><th class="num">Ketetapan</th><th class="num">Dibayar</th><th>Tanggal bayar</th></tr></thead><tbody>' +
        D.TAHUN.slice().reverse().map(t => { const b = o.aktif || (o.tglTutup && t <= o.tglTutup.getFullYear()) ? D.bayar(o, t) : { status: 'TIDAK_TERSEDIA', alasan: 'Objek tutup' }; return '<tr><td>Tahun ' + t + '</td><td>' + ui.bBayar(b.status) + (b.alasan ? '<div class="cell-sub">' + ui.esc(b.alasan) + '</div>' : '') + '</td><td class="num">' + (b.ketetapan ? ui.rp(b.ketetapan) : '—') + '</td><td class="num">' + (b.ketetapan ? ui.rp(b.bayar) : '—') + '</td><td>' + (b.tgl ? ui.date(b.tgl) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>' : '') +
      '</div><div class="c4x stack">' +
      '<div class="card"><div class="card__head"><div><div class="card__title">Lokasi</div><div class="card__sub">' + ui.esc(e.sumber) + '</div></div></div><div class="card__body card__body--tight stack"><div class="minimap" id="oMap"></div>' +
      (e.lat == null ? '<div class="note note--warn">' + ui.icon('alert') + '<div>Objek <b>belum terpetakan</b>. Peta menampilkan batas desa terdaftar saja — titik tidak ditempatkan sembarangan.</div></div>' : '') +
      '<div class="cmpgrid"><div class="cmp"><div class="cmp__l">Dipakai GIS</div><div class="cmp__v">' + (e.lat != null ? ui.coord(e.lat) + '<br>' + ui.coord(e.lng) : '—') + '</div></div><div class="cmp"><div class="cmp__l">Master (MAP_LAT/LONG)</div><div class="cmp__v">' + (ui.esc(o.latRaw) || '<i>kosong</i>') + '<br>' + (ui.esc(o.lngRaw) || '<i>kosong</i>') + '</div></div></div>' +
      '<div class="t-xs">Klasifikasi master: ' + ui.bQ(o.q) + ' ' + ui.esc(pc.alasan || '') + '</div></div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">Riwayat usulan koordinat</div></div><div class="card__body">' + (props.length ? ui.timeline(props.map(p => ({ tone: p.status === 'DISETUJUI' ? 'done' : p.status === 'DITOLAK' ? 'danger' : 'current', icon: D.ST_USULAN[p.status].ikon, title: '<a href="#/usulan/' + p.id + '">' + p.id + '</a> ' + ui.bUsulan(p.status), time: ui.dateTime(p.submitted_at) + ' · ' + ui.esc(D.user(p.created_by).nama) }))) : '<p class="t-sm muted">Belum ada usulan.</p>') + '</div></div>' +
      '</div></div>';
    setTimeout(() => {
      const d = D.DESA_BY[o.kec + '-' + o.kel]; const map = M.mini(ui.qs('#oMap', el), { desa: d }); App.onLeave(() => map.remove());
      if (e.lat != null) { L.marker([e.lat, e.lng], { icon: M.pinIcon('teal') }).addTo(map); map.setView([e.lat, e.lng], 17); }
      if (o.q === 'PERLU_CEK' && o.mLat) L.marker([o.mLat, o.mLng], { icon: M.pinIcon('amber', 'master (perlu cek)') }).addTo(map);
    }, 20);
  }

  /* ---------------- Wajib Pajak ---------------- */
  App.page('wp', {
    title: (r) => r.params[0] ? 'Detail Wajib Pajak' : 'Data Wajib Pajak', crumb: 'Data Pokok', perm: 'taxpayer.view',
    render(el, r) {
      if (r.params[0]) return wpDetail(el, r.params[0]);
      const kecs = D.userKecs(); let q = '', kec = '';
      el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">Data wajib pajak</div><p class="pagehead__desc">Baca-saja dari <span class="t-mono">PBB.BSG_WP</span> (simulasi). NIK/NIB, nomor HP, email, dan tanggal lahir disamarkan secara default.</p></div></div>' +
        '<div class="filterbar mb"><div class="field" style="flex:2 1 260px"><label class="field__label" for="wQ">Pencarian</label><input class="input" id="wQ" type="search" placeholder="Nama WP atau NPWPD"></div><div class="field"><label class="field__label" for="wK">Kecamatan</label><select class="select" id="wK">' + ui.kecOptions('', kecs) + '</select></div></div><div id="wT"></div>';
      const tbl = ui.table(ui.qs('#wT', el), {
        rows: [], onRow: w => location.hash = '#/wp/' + w.idwp,
        cols: [
          { label: 'NPWPD', cell: w => '<span class="t-mono" style="font-size:12px">' + w.npwpd + '</span>', sort: w => w.npwpd },
          { label: 'Nama wajib pajak', cell: w => '<div class="cell-title">' + ui.esc(w.nama) + '</div><div class="cell-sub">' + w.jenis + '</div>', sort: w => w.nama },
          { label: 'Alamat', cell: w => ui.esc(w.alamat) + '<div class="cell-sub">' + ui.esc(D.desaName(w.kec, w.kel)) + ', ' + D.KEC_BY[w.kec].nama + '</div>' },
          { label: 'NIK/NIB', cell: w => '<span class="masked t-mono">' + ui.maskNik(w.nik) + '</span>' },
          { label: 'HP', cell: w => '<span class="masked t-mono">' + ui.maskHp(w.hp) + '</span>' },
          { label: 'Jumlah OP', cls: 'num', cell: w => w.ops.length, sort: w => w.ops.length },
          { label: 'Status', cell: w => w.aktif ? '<span class="badge badge--outline">Aktif</span>' : '<span class="badge badge--neutral">Nonaktif</span>' }
        ]
      });
      function apply() { const v = q.toLowerCase(); tbl.rows = D.WP.filter(w => w.ops.some(id => D.inScope(D.OP_BY[id])) && (!kec || w.kec === +kec) && (!v || w.nama.toLowerCase().includes(v) || w.npwpd.toLowerCase().includes(v))); }
      let t; ui.qs('#wQ', el).oninput = e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); apply(); }, 200); };
      ui.qs('#wK', el).onchange = e => { kec = e.target.value; apply(); };
      apply();
    }
  });
  function wpDetail(el, id) {
    const w = D.WP_BY[id]; if (!w || !w.ops.some(x => D.inScope(D.OP_BY[x]))) { el.innerHTML = ui.state({ tone: 'warning', icon: 'lock', title: 'Wajib pajak tidak ditemukan atau di luar wilayah Anda' }); return; }
    const th = D.state.tahun; const ops = w.ops.map(x => D.OP_BY[x]);
    el.innerHTML = '<div class="pagehead"><div><a href="#/wp" class="t-sm">' + ui.icon('chevron-left') + ' Data wajib pajak</a><div class="pagehead__title" style="margin-top:6px">' + ui.esc(w.nama) + '</div><div class="row wrap mt-s"><span class="t-mono t-sm">' + w.npwpd + '</span><span class="badge badge--navy">' + w.jenis + '</span>' + (w.aktif ? '<span class="badge badge--outline">Aktif</span>' : '<span class="badge badge--neutral">Nonaktif</span>') + '</div></div></div>' +
      '<div class="grid12"><div class="card c4x"><div class="card__head"><div class="card__title">Identitas</div></div><div class="card__body"><dl class="kv"><dt>Alamat</dt><dd>' + ui.esc(w.alamat) + ', RT ' + w.rt + '/RW ' + w.rw + '<div class="cell-sub">' + ui.esc(D.desaName(w.kec, w.kel)) + ', Kec. ' + D.KEC_BY[w.kec].nama + '</div></dd>' +
      '<dt>NIK/NIB</dt><dd>' + ui.masked(w.nik, ui.maskNik(w.nik), 'nik:' + w.idwp) + '</dd><dt>No. HP</dt><dd>' + ui.masked(w.hp, ui.maskHp(w.hp), 'hp:' + w.idwp) + '</dd><dt>Email</dt><dd>' + ui.masked(w.email, ui.maskEmail(w.email), 'email:' + w.idwp) + '</dd><dt>Terdaftar</dt><dd>' + ui.date(w.created) + '</dd></dl>' +
      (!D.can('taxpayer.pii') ? '<p class="t-xs mt">' + ui.icon('lock') + ' Role Anda tidak dapat membuka data pribadi.</p>' : '<p class="t-xs mt">' + ui.icon('shield') + ' Setiap “Tampilkan” dicatat di audit log.</p>') + '</div></div>' +
      '<div class="card c8x"><div class="card__head"><div><div class="card__title">Objek pajak milik WP (' + ops.length + ')</div><div class="card__sub">Status pembayaran Tahun ' + th + '</div></div></div><div class="card__body card__body--tight stack"><div class="minimap minimap--short" id="wMap"></div><div id="wOps"></div></div></div></div>';
    ui.table(ui.qs('#wOps', el), { rows: ops.filter(o => D.inScope(o)), onRow: o => location.hash = '#/objek/' + o.idop, cols: [{ label: 'Objek', cell: o => '<div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub t-mono">' + o.noOp + '</div>' }, { label: 'Jenis', cell: o => D.JENIS_BY[o.jenis].short }, { label: 'Wilayah', cell: o => ui.wilayah(o) }, { label: 'Koordinat', cell: o => ui.bQ(D.effLoc(o).q) }, { label: 'Bayar ' + th, cell: o => ui.bBayar(o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') }] });
    setTimeout(() => {
      const map = M.mini(ui.qs('#wMap', el), {}); App.onLeave(() => map.remove()); const pts = [];
      ops.forEach(o => { const e = D.effLoc(o); if (e.lat != null) { pts.push([e.lat, e.lng]); L.marker([e.lat, e.lng], { icon: M.icon(o.aktif ? D.bayar(o, th).status : 'TIDAK_TERSEDIA') }).bindTooltip(ui.esc(o.nama), { className: 'maptip' }).addTo(map); } });
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.5), { maxZoom: 16 });
    }, 20);
  }
})();
