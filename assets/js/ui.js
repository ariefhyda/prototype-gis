/* ============================================================
   GIS Pajak — UI inti: helper, komponen, shell, router
   ============================================================ */
window.UI = (function () {
  'use strict';
  const ui = {};
  ui.qs = (s, r) => (r || document).querySelector(s);
  ui.qsa = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  ui.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ui.icon = (n, cls) => '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (window.ICONS[n] || window.ICONS.info) + '</svg>';
  ui.num = (n) => (n == null ? '—' : Number(n).toLocaleString('id-ID'));
  ui.pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  ui.rp = (n) => n == null ? '—' : 'Rp' + Number(n).toLocaleString('id-ID');
  ui.rpShort = (n) => n >= 1e9 ? 'Rp' + (n / 1e9).toFixed(2).replace('.', ',') + ' M' : n >= 1e6 ? 'Rp' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt' : ui.rp(n);
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  ui.date = (d) => { if (!d) return '—'; d = new Date(d); return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); };
  ui.dateTime = (d) => { if (!d) return '—'; d = new Date(d); return ui.date(d) + ', ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); };
  ui.ago = (d) => {
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'baru saja'; if (m < 60) return m + ' menit lalu';
    const h = Math.round(m / 60); if (h < 24) return h + ' jam lalu';
    const dd = Math.round(h / 24); return dd < 30 ? dd + ' hari lalu' : ui.date(d);
  };
  ui.dist = (m) => m == null ? '—' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km';
  ui.coord = (v) => v == null ? '—' : Number(v).toFixed(6);

  /* ---------------- Badge ---------------- */
  ui.badge = (m, extra) => m ? '<span class="badge ' + m.badge + '">' + (m.ikon ? ui.icon(m.ikon) : '') + '<span>' + ui.esc(m.label) + (extra ? ' ' + ui.esc(extra) : '') + '</span></span>' : '';
  ui.bBayar = (st, th) => ui.badge(D.STATUS_BAYAR[st]) + (th ? '<div class="cell-sub">Tahun ' + th + '</div>' : '');
  ui.bQ = (q) => ui.badge(D.KUALITAS[q]);
  ui.bUsulan = (s) => ui.badge(D.ST_USULAN[s]);
  ui.bCalon = (s) => ui.badge(D.ST_CALON[s]);
  ui.bTugas = (s) => ui.badge(D.ST_TUGAS[s]);
  ui.bTerus = (s) => ui.badge(D.ST_TERUS[s]);
  ui.bAktif = (op) => op.aktif ? '<span class="badge badge--outline">' + ui.icon('check') + '<span>Aktif</span></span>' : '<span class="badge badge--neutral">' + ui.icon('x') + '<span>Tutup ' + (op.tglTutup ? ui.date(op.tglTutup) : '') + '</span></span>';
  ui.bRole = (r) => '<span class="badge badge--navy">' + ui.icon(D.ROLES[r].ikon) + '<span>' + D.ROLES[r].nama + '</span></span>';

  /* ---------------- Penyamaran ---------------- */
  ui.maskNik = (s) => String(s).replace(/^(\d{4})\d{8}(\d{4})$/, '$1••••••••$2');
  ui.maskHp = (s) => { s = String(s); return s.slice(0, 4) + '••••' + s.slice(-3); };
  ui.maskEmail = (e) => { e = String(e); const i = e.indexOf('@'); return e.slice(0, 2) + '•••' + e.slice(i); };
  ui.maskNama = (n) => String(n).split(' ').map((w, i) => i === 0 ? w : w[0] + '•••').join(' ');
  ui.masked = (val, maskedVal, key) => {
    const st = D.state; const shown = st.revealed[key];
    if (shown) return '<span class="t-mono">' + ui.esc(val) + '</span>';
    return '<span class="masked t-mono">' + ui.esc(maskedVal) + '</span>' + (D.can('taxpayer.pii') ? ' <button class="btn btn--sm btn--ghost" data-reveal="' + ui.esc(key) + '">' + ui.icon('eye') + 'Tampilkan</button>' : '');
  };
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-reveal]'); if (!b) return;
    const key = b.dataset.reveal;
    ui.confirm({
      title: 'Buka data pribadi?', sub: 'Akses data pribadi wajib pajak dicatat di audit log sesuai UU 27/2022 tentang Pelindungan Data Pribadi.', okLabel: 'Tampilkan & catat', onOk: function () {
        D.state.revealed[key] = true; D.audit('wp.pii', 'Membuka data pribadi (' + key.split(':')[0] + ')', key); D.save(); App.rerender();
      }
    });
  });

  /* ---------------- Toast ---------------- */
  ui.toast = function (msg, type, title) {
    let st = ui.qs('.toast-stack'); if (!st) { st = document.createElement('div'); st.className = 'toast-stack'; document.body.appendChild(st); }
    const el = document.createElement('div'); el.className = 'toast toast--' + (type || 'success'); el.setAttribute('role', 'status');
    el.innerHTML = ui.icon(type === 'error' ? 'alert' : type === 'warning' ? 'alert' : 'check-circle') + '<div>' + (title ? '<div class="toast__title">' + ui.esc(title) + '</div>' : '') + '<div class="toast__msg">' + msg + '</div></div>';
    st.appendChild(el); setTimeout(() => { el.remove(); if (!st.children.length) st.remove(); }, 4200);
  };

  /* ---------------- Modal ---------------- */
  let ov;
  ui.modal = function (o) {
    if (!ov) { ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="modal' + (o.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + ui.esc(o.title || '') + '">' +
      '<div class="modal__head"><div><div class="modal__title">' + ui.esc(o.title || '') + '</div>' + (o.sub ? '<div class="modal__sub">' + o.sub + '</div>' : '') + '</div>' +
      '<button class="icon-btn" data-close aria-label="Tutup">' + ui.icon('x') + '</button></div>' +
      (o.body != null ? '<div class="modal__body">' + o.body + '</div>' : '') + (o.foot ? '<div class="modal__foot">' + o.foot + '</div>' : '') + '</div>';
    ov.classList.add('is-open'); document.body.style.overflow = 'hidden';
    ui.qsa('[data-close]', ov).forEach(el => el.addEventListener('click', ui.closeModal));
    ov.onclick = (e) => { if (e.target === ov) ui.closeModal(); };
    if (o.onOpen) o.onOpen(ov);
    return ov;
  };
  ui.closeModal = function () { if (!ov) return; ov.classList.remove('is-open'); document.body.style.overflow = ''; setTimeout(() => { if (!ov.classList.contains('is-open')) ov.innerHTML = ''; }, 180); };
  ui.confirm = function (o) {
    const m = ui.modal({ title: o.title, sub: o.sub, body: o.body || '', foot: '<button class="btn btn--secondary" data-close>Batal</button><button class="btn ' + (o.danger ? 'btn--destructive' : 'btn--primary') + '" id="cfmOk">' + ui.esc(o.okLabel || 'Lanjutkan') + '</button>', onOpen: o.onOpen });
    ui.qs('#cfmOk', m).addEventListener('click', function () { if (o.validate && !o.validate(m)) return; const vals = o.collect ? o.collect(m) : null; ui.closeModal(); if (o.onOk) o.onOk(vals); });
  };
  ui.prompt = function (o) {
    ui.confirm(Object.assign({}, o, {
      body: (o.body || '') + '<div class="field"><label class="field__label" for="pmTxt">' + ui.esc(o.label) + (o.required ? ' <span class="t-xs">(wajib)</span>' : '') + '</label><textarea class="textarea" id="pmTxt" rows="4" placeholder="' + ui.esc(o.placeholder || '') + '"></textarea><div class="field__error" id="pmErr" hidden>Wajib diisi.</div></div>',
      validate: function (m) { const v = ui.qs('#pmTxt', m).value.trim(); if (o.required && !v) { ui.qs('#pmErr', m).hidden = false; return false; } return true; },
      collect: function (m) { return ui.qs('#pmTxt', m).value.trim(); }
    }));
  };

  /* ---------------- Tabs ---------------- */
  ui.tabs = function (items, active, attr) {
    return '<div class="tabs" role="tablist" ' + (attr || '') + '>' + items.map(t => '<button data-tab="' + t.key + '" aria-selected="' + (t.key === active) + '">' + ui.esc(t.label) + (t.count != null ? ' <span class="count">' + t.count + '</span>' : '') + '</button>').join('') + '</div>';
  };

  /* ---------------- Statistik & grafik ---------------- */
  ui.stat = function (o) {
    return '<' + (o.href ? 'a href="' + o.href + '" class="stat stat--clickable statlink"' : 'div class="stat"') + '>' +
      '<div class="stat__top"><span class="stat__label">' + ui.esc(o.label) + '</span><span class="stat__icon ' + (o.tone ? 'stat__icon--' + o.tone : '') + '">' + ui.icon(o.icon || 'info') + '</span></div>' +
      '<div class="stat__value">' + o.value + '</div>' + (o.bar != null ? '<div class="stat__bar"><span style="width:' + Math.min(100, o.bar) + '%;background:' + (o.barColor || 'var(--teal-600)') + '"></span></div>' : '') +
      (o.meta ? '<div class="stat__meta">' + o.meta + '</div>' : '') + '</' + (o.href ? 'a' : 'div') + '>';
  };
  ui.bars = function (rows, o) {
    o = o || {}; const max = Math.max.apply(null, rows.map(r => r.value).concat([1]));
    return '<div class="bars">' + rows.map(r => '<div class="barline"' + (r.href ? ' style="cursor:pointer" data-href="' + r.href + '"' : '') + '><span class="barline__label" title="' + ui.esc(r.label) + '">' + ui.esc(r.label) + '</span><span class="barline__track"><span class="barline__fill" style="width:' + (r.value / max * 100) + '%;background:' + (r.color || o.color || 'var(--teal-600)') + '"></span></span><span class="barline__val">' + (o.fmt ? o.fmt(r.value) : ui.num(r.value)) + '</span></div>').join('') + '</div>';
  };
  ui.stack = function (parts, total) {
    total = total || parts.reduce((a, p) => a + p.value, 0) || 1;
    return '<div class="stackbar">' + parts.map(p => '<span title="' + ui.esc(p.label) + ': ' + ui.num(p.value) + '" style="width:' + (p.value / total * 100) + '%;background:' + p.color + '"></span>').join('') + '</div>';
  };
  ui.donut = function (rows, center) {
    const total = rows.reduce((a, r) => a + r.value, 0) || 1; let acc = 0; const R = 42, C = 2 * Math.PI * R;
    const arcs = rows.map(r => { const len = r.value / total * C; const s = '<circle r="' + R + '" cx="60" cy="60" fill="none" stroke="' + r.color + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc) + '" transform="rotate(-90 60 60)"' + (r.pattern ? ' stroke-opacity=".7"' : '') + '><title>' + ui.esc(r.label) + ': ' + ui.num(r.value) + '</title></circle>'; acc += len; return s; }).join('');
    return '<div class="row" style="gap:20px;align-items:center;flex-wrap:wrap"><svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Diagram donat">' + arcs + '<text x="60" y="57" text-anchor="middle" font-size="18" font-weight="700" fill="var(--text-primary)">' + (center ? center[0] : '') + '</text><text x="60" y="74" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + (center ? center[1] : '') + '</text></svg>' +
      '<div class="legend grow" style="min-width:180px">' + rows.map(r => '<div class="legend__item"><span class="legend__swatch" style="background:' + r.color + '"></span><span>' + ui.esc(r.label) + '</span><span class="legend__val">' + ui.num(r.value) + ' <span class="t-xs">(' + ui.pct(r.value, total).toString().replace('.', ',') + '%)</span></span></div>').join('') + '</div></div>';
  };
  ui.spark = function (vals, color) {
    const W = 260, H = 70, max = Math.max.apply(null, vals.concat([1])); const st = W / (vals.length - 1);
    const pts = vals.map((v, i) => [i * st, H - 6 - v / max * (H - 16)]);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none"><path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + (color || 'var(--teal-600)') + '" stroke-width="2.5"/>' + pts.map(p => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + (color || 'var(--teal-600)') + '"/>').join('') + '</svg>';
  };
  ui.state = function (o) {
    return '<div class="state ' + (o.tone ? 'state--' + o.tone : '') + '"><div class="state__icon">' + ui.icon(o.icon || 'info', 'icon--xl') + '</div><div class="state__title">' + ui.esc(o.title) + '</div><div class="state__desc">' + (o.desc || '') + '</div>' + (o.action || '') + '</div>';
  };

  /* ---------------- Tabel dengan paging ---------------- */
  ui.table = function (host, o) {
    // o: {rows, cols:[{label, cell(row), cls, sort}], pageSize, empty, onRow}
    let page = 1; const size = o.pageSize || 20; let sortKey = o.sortKey || null, sortDir = 1;
    function draw() {
      let rows = o.rows.slice();
      if (sortKey != null) { const c = o.cols[sortKey]; rows.sort((a, b) => { const x = c.sort(a), y = c.sort(b); return (x > y ? 1 : x < y ? -1 : 0) * sortDir; }); }
      const pages = Math.max(1, Math.ceil(rows.length / size)); if (page > pages) page = pages;
      const slice = rows.slice((page - 1) * size, page * size);
      if (!rows.length) { host.innerHTML = o.empty || ui.state({ icon: 'search', title: 'Tidak ada data', desc: 'Tidak ada baris yang cocok dengan filter saat ini.' }); return; }
      host.innerHTML = '<div class="tablewrap"><div class="tablescroll"><table class="data responsive-card"><thead><tr>' +
        o.cols.map((c, i) => '<th class="' + (c.cls || '') + (c.sort ? ' sortable' : '') + (sortKey === i ? ' is-sorted' : '') + '" data-col="' + i + '">' + (c.sort ? '<span class="sort">' + ui.esc(c.label) + (sortKey === i ? (sortDir > 0 ? ' ↑' : ' ↓') : '') + '</span>' : ui.esc(c.label)) + '</th>').join('') +
        '</tr></thead><tbody>' + slice.map((r, i) => '<tr data-i="' + i + '"' + (o.onRow ? ' style="cursor:pointer"' : '') + '>' + o.cols.map(c => '<td class="' + (c.cls || '') + '" data-label="' + ui.esc(c.label) + '">' + c.cell(r) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
        '<div class="pagination"><span class="t-xs">Menampilkan ' + ui.num((page - 1) * size + 1) + '–' + ui.num(Math.min(rows.length, page * size)) + ' dari ' + ui.num(rows.length) + '</span><div class="pagination__pages">' +
        '<button data-pg="prev" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Sebelumnya">' + ui.icon('chevron-left') + '</button>' +
        pageList(page, pages).map(p => p === '…' ? '<span class="t-xs">…</span>' : '<button data-pg="' + p + '" class="' + (p === page ? 'is-current' : '') + '">' + p + '</button>').join('') +
        '<button data-pg="next" ' + (page === pages ? 'disabled' : '') + ' aria-label="Berikutnya">' + ui.icon('chevron-right') + '</button></div></div></div>';
      ui.qsa('[data-pg]', host).forEach(b => b.addEventListener('click', () => { const v = b.dataset.pg; page = v === 'prev' ? page - 1 : v === 'next' ? page + 1 : +v; draw(); host.scrollIntoView({ block: 'nearest' }); }));
      ui.qsa('th.sortable', host).forEach(th => th.addEventListener('click', () => { const i = +th.dataset.col; if (sortKey === i) sortDir *= -1; else { sortKey = i; sortDir = 1; } draw(); }));
      if (o.onRow) ui.qsa('tbody tr', host).forEach(tr => tr.addEventListener('click', (e) => { if (e.target.closest('a,button,input,label')) return; o.onRow(slice[+tr.dataset.i]); }));
      if (o.after) o.after(host, slice);
    }
    function pageList(p, n) { if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1); const s = new Set([1, n, p, p - 1, p + 1]); const arr = [...s].filter(x => x >= 1 && x <= n).sort((a, b) => a - b); const out = []; arr.forEach((x, i) => { if (i && x - arr[i - 1] > 1) out.push('…'); out.push(x); }); return out; }
    draw();
    return { set rows(r) { o.rows = r; page = 1; draw(); }, redraw: draw };
  };

  /* ---------------- Unduhan CSV ---------------- */
  ui.downloadCSV = function (name, rows) {
    const csv = rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ---------------- Foto (kompres di klien) ---------------- */
  ui.fotoHTML = function (f, big) {
    if (f && f.data) return '<img src="' + f.data + '" alt="Foto lapangan" class="foto' + (big ? ' foto--big' : '') + '">';
    const lbl = f ? f.label : 'Foto'; const hue = Math.floor((D.trigram ? (lbl.length * 37) : 0) % 360);
    return '<div class="foto foto--ph' + (big ? ' foto--big' : '') + '" style="--h:' + hue + '">' + ui.icon('image') + '<span>Foto contoh ' + (((f && f.i) || 0) + 1) + '</span></div>';
  };
  ui.compressImage = function (file, max) {
    return new Promise(function (res, rej) {
      const r = new FileReader(); r.onerror = rej;
      r.onload = function () {
        const img = new Image(); img.onerror = rej;
        img.onload = function () { const s = Math.min(1, (max || 480) / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', 0.72), name: file.name, size: file.size }); };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  };
  ui.fotoPicker = function (host, list, o) {
    o = o || {};
    function draw() {
      host.innerHTML = '<div class="fotogrid">' + list.map((f, i) => '<div class="fotocell">' + ui.fotoHTML(f) + '<button type="button" class="fotocell__rm" data-rm="' + i + '" aria-label="Hapus foto">' + ui.icon('x') + '</button></div>').join('') +
        (list.length < (o.max || 5) ? '<label class="fotocell fotocell--add">' + ui.icon('camera', 'icon--lg') + '<span>Ambil / pilih foto</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden></label>' : '') + '</div>' +
        '<div class="field__help">' + list.length + ' dari maks. ' + (o.max || 5) + ' foto · minimal ' + (o.min || 1) + ' · JPEG/PNG/WebP, dikompres di perangkat sebelum dikirim. Metadata selain lokasi & waktu dibuang.</div>';
      ui.qsa('[data-rm]', host).forEach(b => b.addEventListener('click', () => { list.splice(+b.dataset.rm, 1); draw(); }));
      const inp = ui.qs('input[type=file]', host);
      if (inp) inp.addEventListener('change', async () => {
        for (const f of inp.files) { if (list.length >= (o.max || 5)) break; if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { ui.toast('Berkas ' + ui.esc(f.name) + ' bukan gambar yang didukung.', 'error'); continue; } try { list.push(await ui.compressImage(f, 520)); } catch (e) { ui.toast('Gagal membaca foto.', 'error'); } }
        draw();
      });
    }
    draw();
  };

  /* ---------------- Timeline ---------------- */
  ui.timeline = function (items) {
    return '<div class="timeline">' + items.map(t => '<div class="timeline__item timeline__item--' + (t.tone || 'done') + '"><span class="timeline__dot">' + ui.icon(t.icon || 'check') + '</span><div class="timeline__title">' + t.title + '</div><div class="timeline__time">' + t.time + '</div>' + (t.desc ? '<div class="timeline__desc">' + t.desc + '</div>' : '') + '</div>').join('') + '</div>';
  };

  ui.kecOptions = function (sel, kecs, all) {
    kecs = kecs || D.userKecs();
    return (all !== false ? '<option value="">Semua kecamatan</option>' : '') + D.KEC.filter(k => kecs.includes(k.kec)).map(k => '<option value="' + k.kec + '"' + (String(sel) === String(k.kec) ? ' selected' : '') + '>' + ui.esc(k.nama) + '</option>').join('');
  };
  ui.desaOptions = function (kec, sel) {
    if (!kec) return '<option value="">Semua desa/kelurahan</option>';
    return '<option value="">Semua desa/kelurahan</option>' + D.DESA.filter(d => d.kec === +kec).sort((a, b) => a.nama.localeCompare(b.nama)).map(d => '<option value="' + d.kel + '"' + (String(sel) === String(d.kel) ? ' selected' : '') + '>' + ui.esc(d.nama) + '</option>').join('');
  };
  ui.jenisOptions = function (sel) { return '<option value="">Semua jenis pajak</option>' + D.JENIS.map(j => '<option value="' + j.id + '"' + (String(sel) === String(j.id) ? ' selected' : '') + '>' + ui.esc(j.nama) + '</option>').join(''); };
  ui.wilayah = (op) => ui.esc(D.desaName(op.kec, op.kel)) + '<div class="cell-sub">Kec. ' + ui.esc(D.KEC_BY[op.kec].nama) + '</div>';

  return ui;
})();

/* ============================================================
   App: shell, navigasi per role, router
   ============================================================ */
window.App = (function () {
  'use strict';
  const ui = UI; const pages = {}; let current = null; let cleanup = [];
  const NAV = [
    { label: 'Pemantauan', items: [
      { key: 'dashboard', nama: 'Dashboard', href: '#/dashboard', ikon: 'dashboard' },
      { key: 'peta', nama: 'Peta Objek Pajak', href: '#/peta', ikon: 'map', perm: 'map.view' },
      { key: 'wilayah', nama: 'Profil Wilayah', href: '#/wilayah', ikon: 'globe', perm: 'region.view' }
    ] },
    { label: 'Data Pokok', items: [
      { key: 'objek', nama: 'Data Objek Pajak', href: '#/objek', ikon: 'building', perm: 'object.view' },
      { key: 'wp', nama: 'Data Wajib Pajak', href: '#/wp', ikon: 'users', perm: 'taxpayer.view' }
    ] },
    { label: 'Pendataan Lapangan', items: [
      { key: 'tugas', nama: 'Tugas Saya', href: '#/tugas', ikon: 'clipboard', perm: 'assignment.own', count: 'tugasSaya' },
      { key: 'tugas', nama: 'Penugasan Survei', href: '#/tugas', ikon: 'clipboard', perm: 'assignment.manage', count: 'tugasTelat' },
      { key: 'koordinat', nama: 'Pendataan Koordinat', href: '#/koordinat', ikon: 'pin', perm: 'coordinate.propose', count: 'koordinat' },
      { key: 'calon', nama: 'Calon Objek Pajak', href: '#/calon', ikon: 'plus', perm: 'candidate.create', count: 'calon' }
    ] },
    { label: 'Integrasi', items: [
      { key: 'penerusan', nama: 'Penerusan Hasil', href: '#/penerusan', ikon: 'send', perm: 'forward.manage', count: 'terus' }
    ] },
    { label: 'Pelaporan & Sistem', items: [
      { key: 'laporan', nama: 'Laporan', href: '#/laporan', ikon: 'chart', perm: 'report.view' },
      { key: 'akun', nama: 'Akun & Role', href: '#/akun', ikon: 'shield', perm: 'admin.users' },
      { key: 'audit', nama: 'Audit Log', href: '#/audit', ikon: 'activity', perm: 'audit.view' },
      { key: 'pengaturan', nama: 'Pengaturan', href: '#/pengaturan', ikon: 'settings' }
    ] }
  ];

  function counts() {
    const u = D.me(); const st = D.state; const c = {};
    if (!u) return c;
    if (u.role === 'supervisor') {
      c.koordinat = st.proposals.filter(p => p.status === 'DIAJUKAN' && D.inScope(D.OP_BY[p.idop])).length;
      c.calon = st.candidates.filter(x => ['BARU', 'DALAM_VERIFIKASI'].includes(x.status) && D.userKecs().includes(x.kec)).length;
      c.tugasTelat = st.assignments.filter(t => t.created_by === u.id && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status) && new Date(t.tenggat) < D.TODAY).length;
    }
    if (u.role === 'petugas') {
      c.koordinat = st.proposals.filter(p => p.status === 'DIKEMBALIKAN' && p.created_by === u.id).length;
      c.calon = st.candidates.filter(x => x.status === 'PERLU_KELENGKAPAN' && x.created_by === u.id).length;
      c.tugasSaya = st.assignments.filter(t => t.petugas.includes(u.id) && ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status)).length;
    }
    if (u.role === 'supervisor' || u.role === 'admin') c.terus = forwardQueue().length;
    return c;
  }
  function forwardQueue() {
    const st = D.state; const done = new Set(st.forwards.map(f => f.target + ':' + f.tid));
    const kecs = D.userKecs();
    return st.proposals.filter(p => p.status === 'DISETUJUI' && !done.has('proposal:' + p.id) && kecs.includes(D.OP_BY[p.idop].kec)).map(p => ({ target: 'proposal', item: p }))
      .concat(st.candidates.filter(c => c.status === 'TERVERIFIKASI' && !done.has('candidate:' + c.id) && kecs.includes(c.kec)).map(c => ({ target: 'candidate', item: c })));
  }

  function sidebar(active) {
    const cfg = D.state.cfg, u = D.me(), c = counts();
    let h = '<div class="sidebar__brand"><div class="logo-badge logo-badge--light" title="Logo instansi (placeholder)">LOGO</div><div class="sidebar__brandtext"><div class="sidebar__appname">' + ui.esc(cfg.shortName) + '</div><div class="sidebar__inst">' + ui.esc(cfg.instShort) + '</div></div></div><nav class="sidebar__scroll" aria-label="Menu utama">';
    NAV.forEach(g => {
      const items = g.items.filter(it => !it.perm || D.can(it.perm)); if (!items.length) return;
      h += '<div class="nav-group"><div class="nav-group__label">' + g.label + '</div>' + items.map(it => '<a class="nav-item' + (it.key === active ? ' is-active" aria-current="page"' : '"') + ' href="' + it.href + '">' + ui.icon(it.ikon) + '<span class="nav-item__text">' + it.nama + '</span>' + (it.count && c[it.count] ? '<span class="nav-item__count">' + c[it.count] + '</span>' : '') + '</a>').join('') + '</div>';
    });
    h += '</nav><div class="sidebar__foot"><div class="userbox"><div class="avatar">' + initials(u.nama) + '</div><div class="userbox__meta" style="min-width:0"><div class="userbox__name">' + ui.esc(u.nama) + '</div><div class="userbox__role">' + ui.esc(D.ROLES[u.role].nama) + '</div></div>' +
      '<a class="btn btn--sm btn--ghost" style="margin-left:auto;color:rgba(255,255,255,.8)" href="#/logout" title="Keluar">' + ui.icon('logout') + '</a></div></div>';
    return h;
  }
  function initials(n) { return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
  function header(title, crumb) {
    const st = D.state, u = D.me(); const unread = st.notifs.filter(n => n.user === u.id && !n.read).length;
    return '<button class="sidebar-toggle" id="navToggle" aria-label="Sembunyikan/tampilkan menu" title="Sembunyikan/tampilkan menu (Ctrl+B)">' + ui.icon('menu') + '</button>' +
      '<div class="header__titles"><div class="header__crumb">' + ui.icon('home') + '<span>' + ui.esc(st.cfg.shortName) + '</span><span aria-hidden="true">/</span><span>' + ui.esc(crumb || title) + '</span></div><h1 class="header__title">' + ui.esc(title) + '</h1></div>' +
      '<div class="header__actions">' +
      '<span class="tag-simulasi" title="Objek, WP, dan pembayaran adalah data fiktif. Batas wilayah: data BIG.">' + ui.icon('info') + '<span class="hide-narrow">Data simulasi</span></span>' +
      (D.can('payment.view') ? '<button class="periodpill" id="periodPill" title="Periode pajak">' + ui.icon('calendar') + '<span class="pp-long">Tahun Pajak ' + st.tahun + '</span><span class="pp-short">' + st.tahun + '</span>' + ui.icon('chevron-down') + '</button>' : '') +
      '<form class="header__search" id="hdrSearch" role="search"><span class="input-wrap"><span class="icon--prefix">' + ui.icon('search') + '</span><input class="input" type="search" name="q" placeholder="Cari No OP, nama objek, alamat…" aria-label="Cari objek"></span></form>' +
      '<button class="icon-btn notifbtn" id="notifBtn" aria-label="Notifikasi">' + ui.icon('bell') + (unread ? '<span class="notifdot">' + unread + '</span>' : '') + '</button>' +
      '<button class="periodpill protopill" id="protoBtn" title="Kontrol prototipe">' + ui.icon('user') + '<span class="hide-narrow">' + ui.esc(D.ROLES[u.role].nama.split(' /')[0]) + '</span>' + ui.icon('chevron-down') + '</button>' +
      '</div>';
  }
  function wireShell() {
    const app = ui.qs('.app');
    const desk = () => window.innerWidth > 1024;
    const tg = ui.qs('#navToggle');
    const sync = () => tg.setAttribute('aria-expanded', desk() ? String(!app.classList.contains('is-sidehidden')) : String(app.classList.contains('is-navopen')));
    tg.onclick = () => {
      if (desk()) { const h = app.classList.toggle('is-sidehidden'); try { localStorage.setItem('gispajak.sidebarHidden', h ? '1' : '0'); } catch (e) { } setTimeout(() => window.dispatchEvent(new Event('resize')), 30); }
      else app.classList.toggle('is-navopen');
      sync();
    };
    sync();
    ui.qs('.navscrim').onclick = () => app.classList.remove('is-navopen');
    ui.qsa('.nav-item').forEach(a => a.addEventListener('click', () => app.classList.remove('is-navopen')));
    const pp = ui.qs('#periodPill');
    if (pp) pp.onclick = () => ui.modal({
      title: 'Periode pajak', sub: 'Status pembayaran selalu ditampilkan bersama periode. Pilihan berlaku untuk dashboard, peta, tabel, dan laporan.',
      body: '<div class="row wrap">' + D.TAHUN.map(t => '<button class="chip' + (t === D.state.tahun ? ' is-active' : '') + '" data-th="' + t + '">Tahun Pajak ' + t + (t === D.TAHUN_BERJALAN ? ' (berjalan)' : '') + '</button>').join('') + '</div><p class="t-xs" style="margin-top:12px">Granularitas bulanan untuk PBJT mengikuti konfigurasi jenis pajak saat implementasi; prototipe menampilkan rekap tahunan.</p>',
      onOpen: m => ui.qsa('[data-th]', m).forEach(b => b.onclick = () => { D.state.tahun = +b.dataset.th; D.save(); ui.closeModal(); render(); })
    });
    ui.qs('#hdrSearch').onsubmit = (e) => { e.preventDefault(); const q = e.target.q.value.trim(); location.hash = '#/objek?q=' + encodeURIComponent(q); };
    ui.qs('#notifBtn').onclick = openNotifs;
    ui.qs('#protoBtn').onclick = openProto;
  }
  function openNotifs() {
    const u = D.me(); const list = D.state.notifs.filter(n => n.user === u.id).slice().reverse();
    ui.modal({
      title: 'Notifikasi', sub: 'Pemberitahuan di dalam aplikasi (tanpa SMS/WA otomatis).',
      body: list.length ? '<div class="notiflist">' + list.map(n => '<a class="notif' + (n.read ? '' : ' is-unread') + '" href="' + n.href + '" data-nid="' + n.id + '"><div class="notif__t">' + ui.esc(n.judul) + '</div><div class="t-sm">' + ui.esc(n.isi) + '</div><div class="t-xs">' + ui.ago(n.at) + '</div></a>').join('') + '</div>' : ui.state({ icon: 'bell', title: 'Belum ada notifikasi', desc: 'Penugasan baru, usulan dikembalikan, dan antrean verifikasi akan muncul di sini.' }),
      foot: '<button class="btn btn--secondary" id="readAll">Tandai semua dibaca</button><button class="btn btn--primary" data-close>Tutup</button>',
      onOpen: m => {
        ui.qsa('[data-nid]', m).forEach(a => a.addEventListener('click', () => { const n = D.state.notifs.find(x => x.id === +a.dataset.nid); n.read = true; D.save(); ui.closeModal(); }));
        ui.qs('#readAll', m).onclick = () => { D.state.notifs.forEach(n => { if (n.user === u.id) n.read = true; }); D.save(); ui.closeModal(); render(); };
      }
    });
  }
  function openProto() {
    const u = D.me();
    ui.modal({
      title: 'Kontrol prototipe', wide: true,
      sub: 'Bukan bagian aplikasi produksi. Ganti pengguna untuk mencoba setiap role dan cakupan wilayah.',
      body: '<div class="userpick">' + D.state.users.filter(x => x.aktif).map(x => userCard(x, x.id === u.id)).join('') + '</div>' +
        '<hr class="divider" style="margin:20px 0"><div class="row wrap"><button class="btn btn--secondary" id="pReset">' + ui.icon('refresh') + 'Reset data prototipe</button><a class="btn btn--ghost" href="#/offline" data-close>' + ui.icon('wifi-off') + 'Lihat halaman offline PWA</a><span class="t-xs grow">Batas wilayah: BIG (Batas Desa/Kelurahan 2022). Objek, WP, pembayaran: fiktif.</span></div>',
      onOpen: m => {
        ui.qsa('[data-login]', m).forEach(b => b.onclick = () => { ui.closeModal(); login(b.dataset.login, true); });
        ui.qs('#pReset', m).onclick = () => ui.confirm({ title: 'Reset data prototipe?', sub: 'Semua usulan, temuan, verifikasi, dan pengaturan yang Anda buat akan dikembalikan ke kondisi awal.', danger: true, okLabel: 'Reset', onOk: () => { const id = D.me().id; D.reset(); D.state.sessionUser = id; D.save(); render(); ui.toast('Data prototipe dikembalikan ke kondisi awal.'); } });
      }
    });
  }
  function userCard(x, active) {
    const kec = x.kec === 'all' ? 'Seluruh Kabupaten Tegal (18 kecamatan)' : x.kec.map(k => D.KEC_BY[k].nama).join(', ');
    return '<button class="usercard' + (active ? ' is-active' : '') + '" data-login="' + x.id + '"><div class="row" style="gap:10px"><div class="avatar avatar--teal">' + initials(x.nama) + '</div><div style="text-align:left;min-width:0"><div class="usercard__n">' + UI.esc(x.nama) + '</div><div class="t-xs">' + UI.esc(x.jabatan) + '</div></div></div>' +
      '<div style="margin-top:10px">' + UI.bRole(x.role) + '</div><div class="t-xs usercard__w">' + UI.icon('globe') + ' ' + UI.esc(kec) + '</div></button>';
  }
  function login(id, switching) {
    D.state.sessionUser = id; D.save(); D.audit('login', switching ? 'Berganti pengguna (kontrol prototipe)' : 'Masuk ke aplikasi'); D.save();
    if (location.hash !== '#/dashboard') location.hash = '#/dashboard'; else render();
    ui.toast('Masuk sebagai <b>' + ui.esc(D.me().nama) + '</b> — ' + D.ROLES[D.me().role].nama + '.', 'success');
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = h.split('?'); const parts = path.split('/');
    const q = {}; (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { name: parts[0], params: parts.slice(1), q };
  }
  function render() {
    cleanup.forEach(fn => { try { fn(); } catch (e) { } }); cleanup = [];
    ui.closeModal();
    const r = parseHash(); const root = ui.qs('#root');
    if (r.name === 'logout') { if (D.me()) { D.audit('logout', 'Keluar dari aplikasi'); } D.state.sessionUser = null; D.save(); location.hash = '#/login'; return; }
    if (!D.me() || r.name === 'login') { if (D.me() && r.name === 'login') { location.hash = '#/dashboard'; return; } root.innerHTML = ''; pages.login.render(root, r); document.title = 'Masuk — ' + D.state.cfg.appName; return; }
    const p = pages[r.name] || pages.notfound;
    current = r;
    const allowed = !p.perm || [].concat(p.perm).some(x => D.can(x));
    const title = typeof p.title === 'function' ? p.title(r) : p.title;
    document.title = title + ' — ' + D.state.cfg.appName;
    let hid = false; try { hid = localStorage.getItem('gispajak.sidebarHidden') === '1'; } catch (e) { }
    root.innerHTML = '<div class="app' + (p.full ? ' app--full' : '') + (hid ? ' is-sidehidden' : '') + '"><aside class="sidebar" aria-label="Menu">' + sidebar(p.nav || r.name) + '</aside><div class="navscrim"></div><div class="main"><header class="header">' + header(title, p.crumb) + '</header><div class="' + (p.full ? 'content--flush' : 'content') + '" id="page"></div></div></div>' +
      bottomNav(p.nav || r.name, r) + '<div class="offbanner" id="offBanner" hidden>' + ui.icon('wifi-off') + ' Koneksi terputus — data objek dan pengiriman survei memerlukan koneksi.</div>';
    wireShell(); updateOnline();
    const el = ui.qs('#page');
    if (!allowed) { el.innerHTML = forbidden(); return; }
    try { p.render(el, r); } catch (e) { console.error(e); el.innerHTML = ui.state({ tone: 'danger', icon: 'alert', title: 'Terjadi kesalahan pada halaman', desc: ui.esc(e.message) }); }
    enhanceMobile(el);
    window.scrollTo(0, 0);
  }
  /* ---------- Navigasi bawah (mobile / PWA) ---------- */
  const BOTTOM = {
    petugas: [['dashboard', 'Beranda', 'home', '#/dashboard'], ['peta', 'Peta', 'map', '#/peta'], ['tugas', 'Tugas', 'clipboard', '#/tugas', 'tugasSaya'], ['koordinat', 'Koordinat', 'pin', '#/koordinat', 'koordinat']],
    supervisor: [['dashboard', 'Beranda', 'home', '#/dashboard'], ['peta', 'Peta', 'map', '#/peta'], ['koordinat', 'Verifikasi', 'shield', '#/koordinat?tab=verif', 'koordinat'], ['calon', 'Temuan', 'plus', '#/calon', 'calon']],
    viewer: [['dashboard', 'Beranda', 'home', '#/dashboard'], ['peta', 'Peta', 'map', '#/peta'], ['wilayah', 'Wilayah', 'globe', '#/wilayah'], ['laporan', 'Laporan', 'chart', '#/laporan']],
    admin: [['dashboard', 'Beranda', 'home', '#/dashboard'], ['akun', 'Akun', 'users', '#/akun'], ['audit', 'Audit', 'activity', '#/audit'], ['pengaturan', 'Pengaturan', 'settings', '#/pengaturan']]
  };
  function bottomNav(active) {
    const u = D.me(); const c = counts(); const items = BOTTOM[u.role] || BOTTOM.viewer;
    return '<nav class="bottomnav" aria-label="Navigasi utama">' + items.map(it => '<a class="bottomnav__it' + (it[0] === active ? ' is-active" aria-current="page"' : '"') + ' href="' + it[3] + '">' + ui.icon(it[2]) + (it[4] && c[it[4]] ? '<span class="bottomnav__n">' + c[it[4]] + '</span>' : '') + '<span>' + it[1] + '</span></a>').join('') +
      '<button class="bottomnav__it" id="bnMore" aria-label="Menu lainnya">' + ui.icon('menu') + '<span>Lainnya</span></button></nav>';
  }
  /* ---------- Penyesuaian otomatis di layar kecil ---------- */
  const mq = window.matchMedia('(max-width: 768px)');
  function enhanceMobile(el) {
    const more = ui.qs('#bnMore'); if (more) more.onclick = () => ui.qs('.app').classList.add('is-navopen');
    ui.qsa('.filterbar', el).forEach((fb, i) => {
      if (fb.dataset.mobiled) return; fb.dataset.mobiled = 1;
      const fields = ui.qsa('input,select', fb);
      const active = () => fields.filter(x => x.type === 'checkbox' ? x.checked : (x.value && x.type !== 'date')).length;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn--secondary btn--block filtertoggle';
      const label = () => { const n = active(); btn.innerHTML = ui.icon('filter') + 'Filter & pencarian' + (n ? ' <span class="pill-n">' + n + '</span>' : '') + ui.icon(fb.classList.contains('is-mopen') ? 'chevron-down' : 'chevron-right'); };
      btn.onclick = () => { fb.classList.toggle('is-mopen'); label(); };
      fields.forEach(x => x.addEventListener('change', label));
      fb.parentNode.insertBefore(btn, fb); label();
    });
  }
  /* ---------- Instal PWA ---------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.documentElement.classList.add('can-install'); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; document.documentElement.classList.remove('can-install'); ui.toast('Aplikasi terpasang di layar utama.'); });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone()) document.documentElement.classList.add('is-standalone');
  document.addEventListener('click', (e) => { if (e.target.closest('[data-install]')) { e.preventDefault(); install(); } });
  async function install() {
    if (deferredPrompt) { deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; document.documentElement.classList.remove('can-install'); if (r.outcome === 'accepted') D.audit('pwa.instal', 'Memasang aplikasi ke layar utama'); return; }
    ui.modal({ title: 'Pasang aplikasi di HP', sub: standalone() ? 'Aplikasi sudah berjalan dalam mode terpasang.' : 'Browser belum menawarkan pemasangan otomatis. Pasang secara manual:',
      body: '<ol class="t-sm" style="margin:0;padding-left:18px;line-height:1.9"><li><b>Android (Chrome):</b> menu ⋮ → <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.</li><li><b>iPhone (Safari):</b> tombol Bagikan → <b>Tambah ke Layar Utama</b>.</li><li>Buka dari ikon <b>GIS Pajak</b>; aplikasi tampil layar penuh tanpa bilah alamat.</li></ol><p class="t-xs mt">Syarat: diakses lewat HTTPS. Data pajak tetap tidak disimpan di perangkat.</p>', foot: '<button class="btn btn--primary" data-close>Mengerti</button>' });
  }

  function forbidden() {
    return '<div style="max-width:560px;margin:48px auto">' + ui.state({ tone: 'warning', icon: 'lock', title: '403 — Tidak memiliki akses', desc: 'Role <b>' + ui.esc(D.ROLES[D.me().role].nama) + '</b> tidak memiliki izin untuk halaman ini. Pemeriksaan dilakukan di server untuk setiap permintaan, bukan sekadar menyembunyikan menu.', action: '<a class="btn btn--primary" href="#/dashboard" style="margin-top:12px">Kembali ke Dashboard</a>' }) + '</div>';
  }
  function updateOnline() { const b = ui.qs('#offBanner'); if (b) b.hidden = navigator.onLine; }
  window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && D.me()) { const t = document.getElementById('navToggle'); if (t) { e.preventDefault(); t.click(); } } });

  return {
    NAV, page: (name, def) => { pages[name] = def; }, render, rerender: render, onLeave: (fn) => cleanup.push(fn), login, userCard, initials, forwardQueue, counts,
    get route() { return current; }, forbidden, install, standalone, isMobile: () => mq.matches
  };
})();
