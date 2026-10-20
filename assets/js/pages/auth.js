/* Login, 404, halaman offline (pratinjau PWA) */
(function () {
  const ui = UI;
  App.page('login', {
    render(root) {
      const cfg = D.state.cfg;
      const agg = D.aggregate(D.OP, D.state.tahun);
      root.innerHTML = '<div class="login"><div class="login__brand"><div class="login__map" id="loginMap"></div><div class="login__brandin">' +
        '<div class="row" style="gap:12px"><div class="logo-badge logo-badge--light">LOGO</div><div><div style="font-weight:700">' + ui.esc(cfg.instName) + '</div><div style="font-size:12px;opacity:.75">Sistem internal — akses terbatas pegawai</div></div></div>' +
        '<div class="login__title">' + ui.esc(cfg.appName) + '</div><div class="login__lead">Pemetaan objek pajak, pencarian objek di sekitar petugas, survei & verifikasi koordinat, serta temuan calon objek pajak di 18 kecamatan dan 287 desa/kelurahan Kabupaten Tegal.</div>' +
        '<div class="login__facts"><div class="login__fact"><b>18</b><span>Kecamatan</span></div><div class="login__fact"><b>287</b><span>Desa / kelurahan</span></div><div class="login__fact"><b>' + ui.num(agg.total) + '</b><span>Objek pajak (simulasi)</span></div></div>' +
        '</div></div><div class="login__pane"><div class="login__form">' +
        '<div class="t-h2">Masuk</div><p class="t-sm" style="margin-top:4px">Gunakan akun pegawai yang diberikan administrator. Tanpa biometrik.</p>' +
        '<form id="lf" class="stack" style="margin-top:18px" autocomplete="off"><div class="field"><label class="field__label" for="lu">Username atau NIP</label><input class="input" id="lu" placeholder="mis. andi.lap"></div>' +
        '<div class="field"><label class="field__label" for="lp">Kata sandi</label><input class="input" id="lp" type="password" placeholder="Prototipe: kata sandi tidak diperiksa"></div>' +
        '<div class="field__error" id="lerr" hidden>Username atau kata sandi tidak sesuai.</div>' +
        '<button class="btn btn--primary btn--block btn--lg" type="submit">' + ui.icon('lock') + 'Masuk</button>' +
        '<p class="t-xs">Batas 5 kali gagal per 15 menit. Sesi berakhir setelah 30 menit tidak aktif.</p></form>' +
        '<div class="auth__split">atau masuk cepat sebagai (khusus prototipe)</div>' +
        '<div class="userpick">' + D.state.users.filter(u => u.aktif).map(u => App.userCard(u)).join('') + '</div>' +
        '<p class="t-xs" style="margin-top:16px">' + ui.icon('info') + ' Data objek, wajib pajak, dan pembayaran adalah <b>fiktif</b>. Batas wilayah memakai data BIG (Batas Desa/Kelurahan 2022).</p>' +
        '</div></div></div>';
      ui.qsa('[data-login]', root).forEach(b => b.onclick = () => App.login(b.dataset.login));
      ui.qs('#lf', root).onsubmit = (e) => {
        e.preventDefault(); const v = ui.qs('#lu').value.trim().toLowerCase();
        const u = D.state.users.find(x => x.aktif && (x.username === v || x.nip === v));
        if (!u) { ui.qs('#lerr').hidden = false; return; }
        App.login(u.id);
      };
      setTimeout(() => {
        const map = M.create(ui.qs('#loginMap'), { base: 'light', zoomPos: 'topright' });
        map.dragging.disable(); map.scrollWheelZoom.disable(); map.doubleClickZoom.disable();
        const st = M.desaStats(D.state.tahun);
        M.desaLayer(map, { hover: false, tooltip: false, style: f => { const d = D.DESA_BY[f.properties.kec + '-' + f.properties.kel]; return { fillColor: M.colorFor('kepadatan', M.scaleValue('kepadatan', st[d.id], d)), fillOpacity: 0.8, color: '#fff', weight: 0.6 }; } });
        M.kecLayer(map, { tooltip: false, hover: false, style: () => ({ color: '#0E2338', weight: 1.4 }) });
        App.onLeave(() => map.remove());
      }, 30);
    }
  });

  App.page('notfound', { title: 'Halaman tidak ditemukan', render(el) { el.innerHTML = '<div style="max-width:520px;margin:48px auto">' + ui.state({ icon: 'search', title: '404 — Halaman tidak ditemukan', desc: 'Tautan mungkin sudah berubah.', action: '<a class="btn btn--primary" href="#/dashboard" style="margin-top:12px">Ke Dashboard</a>' }) + '</div>'; } });

  App.page('offline', {
    title: 'Mode Offline & PWA', crumb: 'Pratinjau PWA', nav: 'pengaturan',
    render(el) {
      el.innerHTML = '<div class="pagehead"><div><div class="pagehead__title">PWA & perilaku offline</div><p class="pagehead__desc">GIS Pajak dapat dipasang dari Chrome Android ke layar utama. Saat koneksi terputus, hanya app shell dan halaman pemberitahuan yang tersedia — data pajak tidak disimpan di perangkat.</p></div></div>' +
        '<div class="grid2"><div class="card"><div class="card__head"><div><div class="card__title">Tampilan saat koneksi terputus</div><div class="card__sub">Disajikan service worker dari cache app shell</div></div></div><div class="card__body"><div class="phone"><div class="phone__bar"><span>09.41</span><span>' + ui.icon('wifi-off') + '</span></div><div style="padding:28px 18px;text-align:center" class="stack"><img src="./assets/img/icon.svg" width="56" height="56" style="margin:0 auto" alt=""><div class="t-h3">Koneksi terputus</div><p class="t-sm">GIS Pajak memerlukan koneksi untuk menampilkan data objek, status pembayaran, dan mengirim hasil survei.</p><p class="t-xs">Isian yang belum terkirim tetap ada selama tab tidak ditutup.</p><button class="btn btn--primary btn--block">Coba lagi</button></div></div></div></div>' +
        '<div class="card"><div class="card__head"><div class="card__title">Yang di-cache vs tidak</div></div><div class="card__body stack">' +
        '<div class="note note--ok">' + ui.icon('check-circle') + '<div><b>Disimpan (precache):</b> CSS/JS hasil build, font, ikon & logo, halaman <code>/offline</code>, manifest.</div></div>' +
        '<div class="note note--danger">' + ui.icon('x') + '<div><b>Tidak pernah di-cache:</b> respons API objek, wajib pajak, pembayaran, foto survei, dan halaman data (NetworkOnly).</div></div>' +
        '<div class="note note--warn">' + ui.icon('alert') + '<div><b>Di luar lingkup awal:</b> peta offline, draf survei offline, sinkronisasi latar belakang.</div></div>' +
        '<div class="note">' + ui.icon('logout') + '<div>Saat keluar, Cache Storage terkait sesi & penyimpanan lokal aplikasi dibersihkan.</div></div>' +
        '<div class="hr"></div><div class="t-h4">Cara memasang di Android</div><ol class="t-sm" style="margin:0;padding-left:18px;line-height:1.8"><li>Buka alamat GIS Pajak di Chrome (HTTPS).</li><li>Ketuk menu ⋮ → <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b>.</li><li>Buka dari ikon; aplikasi berjalan tanpa bilah alamat (standalone).</li></ol>' +
        '<div class="row wrap"><button class="btn btn--primary" data-install>' + ui.icon('smartphone') + 'Pasang aplikasi</button>' + '<a class="btn btn--secondary" href="./offline.html" target="_blank">' + ui.icon('eye') + 'Buka halaman offline asli</a></div></div></div></div>';
    }
  });
})();
