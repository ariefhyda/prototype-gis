/* Penugasan Survei (GIS-F07) & Penerusan Hasil (GIS-F11) */
(function () {
  const ui = UI;
  const ST_TARGET = { BELUM: { label: 'Belum disurvei', badge: 'badge--neutral', ikon: 'clock' }, DIAJUKAN: { label: 'Diajukan', badge: 'badge--info', ikon: 'send' }, DIKEMBALIKAN: { label: 'Dikembalikan', badge: 'badge--warning', ikon: 'refresh' }, DISETUJUI: { label: 'Disetujui', badge: 'badge--success', ikon: 'check-circle' }, DITOLAK: { label: 'Ditolak', badge: 'badge--danger', ikon: 'x' }, TIDAK_DITEMUKAN: { label: 'Tidak ditemukan', badge: 'badge--neutral', ikon: 'help' } };
  function progress(t) { const done = t.targets.filter(x => x.status !== 'BELUM').length; return { done, total: t.targets.length, ok: t.targets.filter(x => x.status === 'DISETUJUI').length, pct: t.targets.length ? Math.round(done / t.targets.length * 100) : 0 }; }

  App.page('tugas', {
    title: (r) => r.params[0] ? 'Penugasan ' + r.params[0] : (D.can('assignment.manage') ? 'Penugasan Survei' : 'Tugas Saya'), crumb: 'Pendataan Lapangan', perm: ['assignment.manage', 'assignment.own'],
    render(el, r) {
      if (r.params[0]) return detail(el, r.params[0]);
      const u = D.me(), mgr = D.can('assignment.manage');
      const list = D.state.assignments.filter(t => mgr ? (t.created_by === u.id || D.userKecs().some(k => t.targets.some(x => D.OP_BY[x.idop].kec === k))) : t.petugas.includes(u.id)).slice().reverse();
      el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">' + (mgr ? 'Penugasan survei' : 'Tugas saya') + '</div><p class="pagehead__desc">' + (mgr ? 'Tetapkan petugas, sasaran objek/wilayah, instruksi, dan tenggat. Progres dihitung otomatis dari usulan dan temuan yang dikaitkan.' : 'Penugasan dari supervisor. Buka tugas untuk melihat peta sasaran dan mengajukan koordinat per objek.') + '</p></div><div class="pagehead__actions">' + (mgr ? '<button class="btn btn--primary" id="tNew">' + ui.icon('plus') + 'Buat penugasan</button>' : '') + '</div></div><div id="tT"></div>';
      ui.table(ui.qs('#tT', el), {
        rows: list, onRow: t => location.hash = '#/tugas/' + t.id,
        empty: ui.state({ icon: 'clipboard', title: 'Belum ada penugasan', desc: mgr ? 'Buat penugasan untuk mengarahkan survei lapangan.' : 'Anda belum menerima penugasan.' }),
        cols: [
          { label: 'ID', cell: t => '<span class="t-mono">' + t.id + '</span>' },
          { label: 'Judul', cell: t => '<div class="cell-title">' + ui.esc(t.judul) + '</div><div class="cell-sub">Prioritas ' + t.prioritas + '</div>' },
          { label: 'Petugas', cell: t => t.petugas.map(p => ui.esc(D.user(p).nama)).join(', ') },
          { label: 'Progres', cell: t => { const p = progress(t); return '<div style="min-width:140px">' + ui.stack([{ label: 'Disetujui', value: p.ok, color: 'var(--success-600)' }, { label: 'Diproses', value: p.done - p.ok, color: 'var(--teal-500)' }, { label: 'Sisa', value: p.total - p.done, color: 'var(--bg-sunken)' }], p.total) + '<div class="cell-sub">' + p.done + '/' + p.total + ' tersurvei · ' + p.ok + ' disetujui</div></div>'; } },
          { label: 'Tenggat', cell: t => { const late = new Date(t.tenggat) < D.TODAY && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status); return ui.date(t.tenggat) + (late ? '<div class="cell-sub" style="color:var(--danger-700);font-weight:700">Lewat tenggat</div>' : ''); }, sort: t => t.tenggat },
          { label: 'Status', cell: t => ui.bTugas(t.status) }
        ]
      });
      const nb = ui.qs('#tNew', el); if (nb) { nb.onclick = () => createModal(); if (r.q.new) setTimeout(createModal, 50); }
    }
  });

  function createModal() {
    const u = D.me(), kecs = D.userKecs(); const petugas = D.state.users.filter(x => x.role === 'petugas' && x.aktif && x.kec.some(k => kecs.includes(k)));
    let sel = new Set();
    ui.modal({
      title: 'Buat penugasan survei', wide: true, sub: 'Sasaran dipilih per desa (batas BIG) lalu disaring otomatis ke objek yang perlu disurvei.',
      body: '<div class="grid2"><div class="field"><label class="field__label" for="nJ">Judul *</label><input class="input" id="nJ" placeholder="mis. Lengkapi koordinat Desa …"></div><div class="field"><label class="field__label" for="nP">Petugas *</label><select class="select" id="nP">' + petugas.map(p => '<option value="' + p.id + '">' + ui.esc(p.nama) + ' — ' + p.kec.map(k => D.KEC_BY[k].nama).join(', ') + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="field__label" for="nK">Kecamatan sasaran</label><select class="select" id="nK">' + ui.kecOptions('', kecs, false) + '</select></div><div class="field"><label class="field__label" for="nD">Desa/kelurahan</label><select class="select" id="nD"></select></div>' +
        '<div class="field"><label class="field__label" for="nC">Kriteria objek</label><select class="select" id="nC"><option value="nomap">Belum terpetakan (kosong/invalid/perlu cek)</option><option value="kosong">Tanpa koordinat saja</option><option value="all">Semua objek aktif (pemutakhiran)</option></select></div><div class="field"><label class="field__label" for="nJn">Jenis pajak</label><select class="select" id="nJn">' + ui.jenisOptions('') + '</select></div>' +
        '<div class="field"><label class="field__label" for="nT">Tenggat *</label><input class="input" id="nT" type="date" value="' + new Date(D.TODAY.getTime() + 10 * 864e5).toISOString().slice(0, 10) + '"></div><div class="field"><label class="field__label" for="nPr">Prioritas</label><select class="select" id="nPr"><option>Tinggi</option><option selected>Sedang</option><option>Rendah</option></select></div></div>' +
        '<div class="field mt"><label class="field__label" for="nI">Instruksi</label><textarea class="textarea" id="nI" rows="2"></textarea></div>' +
        '<div class="grid2 mt"><div class="minimap" id="nMap"></div><div><div class="mapside__ttl">Sasaran terpilih <span id="nCnt" class="pill-n">0</span></div><div id="nList" style="max-height:220px;overflow:auto"></div></div></div><div class="field__error" id="nErr" hidden></div>',
      foot: '<button class="btn btn--secondary" data-close>Batal</button><button class="btn btn--primary" id="nOk">' + ui.icon('send') + 'Tugaskan</button>',
      onOpen: m => {
        const kS = ui.qs('#nK', m), dS = ui.qs('#nD', m); let map, lay;
        const fillDesa = () => { dS.innerHTML = ui.desaOptions(kS.value).replace('Semua desa/kelurahan', 'Seluruh kecamatan'); };
        const calc = () => {
          const crit = ui.qs('#nC', m).value, jn = ui.qs('#nJn', m).value;
          const ops = D.OP.filter(o => o.aktif && o.kec === +kS.value && (!dS.value || o.kel === +dS.value) && (!jn || o.jenis === +jn) && !D.activeProposal(o.idop) && (crit === 'all' || (crit === 'kosong' ? o.q === 'KOSONG' && !D.mapped(o) : !D.mapped(o))));
          sel = new Set(ops.map(o => o.idop));
          ui.qs('#nCnt', m).textContent = sel.size;
          ui.qs('#nList', m).innerHTML = ops.slice(0, 80).map(o => '<div class="t-sm" style="padding:4px 0;border-bottom:1px solid var(--border-default)">' + ui.esc(o.nama) + ' <span class="t-xs">· ' + ui.esc(D.desaName(o.kec, o.kel)) + ' · ' + D.KUALITAS[D.effLoc(o).q].short + '</span></div>').join('') + (ops.length > 80 ? '<div class="t-xs">… dan ' + (ops.length - 80) + ' lainnya</div>' : '') || '<p class="t-sm muted">Tidak ada objek sesuai kriteria.</p>';
          if (map) { if (lay) map.removeLayer(lay); const f = D.GEO.desa.features.filter(x => x.properties.kec === +kS.value && (!dS.value || x.properties.kel === +dS.value)); lay = L.geoJSON({ type: 'FeatureCollection', features: f }, { style: { color: '#087F8C', weight: 2, fillOpacity: 0.12 } }).addTo(map); map.fitBounds(lay.getBounds()); }
          if (!ui.qs('#nJ', m).dataset.touched) ui.qs('#nJ', m).value = 'Survei ' + (dS.value ? D.desaName(+kS.value, +dS.value) : 'Kec. ' + D.KEC_BY[kS.value].nama);
        };
        ui.qs('#nJ', m).oninput = (e) => e.target.dataset.touched = 1;
        kS.onchange = () => { fillDesa(); calc(); }; dS.onchange = calc; ui.qs('#nC', m).onchange = calc; ui.qs('#nJn', m).onchange = calc;
        fillDesa(); setTimeout(() => { map = M.mini(ui.qs('#nMap', m), {}); calc(); }, 60);
        ui.qs('#nOk', m).onclick = () => {
          const err = ui.qs('#nErr', m); if (!sel.size) { err.textContent = 'Tidak ada objek sasaran.'; err.hidden = false; return; }
          const t = D.newTugas({ judul: ui.qs('#nJ', m).value.trim() || 'Penugasan survei', instruksi: ui.qs('#nI', m).value.trim(), petugas: [ui.qs('#nP', m).value], tenggat: new Date(ui.qs('#nT', m).value).toISOString(), prioritas: ui.qs('#nPr', m).value, status: 'DITUGASKAN', created_by: u.id, created_at: new Date().toISOString() }, [...sel]);
          D.notify(t.petugas[0], 'Penugasan baru', t.judul + ' · ' + sel.size + ' objek · tenggat ' + ui.date(t.tenggat), '#/tugas/' + t.id);
          D.audit('tugas.buat', 'Membuat penugasan ' + t.id + ' (' + sel.size + ' objek)', t.id); D.save(); if (map) map.remove(); ui.closeModal(); location.hash = '#/tugas/' + t.id; ui.toast('Penugasan ' + t.id + ' dikirim ke ' + ui.esc(D.user(t.petugas[0]).nama) + '.');
        };
      }
    });
  }

  function detail(el, id) {
    const t = D.state.assignments.find(x => x.id === id); const u = D.me(); const mgr = D.can('assignment.manage');
    if (!t || (!mgr && !t.petugas.includes(u.id))) { el.innerHTML = App.forbidden(); return; }
    const p = progress(t); const late = new Date(t.tenggat) < D.TODAY && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status);
    const isPetugas = t.petugas.includes(u.id);
    el.innerHTML = '<div class="pagehead"><div><a href="#/tugas" class="t-sm">' + ui.icon('chevron-left') + ' ' + (mgr ? 'Penugasan survei' : 'Tugas saya') + '</a><div class="pagehead__title" style="margin-top:6px">' + ui.esc(t.judul) + '</div><div class="row wrap mt-s"><span class="t-mono t-sm">' + t.id + '</span>' + ui.bTugas(t.status) + '<span class="badge badge--outline">Prioritas ' + t.prioritas + '</span>' + (late ? '<span class="badge badge--danger">' + ui.icon('clock') + '<span>Lewat tenggat</span></span>' : '') + '</div></div><div class="pagehead__actions">' +
      (mgr && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status) ? '<button class="btn btn--primary" id="tDone">' + ui.icon('check') + 'Tutup sebagai selesai</button><button class="btn btn--secondary" id="tCancel">Batalkan</button>' : '') + '</div></div>' +
      '<div class="grid-stats">' + ui.stat({ label: 'Sasaran', value: p.total, icon: 'building' }) + ui.stat({ label: 'Tersurvei', value: p.done, icon: 'send', tone: 'teal', bar: p.pct, meta: p.pct + '%' }) + ui.stat({ label: 'Disetujui', value: p.ok, icon: 'check-circle', tone: 'green' }) + ui.stat({ label: 'Tenggat', value: ui.date(t.tenggat), icon: 'calendar', tone: late ? 'red' : 'grey', meta: 'Petugas: ' + t.petugas.map(x => ui.esc(D.user(x).nama)).join(', ') }) + '</div>' +
      (t.instruksi ? '<div class="note mb">' + ui.icon('note') + '<div><b>Instruksi:</b> ' + ui.esc(t.instruksi) + '</div></div>' : '') +
      '<div class="grid12"><div class="c4x"><div class="card"><div class="card__head"><div class="card__title">Peta sasaran</div></div><div class="card__body card__body--tight"><div class="minimap minimap--tall" id="tMap"></div><p class="t-xs mt-s">Objek tanpa koordinat ditandai pada pusat desanya (abu-abu) hanya sebagai petunjuk area, bukan lokasi objek.</p></div></div></div><div class="c8x" id="tTg"></div></div>';
    ui.table(ui.qs('#tTg', el), {
      rows: t.targets, pageSize: 15,
      cols: [
        { label: 'Objek', cell: x => { const o = D.OP_BY[x.idop]; return '<div class="cell-title">' + ui.esc(o.nama) + '</div><div class="cell-sub">' + ui.esc(o.alamat) + ' · ' + ui.esc(D.desaName(o.kec, o.kel)) + '</div>'; } },
        { label: 'Kondisi', cell: x => ui.bQ(D.effLoc(D.OP_BY[x.idop]).q) },
        { label: 'Status survei', cell: x => ui.badge(ST_TARGET[x.status]) },
        { label: '', cls: 'right', cell: x => { const ap = D.activeProposal(x.idop) || D.state.proposals.filter(p => p.idop === x.idop).pop(); return '<span class="actions">' + (ap ? '<a class="btn btn--sm btn--ghost" href="#/usulan/' + ap.id + '">' + ap.id + '</a>' : '') + (isPetugas && ['BELUM', 'TIDAK_DITEMUKAN'].includes(x.status) && !D.activeProposal(x.idop) ? '<a class="btn btn--sm btn--primary" href="#/usulan/baru/' + x.idop + '">' + ui.icon('pin') + 'Ajukan</a><button class="btn btn--sm btn--secondary" data-nf="' + x.idop + '" title="Tandai tidak ditemukan">' + ui.icon('help') + '</button>' : '') + '</span>'; } }
      ],
      after: host => ui.qsa('[data-nf]', host).forEach(b => b.onclick = () => ui.prompt({ title: 'Tandai tidak ditemukan di lapangan', label: 'Catatan', required: true, placeholder: 'mis. bangunan kosong, usaha sudah pindah', okLabel: 'Simpan', onOk: (note) => { const tg = t.targets.find(x => x.idop === b.dataset.nf); tg.status = 'TIDAK_DITEMUKAN'; tg.catatan = note; if (t.status === 'DITUGASKAN') t.status = 'DIKERJAKAN'; D.audit('tugas.tidakditemukan', 'Objek ' + D.OP_BY[tg.idop].noOp + ' tidak ditemukan (' + t.id + ')', t.id); D.save(); App.rerender(); } }))
    });
    setTimeout(() => {
      const map = M.mini(ui.qs('#tMap', el), {}); App.onLeave(() => map.remove()); const pts = [];
      const desas = new Set(t.targets.map(x => { const o = D.OP_BY[x.idop]; return o.kec + '-' + o.kel; }));
      const lay = L.geoJSON({ type: 'FeatureCollection', features: D.GEO.desa.features.filter(f => desas.has(f.properties.kec + '-' + f.properties.kel)) }, { style: { color: '#087F8C', weight: 2, fillOpacity: 0.08 } }).addTo(map);
      t.targets.forEach(x => { const o = D.OP_BY[x.idop]; const e = D.effLoc(o); const pr = D.state.proposals.filter(p => p.idop === o.idop && ['DIAJUKAN', 'DISETUJUI'].includes(p.status)).pop(); const pt = e.lat != null ? [e.lat, e.lng] : pr ? [pr.lat, pr.lng] : null; if (pt) { pts.push(pt); L.marker(pt, { icon: M.icon(x.status === 'DISETUJUI' ? 'LUNAS' : 'USULAN') }).bindTooltip(ui.esc(o.nama), { className: 'maptip' }).addTo(map); } });
      map.fitBounds(lay.getBounds(), { padding: [10, 10] });
    }, 20);
    const dn = ui.qs('#tDone', el); if (dn) dn.onclick = () => ui.confirm({ title: 'Tutup penugasan?', sub: p.total - p.done + ' objek belum tersurvei.', okLabel: 'Tutup', onOk: () => { t.status = 'SELESAI'; D.audit('tugas.selesai', 'Menutup ' + t.id, t.id); D.save(); App.rerender(); } });
    const cn = ui.qs('#tCancel', el); if (cn) cn.onclick = () => ui.prompt({ title: 'Batalkan penugasan', label: 'Alasan', required: true, danger: true, okLabel: 'Batalkan', onOk: (a) => { t.status = 'DIBATALKAN'; t.alasanBatal = a; D.audit('tugas.batal', 'Membatalkan ' + t.id + ': ' + a, t.id); D.save(); App.rerender(); } });
  }

  /* ================= Penerusan ================= */
  App.page('penerusan', {
    title: 'Penerusan Hasil Verifikasi', crumb: 'Integrasi', perm: 'forward.manage',
    render(el) {
      const st = D.state, u = D.me(); const q = App.forwardQueue();
      const qk = q.filter(x => x.target === 'proposal'), qc = q.filter(x => x.target === 'candidate');
      const kecs = D.userKecs();
      const hist = st.forwards.filter(f => { const k = f.target === 'proposal' ? (st.proposals.find(p => p.id === f.tid) ? D.OP_BY[st.proposals.find(p => p.id === f.tid).idop].kec : 0) : (st.candidates.find(c => c.id === f.tid) || {}).kec; return kecs.includes(k); });
      el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">Penerusan ke sistem utama</div><p class="pagehead__desc">Hasil terverifikasi diteruskan ke pengelola sistem pajak melalui <b>batch ekspor</b>. GIS tidak menulis ke <span class="t-mono">BSG_OP</span>. Rekonsiliasi membaca ulang master untuk menandai item yang sudah diterapkan.</p></div><div class="pagehead__actions"><button class="btn btn--secondary" id="fRek">' + ui.icon('refresh') + 'Jalankan rekonsiliasi</button></div></div>' +
        '<div class="grid-stats">' + ui.stat({ label: 'Koordinat siap diteruskan', value: qk.length, icon: 'pin', tone: 'teal' }) + ui.stat({ label: 'Temuan siap diteruskan', value: qc.length, icon: 'plus', tone: 'amber' }) + ui.stat({ label: 'Diteruskan, menunggu diterapkan', value: hist.filter(f => f.status === 'DITERUSKAN').length, icon: 'arrow-right', tone: 'grey' }) + ui.stat({ label: 'Sudah diterapkan di master', value: hist.filter(f => f.status === 'DITERAPKAN_DI_MASTER').length, icon: 'check-circle', tone: 'green' }) + '</div>' +
        '<div class="card mb"><div class="card__head"><div><div class="card__title">Antrean penerusan</div><div class="card__sub">Pilih item lalu buat batch (CSV untuk tim pengelola sistem utama)</div></div><button class="btn btn--primary" id="fBatch" disabled>' + ui.icon('download') + 'Buat batch & unduh</button></div><div class="card__body" style="padding:0" id="fQ"></div></div>' +
        '<div class="card"><div class="card__head"><div class="card__title">Riwayat batch</div></div><div class="card__body" style="padding:0" id="fH"></div></div>';
      const chosen = new Set(q.map(x => x.target + ':' + x.item.id));
      const qHost = ui.qs('#fQ', el);
      function drawQ() {
        qHost.innerHTML = q.length ? '<table class="data"><thead><tr><th><input type="checkbox" id="fAll" checked aria-label="Pilih semua"></th><th>Jenis</th><th>Item</th><th>Koordinat</th><th>Diverifikasi</th></tr></thead><tbody>' + q.map(x => { const k = x.target + ':' + x.item.id; const v = st.verifications.filter(v => v.tid === x.item.id).pop() || {}; const nm = x.target === 'proposal' ? D.OP_BY[x.item.idop].nama : x.item.nama; return '<tr><td><input type="checkbox" data-k="' + k + '"' + (chosen.has(k) ? ' checked' : '') + '></td><td>' + (x.target === 'proposal' ? ui.badge({ label: 'Koordinat', badge: 'badge--teal', ikon: 'pin' }) : ui.badge({ label: 'Calon objek', badge: 'badge--warning', ikon: 'plus' })) + '</td><td><div class="cell-title">' + ui.esc(nm) + '</div><div class="cell-sub t-mono">' + x.item.id + (x.target === 'proposal' ? ' · ' + D.OP_BY[x.item.idop].noOp : '') + '</div></td><td class="t-mono" style="font-size:12px">' + ui.coord(x.item.lat) + ', ' + ui.coord(x.item.lng) + '</td><td>' + ui.esc(D.user(v.by).nama) + '<div class="cell-sub">' + ui.date(v.at) + '</div></td></tr>'; }).join('') + '</tbody></table>' : '<div class="card__body">' + ui.state({ icon: 'check-circle', title: 'Tidak ada item menunggu', desc: 'Semua hasil terverifikasi sudah diteruskan.' }) + '</div>';
        ui.qs('#fBatch', el).disabled = !chosen.size;
        ui.qsa('[data-k]', qHost).forEach(c => c.onchange = () => { c.checked ? chosen.add(c.dataset.k) : chosen.delete(c.dataset.k); ui.qs('#fBatch', el).disabled = !chosen.size; });
        const all = ui.qs('#fAll', qHost); if (all) all.onchange = () => { q.forEach(x => all.checked ? chosen.add(x.target + ':' + x.item.id) : chosen.delete(x.target + ':' + x.item.id)); drawQ(); };
      }
      drawQ();
      ui.qs('#fBatch', el).onclick = () => {
        st.seq.batch++; const no = 'FWD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(st.seq.batch).padStart(2, '0');
        const items = q.filter(x => chosen.has(x.target + ':' + x.item.id)); const b = { id: 'b' + st.seq.batch, no, items: items.map(x => x.item.id), by: u.id, at: new Date().toISOString() }; st.batches.push(b);
        items.forEach(x => st.forwards.push({ target: x.target, tid: x.item.id, status: 'DITERUSKAN', batch: b.id, at: b.at }));
        const rows = [['batch', 'jenis', 'id_gis', 'idop', 'no_op', 'nama', 'lat', 'lng', 'akurasi_m', 'sumber', 'kecamatan', 'desa', 'diverifikasi_oleh', 'tgl_verifikasi']].concat(items.map(x => { const v = st.verifications.filter(v => v.tid === x.item.id).pop() || {}; const o = x.target === 'proposal' ? D.OP_BY[x.item.idop] : null; return [no, x.target === 'proposal' ? 'KOORDINAT' : 'CALON_OBJEK', x.item.id, o ? o.idop : '', o ? o.noOp : '', o ? o.nama : x.item.nama, x.item.lat, x.item.lng, x.item.akurasi, x.item.sumber, D.KEC_BY[o ? o.kec : x.item.kec].nama, D.desaName(o ? o.kec : x.item.kec, o ? o.kel : x.item.kel), D.user(v.by).nama, v.at]; }));
        ui.downloadCSV(no + '.csv', rows); D.audit('penerusan.batch', 'Membuat batch ' + no + ' (' + items.length + ' item)', no); D.save(); ui.toast('Batch ' + no + ' dibuat & diunduh. Kirim ke pengelola sistem utama sesuai prosedur.'); App.rerender();
      };
      ui.qs('#fRek', el).onclick = () => {
        let n = 0; st.forwards.filter(f => f.status === 'DITERUSKAN').forEach(f => { if (Math.random() < 0.6) { f.status = 'DITERAPKAN_DI_MASTER'; f.at = new Date().toISOString(); n++; } });
        st.jobs.push({ id: st.jobs.length + 1, proses: 'Rekonsiliasi koordinat terverifikasi', at: new Date().toISOString(), status: 'Berhasil', ringkasan: n + ' item ditemukan sudah sama dengan master (toleransi 1 m)' });
        D.audit('job.rekonsiliasi', 'Menjalankan rekonsiliasi: ' + n + ' item diterapkan'); D.save(); ui.toast('Rekonsiliasi selesai: ' + n + ' item ditandai “diterapkan di master” (simulasi).'); App.rerender();
      };
      const hb = st.batches.slice().reverse();
      ui.qs('#fH', el).innerHTML = hb.length ? '<table class="data"><thead><tr><th>No batch</th><th>Dibuat</th><th>Item</th><th>Status item</th></tr></thead><tbody>' + hb.map(b => { const fs = st.forwards.filter(f => f.batch === b.id); const ap = fs.filter(f => f.status === 'DITERAPKAN_DI_MASTER').length; return '<tr><td class="t-mono">' + b.no + '</td><td>' + ui.dateTime(b.at) + '<div class="cell-sub">' + ui.esc(D.user(b.by).nama) + '</div></td><td>' + fs.length + '</td><td>' + ui.stack([{ label: 'Diterapkan', value: ap, color: 'var(--success-600)' }, { label: 'Menunggu', value: fs.length - ap, color: 'var(--info-600)' }], fs.length) + '<div class="cell-sub">' + ap + ' diterapkan · ' + (fs.length - ap) + ' menunggu</div></td></tr>'; }).join('') + '</tbody></table>' : '<div class="card__body"><p class="t-sm muted">Belum ada batch.</p></div>';
    }
  });
})();
