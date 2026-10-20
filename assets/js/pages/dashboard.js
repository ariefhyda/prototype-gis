/* Dashboard spasial — isi menyesuaikan role */
(function () {
  const ui = UI;
  App.page('dashboard', {
    title: 'Dashboard', crumb: 'Pemantauan',
    render(el) {
      const u = D.me(), st = D.state, th = st.tahun;
      const ops = D.scopedOps(); const a = D.aggregate(ops, th);
      const kecs = D.userKecs();
      const wil = u.kec === 'all' ? 'seluruh Kabupaten Tegal' : kecs.length + ' kecamatan (' + kecs.map(k => D.KEC_BY[k].nama).join(', ') + ')';
      const usulanMenunggu = st.proposals.filter(p => p.status === 'DIAJUKAN' && kecs.includes(D.OP_BY[p.idop].kec)).length;
      const temuanMenunggu = st.candidates.filter(c => ['BARU', 'DALAM_VERIFIKASI', 'PERLU_KELENGKAPAN'].includes(c.status) && kecs.includes(c.kec)).length;
      const hello = { admin: 'Administrasi sistem', supervisor: 'Pengawasan pendataan', petugas: 'Kegiatan lapangan', viewer: 'Pemantauan pimpinan' }[u.role];

      let h = '<div class="pagehead"><div><div class="pagehead__title">Selamat bekerja, ' + ui.esc(u.nama.split(' ')[0]) + '</div><p class="pagehead__desc">' + hello + ' · cakupan ' + ui.esc(wil) + '. Status pembayaran mengacu pada <b>Tahun Pajak ' + th + '</b>.</p></div><div class="pagehead__actions">' + actions(u) + '</div></div>';
      if (!st.cfg.paymentConnected && D.can('payment.view')) h += '<div class="note note--warn mb">' + ui.icon('database') + '<div><b>Sumber data pembayaran belum terhubung.</b> Seluruh status ditampilkan “Data belum tersedia” — tidak dianggap belum lunas. ' + (D.can('admin.config') ? '<a href="#/pengaturan?tab=integrasi">Atur integrasi</a>' : '') + '</div></div>';

      if (u.role === 'admin') { el.innerHTML = h + adminDash(); wireAdmin(el); return; }

      h += '<div class="grid-stats">' +
        ui.stat({ label: 'Objek pajak terdata', value: ui.num(a.total), icon: 'building', meta: ui.num(a.aktif) + ' aktif · ' + ui.num(a.total - a.aktif) + ' tutup', href: D.can('object.view') ? '#/objek' : null }) +
        ui.stat({ label: 'Tampil di peta', value: ui.num(a.mapped), icon: 'pin', tone: 'teal', bar: ui.pct(a.mapped, a.total), meta: ui.pct(a.mapped, a.total).toString().replace('.', ',') + '% · ' + ui.num(a.gis) + ' dari verifikasi GIS', href: D.can('map.view') ? '#/peta' : null }) +
        ui.stat({ label: 'Belum terpetakan', value: ui.num(a.total - a.mapped), icon: 'alert', tone: 'amber', meta: ui.num(a.kosong) + ' kosong · ' + ui.num(a.invalid) + ' invalid · ' + ui.num(a.perluCek) + ' perlu cek', href: D.can('coordinate.propose') ? '#/koordinat' : null }) +
        ui.stat({ label: 'Menunggu verifikasi', value: ui.num(usulanMenunggu + temuanMenunggu), icon: 'clock', tone: 'grey', meta: usulanMenunggu + ' usulan koordinat · ' + temuanMenunggu + ' calon objek', href: D.can('verification.decide') ? '#/koordinat?tab=verif' : null }) +
        '</div>';

      if (u.role === 'petugas') h += petugasBlock(u);
      if (u.role === 'supervisor') h += supervisorBlock(u, kecs);

      h += '<div class="grid12">' +
        '<div class="card c8x"><div class="card__head"><div><div class="card__title">Peta tematik desa/kelurahan</div><div class="card__sub">Batas wilayah BIG · klik desa untuk profil</div></div><div class="segment" id="dsSeg"><button class="is-active" data-s="kelengkapan">Koordinat</button><button data-s="lunas">Lunas</button><button data-s="kepadatan">Kepadatan</button><button data-s="temuan">Temuan</button></div></div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="dashMap"></div><div id="dashLeg" class="row wrap mt-s t-xs"></div></div></div>' +
        '<div class="card c4x"><div class="card__head"><div><div class="card__title">Status pembayaran</div><div class="card__sub">Objek aktif · Tahun Pajak ' + th + '</div></div></div><div class="card__body">' +
        ui.donut([{ label: 'Lunas', value: a.bayar.LUNAS, color: '#21883C' }, { label: 'Bayar sebagian', value: a.bayar.SEBAGIAN, color: '#B77800' }, { label: 'Belum lunas', value: a.bayar.BELUM_LUNAS, color: '#C62828' }, { label: 'Data belum tersedia', value: a.bayar.TIDAK_TERSEDIA, color: '#9AA6B4' }], [ui.pct(a.bayar.LUNAS, a.aktif).toFixed(0) + '%', 'lunas']) +
        '<div class="hr"></div><div class="row-between t-sm"><span>Ketetapan</span><b>' + ui.rpShort(a.ketetapan) + '</b></div><div class="row-between t-sm mt-s"><span>Realisasi</span><b>' + ui.rpShort(a.realisasi) + '</b></div>' + ui.stack([{ label: 'Realisasi', value: a.realisasi, color: 'var(--success-600)' }, { label: 'Sisa', value: Math.max(0, a.ketetapan - a.realisasi), color: 'var(--danger-100)' }]) +
        '<p class="t-xs mt-s">“Data belum tersedia” dipisahkan dari “belum lunas” sesuai aturan R2.</p></div></div>' +
        '<div class="card c6"><div class="card__head"><div><div class="card__title">Kelengkapan koordinat per kecamatan</div><div class="card__sub">% objek yang tampil di peta</div></div></div><div class="card__body">' + kecBars(ops) + '</div></div>' +
        '<div class="card c6"><div class="card__head"><div><div class="card__title">Objek per jenis pajak</div><div class="card__sub">Dalam cakupan wilayah Anda</div></div></div><div class="card__body">' + ui.bars(D.JENIS.map(j => ({ label: j.short, value: ops.filter(o => o.jenis === j.id).length, color: 'var(--navy-600)' }))) + '</div></div>' +
        '<div class="card c12"><div class="card__head"><div><div class="card__title">Aktivitas terbaru</div><div class="card__sub">Usulan, temuan, dan keputusan verifikasi di wilayah Anda</div></div></div><div class="card__body">' + activity(kecs) + '</div></div>' +
        '</div>';
      el.innerHTML = h;
      ui.qsa('[data-href]', el).forEach(x => x.onclick = () => location.hash = x.dataset.href);
      setTimeout(() => thematic(el, kecs, th), 20);
    }
  });

  function actions(u) {
    if (u.role === 'petugas') return '<button class="btn btn--secondary install-only" data-install>' + ui.icon('smartphone') + 'Pasang aplikasi</button><a class="btn btn--primary" href="#/peta?near=1">' + ui.icon('target') + 'Objek di sekitar saya</a><a class="btn btn--secondary" href="#/peta?calon=1">' + ui.icon('plus') + 'Catat calon objek</a>';
    if (u.role === 'supervisor') return '<a class="btn btn--primary" href="#/koordinat?tab=verif">' + ui.icon('shield') + 'Antrean verifikasi</a><a class="btn btn--secondary" href="#/tugas?new=1">' + ui.icon('plus') + 'Buat penugasan</a>';
    if (u.role === 'viewer') return '<a class="btn btn--primary" href="#/peta">' + ui.icon('map') + 'Buka peta</a><a class="btn btn--secondary" href="#/laporan">' + ui.icon('chart') + 'Laporan</a>';
    return '<a class="btn btn--primary" href="#/akun">' + ui.icon('users') + 'Kelola akun</a><a class="btn btn--secondary" href="#/pengaturan">' + ui.icon('settings') + 'Pengaturan</a>';
  }

  function petugasBlock(u) {
    const st = D.state; const tugas = st.assignments.filter(t => t.petugas.includes(u.id) && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status));
    const kemb = st.proposals.filter(p => p.created_by === u.id && p.status === 'DIKEMBALIKAN');
    const kembC = st.candidates.filter(c => c.created_by === u.id && c.status === 'PERLU_KELENGKAPAN');
    const mine = st.proposals.filter(p => p.created_by === u.id);
    let h = '<div class="grid12 mb">';
    h += '<div class="card c8x"><div class="card__head"><div><div class="card__title">Tugas saya</div><div class="card__sub">' + tugas.length + ' penugasan aktif</div></div><a class="btn btn--sm btn--secondary" href="#/tugas">Semua tugas</a></div><div class="card__body stack">' +
      (tugas.length ? tugas.map(t => tugasRow(t)).join('') : ui.state({ icon: 'clipboard', title: 'Tidak ada penugasan aktif', desc: 'Anda tetap dapat melengkapi koordinat di wilayah Anda.' })) + '</div></div>';
    h += '<div class="card c4x"><div class="card__head"><div><div class="card__title">Perlu Anda perbaiki</div><div class="card__sub">Dikembalikan supervisor</div></div></div><div class="card__body stack">' +
      (kemb.length + kembC.length ? kemb.map(p => '<a class="notif is-unread" href="#/usulan/' + p.id + '"><div class="notif__t">' + ui.esc(D.OP_BY[p.idop].nama) + '</div><div class="t-xs">Usulan koordinat · ' + ui.ago(p.submitted_at) + '</div></a>').join('') + kembC.map(c => '<a class="notif is-unread" href="#/calon/' + c.id + '"><div class="notif__t">' + ui.esc(c.nama) + '</div><div class="t-xs">Calon objek · perlu kelengkapan</div></a>').join('') : '<div class="note note--ok">' + ui.icon('check-circle') + '<div>Tidak ada pengajuan yang dikembalikan.</div></div>') +
      '<div class="hr"></div><div class="row-between t-sm"><span>Usulan saya</span><b>' + mine.length + '</b></div><div class="row-between t-sm"><span>Disetujui</span><b>' + mine.filter(p => p.status === 'DISETUJUI').length + '</b></div><div class="row-between t-sm"><span>Menunggu</span><b>' + mine.filter(p => p.status === 'DIAJUKAN').length + '</b></div></div></div>';
    return h + '</div>';
  }
  function tugasRow(t) {
    const done = t.targets.filter(x => x.status !== 'BELUM').length; const late = new Date(t.tenggat) < D.TODAY;
    return '<a class="card card__body--tight statlink" style="display:block" href="#/tugas/' + t.id + '"><div class="row-between"><div><div style="font-weight:700">' + ui.esc(t.judul) + '</div><div class="t-xs">' + t.id + ' · tenggat ' + ui.date(t.tenggat) + (late ? ' · <span style="color:var(--danger-700);font-weight:700">lewat tenggat</span>' : '') + '</div></div>' + ui.bTugas(t.status) + '</div>' +
      '<div class="row mt-s" style="gap:10px"><div class="grow">' + ui.stack([{ label: 'Selesai', value: done, color: 'var(--teal-600)' }, { label: 'Sisa', value: t.targets.length - done, color: 'var(--bg-sunken)' }], t.targets.length) + '</div><span class="t-xs nowrap">' + done + '/' + t.targets.length + ' objek</span></div></a>';
  }
  function supervisorBlock(u, kecs) {
    const st = D.state;
    const q1 = st.proposals.filter(p => p.status === 'DIAJUKAN' && kecs.includes(D.OP_BY[p.idop].kec)).sort((a, b) => a.submitted_at < b.submitted_at ? -1 : 1);
    const q2 = st.candidates.filter(c => ['BARU', 'DALAM_VERIFIKASI'].includes(c.status) && kecs.includes(c.kec));
    const tugas = st.assignments.filter(t => t.created_by === u.id && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status));
    return '<div class="grid12 mb"><div class="card c8x"><div class="card__head"><div><div class="card__title">Antrean verifikasi</div><div class="card__sub">Diurutkan dari pengajuan paling lama</div></div><a class="btn btn--sm btn--primary" href="#/koordinat?tab=verif">Buka antrean</a></div><div class="card__body" style="padding:0">' +
      '<table class="data"><thead><tr><th>Jenis</th><th>Objek / temuan</th><th>Petugas</th><th>Diajukan</th><th></th></tr></thead><tbody>' +
      q1.slice(0, 5).map(p => { const o = D.OP_BY[p.idop]; return '<tr><td>' + ui.badge({ label: 'Koordinat', badge: 'badge--info', ikon: 'pin' }) + '</td><td><div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub">' + ui.esc(D.desaName(o.kec, o.kel)) + ', ' + D.KEC_BY[o.kec].nama + '</div></td><td>' + ui.esc(D.user(p.created_by).nama) + '</td><td>' + ui.ago(p.submitted_at) + '</td><td><a class="btn btn--sm btn--secondary" href="#/usulan/' + p.id + '">Periksa</a></td></tr>'; }).join('') +
      q2.slice(0, 3).map(c => '<tr><td>' + ui.badge({ label: 'Calon objek', badge: 'badge--warning', ikon: 'plus' }) + '</td><td><div class="cell-title">' + ui.esc(c.nama) + '</div><div class="cell-sub">' + c.id + ' · ' + ui.esc(D.desaName(c.kec, c.kel)) + '</div></td><td>' + ui.esc(D.user(c.created_by).nama) + '</td><td>' + ui.ago(c.created_at) + '</td><td><a class="btn btn--sm btn--secondary" href="#/calon/' + c.id + '">Periksa</a></td></tr>').join('') +
      (q1.length + q2.length ? '' : '<tr><td colspan="5">' + ui.state({ icon: 'check-circle', title: 'Antrean kosong', desc: 'Semua pengajuan sudah diputuskan.' }) + '</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card c4x"><div class="card__head"><div><div class="card__title">Penugasan aktif</div><div class="card__sub">' + tugas.length + ' penugasan</div></div><a class="btn btn--sm btn--secondary" href="#/tugas">Kelola</a></div><div class="card__body stack">' + (tugas.length ? tugas.map(tugasRow).join('') : '<p class="t-sm">Belum ada penugasan aktif.</p>') + '</div></div></div>';
  }
  function kecBars(ops) {
    const by = {}; ops.forEach(o => { (by[o.kec] = by[o.kec] || { t: 0, m: 0 }).t++; if (D.mapped(o)) by[o.kec].m++; });
    const rows = Object.keys(by).map(k => ({ label: D.KEC_BY[k].nama, value: Math.round(by[k].m / by[k].t * 100), color: M.colorFor('kelengkapan', by[k].m / by[k].t * 100) === '#5DB57A' ? '#21883C' : by[k].m / by[k].t < 0.55 ? '#C62828' : '#087F8C', href: '#/wilayah/' + k })).sort((a, b) => a.value - b.value);
    return ui.bars(rows, { fmt: v => v + '%' });
  }
  function activity(kecs) {
    const st = D.state; const items = [];
    st.proposals.filter(p => kecs.includes(D.OP_BY[p.idop].kec)).forEach(p => items.push({ at: p.submitted_at, t: '<b>' + ui.esc(D.user(p.created_by).nama) + '</b> mengajukan koordinat ' + ui.esc(D.OP_BY[p.idop].nama), href: '#/usulan/' + p.id, b: ui.bUsulan(p.status) }));
    st.candidates.filter(c => kecs.includes(c.kec)).forEach(c => items.push({ at: c.created_at, t: '<b>' + ui.esc(D.user(c.created_by).nama) + '</b> mencatat calon objek ' + ui.esc(c.nama), href: '#/calon/' + c.id, b: ui.bCalon(c.status) }));
    st.verifications.forEach(v => {
      const kec = v.target === 'proposal' ? (st.proposals.find(p => p.id === v.tid) ? D.OP_BY[st.proposals.find(p => p.id === v.tid).idop].kec : 0) : ((st.candidates.find(c => c.id === v.tid) || {}).kec);
      if (!kecs.includes(kec)) return;
      items.push({ at: v.at, t: '<b>' + ui.esc(D.user(v.by).nama) + '</b> memutuskan ' + (v.target === 'proposal' ? 'usulan ' : 'temuan ') + v.tid, href: v.target === 'proposal' ? '#/usulan/' + v.tid : '#/calon/' + v.tid, b: v.target === 'proposal' ? ui.bUsulan(v.keputusan) : ui.bCalon(v.keputusan) });
    });
    items.sort((a, b) => a.at < b.at ? 1 : -1);
    const can = D.can('coordinate.propose') || D.can('verification.decide');
    return '<div class="nearlist">' + items.slice(0, 8).map(i => '<' + (can ? 'a href="' + i.href + '"' : 'div') + ' class="nearit statlink"><span class="stat__icon stat__icon--teal">' + ui.icon('activity') + '</span><div class="grow"><div class="t-sm" style="color:var(--text-primary)">' + i.t + '</div><div class="t-xs">' + ui.ago(i.at) + '</div></div>' + i.b + '</' + (can ? 'a' : 'div') + '>').join('') + '</div>';
  }
  function thematic(el, kecs, th) {
    const host = ui.qs('#dashMap', el); if (!host) return;
    const map = M.create(host, { base: 'light' }); App.onLeave(() => map.remove());
    const stats = M.desaStats(th); let scale = 'kelengkapan'; let lay;
    function draw() {
      if (lay) map.removeLayer(lay);
      lay = M.desaLayer(map, {
        filter: f => kecs.includes(f.properties.kec),
        style: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return { fillColor: M.colorFor(scale, M.scaleValue(scale, stats[d.id], d)), fillOpacity: 0.78, color: '#fff', weight: 0.8 }; },
        tooltip: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; const s = stats[d.id]; return '<b>' + d.tipe + ' ' + ui.esc(d.nama) + '</b><br>Kec. ' + ui.esc(d.kecNama) + '<br>' + M.SC[scale].nama + ': <b>' + M.SC[scale].fmt(M.scaleValue(scale, s, d)) + '</b><br><span class="t-xs">' + s.total + ' objek · ' + s.mapped + ' terpetakan</span>'; },
        onClick: f => location.hash = '#/wilayah/' + f.properties.kec + '/' + f.properties.kel
      });
      ui.qs('#dashLeg', el).innerHTML = '<b>' + M.SC[scale].nama + ':</b> ' + M.SC[scale].stops.map((x, i) => '<span class="row" style="gap:4px"><span class="chosw" style="background:' + x[1] + '"></span>' + (i < M.SC[scale].stops.length - 1 ? M.SC[scale].fmt(x[0]) + '–' + M.SC[scale].fmt(M.SC[scale].stops[i + 1][0]) : '≥' + M.SC[scale].fmt(x[0])) + '</span>').join('');
    }
    draw();
    M.kecLayer(map, { tooltip: false, hover: false, style: () => ({ color: '#0E2338', weight: 1.4 }) });
    M.kecLabels(map, kecs); M.scopeShade(map, kecs);
    if (kecs.length < D.KEC.length) { const b = L.geoJSON({ type: 'FeatureCollection', features: D.GEO.kecamatan.features.filter(f => kecs.includes(f.properties.kec)) }).getBounds(); map.fitBounds(b, { padding: [10, 10] }); }
    ui.qsa('#dsSeg button', el).forEach(b => b.onclick = () => { ui.qsa('#dsSeg button', el).forEach(x => x.classList.toggle('is-active', x === b)); scale = b.dataset.s; draw(); });
  }

  function adminDash() {
    const st = D.state; const byRole = {}; st.users.forEach(u => byRole[u.role] = (byRole[u.role] || 0) + 1);
    const q = { VALID: 0, PERLU_CEK: 0, INVALID: 0, KOSONG: 0 }; D.OP.forEach(o => q[o.q]++);
    const job = st.jobs[st.jobs.length - 1];
    return '<div class="grid-stats">' +
      ui.stat({ label: 'Akun aktif', value: st.users.filter(u => u.aktif).length, icon: 'users', meta: Object.keys(D.ROLES).map(r => (byRole[r] || 0) + ' ' + D.ROLES[r].nama.split(' /')[0].toLowerCase()).join(' · '), href: '#/akun' }) +
      ui.stat({ label: 'Integrasi pembayaran', value: st.cfg.paymentConnected ? 'Terhubung' : 'Belum', icon: 'database', tone: st.cfg.paymentConnected ? 'green' : 'amber', meta: st.cfg.paymentConnected ? 'Provider: V_GIS_PEMBAYARAN (simulasi)' : 'NullPaymentProvider aktif', href: '#/pengaturan?tab=integrasi' }) +
      ui.stat({ label: 'Job kualitas koordinat', value: job ? ui.ago(job.at) : '—', icon: 'refresh', tone: 'teal', meta: job ? job.status + ' · ' + job.proses : '', href: '#/pengaturan?tab=kualitas' }) +
      ui.stat({ label: 'Catatan audit', value: ui.num(st.audit.length), icon: 'activity', tone: 'grey', meta: 'Tidak dapat diubah atau dihapus', href: '#/audit' }) + '</div>' +
      '<div class="grid12"><div class="card c6"><div class="card__head"><div><div class="card__title">Kualitas koordinat master BSG_OP</div><div class="card__sub">Hasil klasifikasi terakhir · tidak mengubah master</div></div></div><div class="card__body">' +
      ui.donut([{ label: 'Valid', value: q.VALID, color: '#21883C' }, { label: 'Perlu cek', value: q.PERLU_CEK, color: '#B77800' }, { label: 'Invalid', value: q.INVALID, color: '#C62828' }, { label: 'Kosong', value: q.KOSONG, color: '#9AA6B4' }], [ui.pct(q.VALID, D.OP.length).toFixed(0) + '%', 'valid']) + '</div></div>' +
      '<div class="card c6"><div class="card__head"><div><div class="card__title">Aktivitas sistem terbaru</div></div><a class="btn btn--sm btn--secondary" href="#/audit">Audit log</a></div><div class="card__body"><div class="nearlist">' +
      st.audit.slice().reverse().slice(0, 7).map(x => '<div class="nearit"><span class="stat__icon stat__icon--grey">' + ui.icon('activity') + '</span><div class="grow"><div class="t-sm" style="color:var(--text-primary)"><b>' + ui.esc(D.user(x.user).nama) + '</b> — ' + ui.esc(x.ket) + '</div><div class="t-xs">' + ui.esc(x.aksi) + ' · ' + ui.ago(x.at) + '</div></div></div>').join('') + '</div></div></div>' +
      '<div class="card c12"><div class="card__head"><div><div class="card__title">Cakupan wilayah per pengguna</div><div class="card__sub">Batas kecamatan BIG · warna = supervisor penanggung jawab</div></div></div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="admMap"></div></div></div></div>';
  }
  function wireAdmin(el) {
    setTimeout(() => {
      const map = M.create(ui.qs('#admMap', el), { base: 'light' }); App.onLeave(() => map.remove());
      const col = { u2: '#0A97A6', u3: '#B77800' };
      M.kecLayer(map, {
        style: f => { const s = D.state.users.find(u => u.role === 'supervisor' && u.kec !== 'all' && u.kec.includes(f.properties.kec)); return { fillColor: s ? col[s.id] || '#526277' : '#ccc', fillOpacity: 0.35, color: '#0E2338', weight: 1.2 }; },
        tooltip: f => { const us = D.state.users.filter(u => u.kec !== 'all' && u.kec.includes(f.properties.kec)); return '<b>Kec. ' + ui.esc(f.properties.nama) + '</b><br>' + (us.map(u => ui.esc(u.nama) + ' <span class="t-xs">(' + D.ROLES[u.role].nama.split(' /')[0] + ')</span>').join('<br>') || '<i>belum ada pengguna</i>'); }
      });
      M.kecLabels(map);
    }, 20);
  }
})();
