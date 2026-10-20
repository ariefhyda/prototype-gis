/* ============================================================
   GIS Pajak — Lapisan data prototipe
   ------------------------------------------------------------
   • Batas wilayah: BIG (batas desa/kelurahan 2022) — data nyata,
     dimuat dari geo-tegal.js (window.GEO_TEGAL).
   • Objek pajak, wajib pajak, pembayaran, usulan, temuan: SEMUA
     FIKTIF, dibangkitkan deterministik (seeded). Tidak memakai
     data BSG_OP / BSG_WP riil.
   • Perubahan (usulan, verifikasi, dsb.) disimpan di localStorage.
   ============================================================ */
window.D = (function () {
  'use strict';
  const GEO = window.GEO_TEGAL;
  const LS_KEY = 'gispajak.proto.v1';
  const TODAY = new Date(2026, 9, 19, 9, 0); // acuan "hari ini" prototipe

  /* ---------------- PRNG ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = mulberry32(20261019);
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pad = (n, w) => String(n).padStart(w, '0');
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

  /* ---------------- Geometri ---------------- */
  function ringContains(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function polyContains(geom, lng, lat) {
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    return polys.some(function (p) {
      if (!ringContains(p[0], lng, lat)) return false;
      for (let k = 1; k < p.length; k++) if (ringContains(p[k], lng, lat)) return false;
      return true;
    });
  }
  function bbox(geom) {
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    let b = [180, 90, -180, -90];
    polys.forEach(p => p[0].forEach(c => { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }));
    return b;
  }
  function randomIn(geom, bb) {
    for (let i = 0; i < 80; i++) {
      const x = bb[0] + rnd() * (bb[2] - bb[0]), y = bb[1] + rnd() * (bb[3] - bb[1]);
      if (polyContains(geom, x, y)) return [y, x];
    }
    return null;
  }
  function haversine(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* ---------------- Wilayah (data BIG) ---------------- */
  const KEC = GEO.kecamatan.features.map(f => ({ kec: f.properties.kec, kode: f.properties.kode, nama: f.properties.nama, jmlDesa: f.properties.jmlDesa, center: [f.properties.cy, f.properties.cx], geom: f.geometry }));
  const KEC_BY = {}; KEC.forEach(k => KEC_BY[k.kec] = k);
  const DESA = GEO.desa.features.map(f => {
    const p = f.properties;
    return { id: p.kec + '-' + p.kel, kode: p.kode, kec: p.kec, kel: p.kel, nama: p.nama, kecNama: p.kecNama, tipe: p.tipe, luas: p.luas, center: [p.cy, p.cx], geom: f.geometry, bb: bbox(f.geometry) };
  });
  const DESA_BY = {}; DESA.forEach(d => DESA_BY[d.id] = d);
  function desaAt(lat, lng) { return DESA.find(d => lng >= d.bb[0] && lng <= d.bb[2] && lat >= d.bb[1] && lat <= d.bb[3] && polyContains(d.geom, lng, lat)) || null; }
  function inKab(lat, lng) { return polyContains(GEO.kab.geometry, lng, lat); }

  /* ---------------- Referensi (fiktif) ---------------- */
  const JENIS = [
    { id: 1, kode: 'MM', nama: 'PBJT Makanan & Minuman', short: 'Makan & Minum', w: 34 },
    { id: 2, kode: 'HTL', nama: 'PBJT Jasa Perhotelan', short: 'Perhotelan', w: 5 },
    { id: 3, kode: 'PKR', nama: 'PBJT Jasa Parkir', short: 'Parkir', w: 7 },
    { id: 4, kode: 'HBR', nama: 'PBJT Kesenian & Hiburan', short: 'Hiburan', w: 5 },
    { id: 5, kode: 'RKL', nama: 'Pajak Reklame', short: 'Reklame', w: 24 },
    { id: 6, kode: 'ABT', nama: 'Pajak Air Tanah', short: 'Air Tanah', w: 12 },
    { id: 7, kode: 'MBLB', nama: 'Pajak MBLB', short: 'MBLB', w: 4 },
    { id: 8, kode: 'WLT', nama: 'Pajak Sarang Burung Walet', short: 'Walet', w: 9 }
  ];
  const JENIS_BY = {}; JENIS.forEach(j => JENIS_BY[j.id] = j);
  const TAHUN = [2024, 2025, 2026];
  const TAHUN_BERJALAN = 2026;

  const STATUS_BAYAR = {
    LUNAS: { label: 'Lunas', badge: 'badge--success', ikon: 'check-circle', color: '#21883C' },
    SEBAGIAN: { label: 'Bayar sebagian', badge: 'badge--warning', ikon: 'clock', color: '#B77800' },
    BELUM_LUNAS: { label: 'Belum lunas', badge: 'badge--danger', ikon: 'alert', color: '#C62828' },
    TIDAK_TERSEDIA: { label: 'Data belum tersedia', badge: 'badge--neutral badge--pattern', ikon: 'help', color: '#7A8797' }
  };
  const KUALITAS = {
    VALID: { label: 'Koordinat valid', short: 'Valid', badge: 'badge--success', ikon: 'check-circle', color: '#21883C' },
    GIS: { label: 'Terverifikasi GIS', short: 'GIS', badge: 'badge--teal', ikon: 'shield', color: '#087F8C' },
    PERLU_CEK: { label: 'Perlu dicek', short: 'Perlu cek', badge: 'badge--warning', ikon: 'alert', color: '#B77800' },
    INVALID: { label: 'Tidak valid', short: 'Invalid', badge: 'badge--danger', ikon: 'x', color: '#C62828' },
    KOSONG: { label: 'Tanpa koordinat', short: 'Kosong', badge: 'badge--neutral', ikon: 'pin', color: '#7A8797' }
  };
  const ST_USULAN = {
    DRAF: { label: 'Draf', badge: 'badge--neutral', ikon: 'edit' },
    DIAJUKAN: { label: 'Menunggu verifikasi', badge: 'badge--info', ikon: 'clock' },
    DIKEMBALIKAN: { label: 'Dikembalikan', badge: 'badge--warning', ikon: 'refresh' },
    DISETUJUI: { label: 'Disetujui', badge: 'badge--success', ikon: 'check-circle' },
    DITOLAK: { label: 'Ditolak', badge: 'badge--danger', ikon: 'x' },
    DIBATALKAN: { label: 'Dibatalkan', badge: 'badge--neutral', ikon: 'x' }
  };
  const ST_CALON = {
    BARU: { label: 'Baru', badge: 'badge--info', ikon: 'plus' },
    DALAM_VERIFIKASI: { label: 'Dalam verifikasi', badge: 'badge--teal', ikon: 'clock' },
    PERLU_KELENGKAPAN: { label: 'Perlu kelengkapan', badge: 'badge--warning', ikon: 'alert' },
    TERVERIFIKASI: { label: 'Terverifikasi', badge: 'badge--success', ikon: 'check-circle' },
    COCOK_OBJEK_LAMA: { label: 'Cocok objek lama', badge: 'badge--navy', ikon: 'building' },
    TIDAK_DILANJUTKAN: { label: 'Tidak dilanjutkan', badge: 'badge--neutral', ikon: 'x' }
  };
  const ST_TUGAS = {
    DRAF: { label: 'Draf', badge: 'badge--neutral', ikon: 'edit' },
    DITUGASKAN: { label: 'Ditugaskan', badge: 'badge--info', ikon: 'clipboard' },
    DIKERJAKAN: { label: 'Dikerjakan', badge: 'badge--teal', ikon: 'tool' },
    SELESAI: { label: 'Selesai', badge: 'badge--success', ikon: 'check-circle' },
    DIBATALKAN: { label: 'Dibatalkan', badge: 'badge--neutral', ikon: 'x' }
  };
  const ST_TERUS = {
    BELUM_DITERUSKAN: { label: 'Belum diteruskan', badge: 'badge--neutral', ikon: 'clock' },
    DITERUSKAN: { label: 'Diteruskan', badge: 'badge--info', ikon: 'arrow-right' },
    DITERAPKAN_DI_MASTER: { label: 'Diterapkan di master', badge: 'badge--success', ikon: 'check-circle' },
    DITOLAK_SISTEM_UTAMA: { label: 'Ditolak sistem utama', badge: 'badge--danger', ikon: 'x' }
  };

  /* ---------------- Role & izin ---------------- */
  const ROLES = {
    admin: { nama: 'Administrator', ikon: 'settings', desc: 'Mengelola akun, role, cakupan wilayah, konfigurasi, dan audit.' },
    supervisor: { nama: 'Supervisor / Verifikator', ikon: 'shield', desc: 'Membuat penugasan, memverifikasi usulan & temuan, meneruskan hasil.' },
    petugas: { nama: 'Petugas Lapangan', ikon: 'pin', desc: 'Survei: objek sekitar, usulan koordinat, foto, temuan calon objek.' },
    viewer: { nama: 'Viewer / Monitoring', ikon: 'eye', desc: 'Memantau peta, ringkasan, dan laporan (identitas tersamar).' }
  };
  const PERMS = {
    'map.view': ['supervisor', 'petugas', 'viewer'],
    'object.view': ['supervisor', 'petugas', 'viewer'],
    'object.detail': ['supervisor', 'petugas'],
    'taxpayer.view': ['supervisor', 'petugas'],
    'taxpayer.pii': ['supervisor'],
    'payment.view': ['supervisor', 'petugas', 'viewer'],
    'assignment.manage': ['supervisor'],
    'assignment.own': ['petugas'],
    'coordinate.propose': ['petugas', 'supervisor'],
    'candidate.create': ['petugas', 'supervisor'],
    'verification.decide': ['supervisor'],
    'forward.manage': ['supervisor', 'admin'],
    'report.view': ['supervisor', 'viewer', 'admin'],
    'report.export': ['supervisor', 'viewer'],
    'region.view': ['supervisor', 'viewer', 'admin', 'petugas'],
    'admin.users': ['admin'],
    'admin.config': ['admin'],
    'audit.view': ['admin']
  };
  const PERM_LABEL = {
    'map.view': 'Lihat peta', 'object.view': 'Lihat daftar objek', 'object.detail': 'Lihat detail objek', 'taxpayer.view': 'Lihat data wajib pajak',
    'taxpayer.pii': 'Buka data pribadi WP (NIK, HP, email)', 'payment.view': 'Lihat status pembayaran', 'assignment.manage': 'Kelola penugasan survei',
    'assignment.own': 'Kerjakan tugas sendiri', 'coordinate.propose': 'Ajukan koordinat', 'candidate.create': 'Catat calon objek',
    'verification.decide': 'Putuskan verifikasi', 'forward.manage': 'Kelola penerusan ke sistem utama', 'report.view': 'Lihat laporan',
    'report.export': 'Ekspor laporan', 'region.view': 'Lihat profil wilayah', 'admin.users': 'Kelola akun & role', 'admin.config': 'Ubah konfigurasi', 'audit.view': 'Lihat audit log'
  };
  const UTARA = [10, 11, 12, 13, 9, 18, 14, 15, 16, 17];
  const SELATAN = [1, 2, 3, 4, 5, 6, 7, 8];
  const USERS_SEED = [
    { id: 'u1', nama: 'Rina Kusumawati', nip: '198703122010012004', username: 'rina.admin', role: 'admin', kec: 'all', jabatan: 'Pranata Komputer — Bidang Pengelolaan Data', aktif: true },
    { id: 'u2', nama: 'Budi Santoso', nip: '197905082006041011', username: 'budi.spv', role: 'supervisor', kec: UTARA, jabatan: 'Kasubbid Pendataan Wilayah Utara', aktif: true },
    { id: 'u3', nama: 'Dewi Lestari', nip: '198211202009022003', username: 'dewi.spv', role: 'supervisor', kec: SELATAN, jabatan: 'Kasubbid Pendataan Wilayah Selatan', aktif: true },
    { id: 'u4', nama: 'Andi Pratama', nip: '199402162019031008', username: 'andi.lap', role: 'petugas', kec: [10, 18, 9], spv: 'u2', jabatan: 'Petugas Pendataan Lapangan', aktif: true },
    { id: 'u5', nama: 'Sari Wulandari', nip: '199607242020122012', username: 'sari.lap', role: 'petugas', kec: [11, 12, 13], spv: 'u2', jabatan: 'Petugas Pendataan Lapangan', aktif: true },
    { id: 'u6', nama: 'Joko Susilo', nip: '198909302015031002', username: 'joko.lap', role: 'petugas', kec: [4, 5, 6], spv: 'u3', jabatan: 'Petugas Pendataan Lapangan', aktif: true },
    { id: 'u7', nama: 'Hendra Wijaya', nip: '197201171998031005', username: 'hendra.kabid', role: 'viewer', kec: 'all', jabatan: 'Kepala Bidang Pendapatan', aktif: true }
  ];

  /* ---------------- Pembangkit objek & WP (fiktif) ---------------- */
  const DEPAN = ['Agus', 'Siti', 'Bambang', 'Nur', 'Eko', 'Sri', 'Hadi', 'Wahyu', 'Tri', 'Dwi', 'Rizky', 'Fajar', 'Ika', 'Yuli', 'Slamet', 'Rahmat', 'Putri', 'Indah', 'Ahmad', 'Teguh', 'Ratna', 'Dian', 'Heru', 'Lina', 'Bayu', 'Wati', 'Imam', 'Novi', 'Yanto', 'Endang'];
  const BELAKANG = ['Saputra', 'Rahayu', 'Hidayat', 'Wibowo', 'Setiawan', 'Lestari', 'Nugroho', 'Purnomo', 'Susanti', 'Prasetyo', 'Kurniawan', 'Wahyuni', 'Santoso', 'Hartono', 'Maulana', 'Utami', 'Firmansyah', 'Handayani', 'Suryadi', 'Pertiwi'];
  const JALAN = ['Jl. Raya', 'Jl. Pemuda', 'Jl. Merdeka', 'Jl. Diponegoro', 'Jl. Sudirman', 'Jl. Ahmad Yani', 'Jl. Pancasila', 'Jl. Kartini', 'Jl. Gajah Mada', 'Jl. Veteran', 'Jl. Pasar', 'Jl. Masjid', 'Jl. Kenanga', 'Jl. Melati', 'Jl. Flamboyan', 'Jl. Mawar'];
  const NAMA_OP = {
    1: [['Warung Makan', 'p'], ['RM Sate', 'p'], ['Soto', 'p'], ['Bakso', 'p'], ['Kedai Kopi', 'x'], ['Warteg', 'p'], ['Mie Ayam', 'p'], ['Rumah Makan', 'x'], ['Kupat Glabed', 'p'], ['Sate Kambing Muda', 'p'], ['Kafe', 'x'], ['Ayam Geprek', 'p']],
    2: [['Hotel', 'x'], ['Penginapan', 'x'], ['Guest House', 'x'], ['Homestay', 'p']],
    3: [['Parkir Pasar', 'd'], ['Parkir Minimarket', 'x'], ['Parkir Klinik', 'x'], ['Parkir Gedung Pertemuan', 'x']],
    4: [['Karaoke Keluarga', 'x'], ['Kolam Renang', 'x'], ['Wahana Wisata', 'x'], ['Futsal', 'x'], ['Billiard', 'x']],
    5: [['Reklame Billboard', 'j'], ['Reklame Neon Box', 'x'], ['Reklame Baliho', 'j'], ['Reklame Papan Nama', 'x']],
    6: [['Sumur Bor', 'x'], ['Air Tanah Pabrik', 'x'], ['Air Tanah Hotel', 'x'], ['Depot Air Isi Ulang', 'x']],
    7: [['Galian Pasir', 'd'], ['Tambang Batu', 'd'], ['Galian Tanah Urug', 'd']],
    8: [['Rumah Walet', 'p'], ['Gedung Walet', 'p']]
  };
  const SUFFIX = ['Sejahtera', 'Barokah', 'Makmur', 'Jaya', 'Sentosa', 'Mandiri', 'Lestari', 'Indah', 'Mulia', 'Abadi', 'Rejeki', 'Utama', 'Asri', 'Permai', 'Berkah'];
  const KEC_W = { 10: 3.2, 11: 3, 12: 2.4, 13: 2.4, 15: 2, 14: 1.8, 9: 1.6, 6: 1.5, 4: 1.3, 18: 1, 16: 1, 17: 0.9, 5: 0.9, 1: 0.9, 3: 0.8, 2: 0.7, 7: 0.7, 8: 0.6 };
  function weightedJenis() { const t = JENIS.reduce((a, j) => a + j.w, 0); let r = rnd() * t; for (const j of JENIS) { if ((r -= j.w) <= 0) return j; } return JENIS[0]; }

  const WP = [], OP = [];
  (function generate() {
    const N_WP = 1650;
    const desaPool = [];
    DESA.forEach(d => { const w = Math.round((KEC_W[d.kec] || 1) * 10); for (let i = 0; i < w; i++) desaPool.push(d); });
    let seqOp = 0;
    for (let i = 1; i <= N_WP; i++) {
      const d = pick(desaPool);
      const badan = rnd() < 0.22;
      const nm = pick(DEPAN) + ' ' + pick(BELAKANG);
      const wp = {
        idwp: String(500000 + i * 7), npwpd: 'P.2.' + pad(i * 13 % 99999, 7) + '.' + pad(d.kec, 2) + '.' + pad(d.kel % 100, 3),
        jenis: badan ? 'Badan' : 'Pribadi', nama: badan ? (pick(['CV', 'PT', 'UD']) + ' ' + pick(SUFFIX) + ' ' + pick(SUFFIX)) : nm,
        kontak: nm, alamat: pick(JALAN) + ' No. ' + int(1, 220), rt: int(1, 12), rw: int(1, 8), kec: d.kec, kel: d.kel,
        nik: '3328' + pad(d.kec, 2) + pad(int(1, 28), 2) + pad(int(1, 12), 2) + pad(int(60, 99), 2) + pad(int(1, 9999), 4),
        hp: '08' + pick(['12', '13', '21', '52', '57', '77', '96']) + pad(int(1000000, 99999999), 8),
        email: nm.toLowerCase().replace(/\s+/g, '.') + int(1, 99) + '@contoh.id',
        aktif: rnd() > 0.05, created: new Date(2015 + int(0, 10), int(0, 11), int(1, 27)), ops: []
      };
      WP.push(wp);
      const nOp = rnd() < 0.72 ? 1 : (rnd() < 0.7 ? 2 : 3);
      for (let k = 0; k < nOp; k++) {
        seqOp++;
        const dd = k === 0 ? d : (rnd() < 0.6 ? d : pick(desaPool));
        const j = weightedJenis();
        const tpl = pick(NAMA_OP[j.id]);
        const sfx = tpl[1] === 'p' ? ('Bu ' + pick(DEPAN)) : tpl[1] === 'd' ? dd.nama : tpl[1] === 'j' ? (pick(JALAN).replace('Jl. ', '')) : pick(SUFFIX);
        const pos = randomIn(dd.geom, dd.bb) || dd.center;
        // kualitas koordinat di master (simulasi)
        const r = rnd();
        let q, latRaw, lngRaw, lat = null, lng = null;
        if (r < 0.58) { q = 'VALID'; lat = pos[0]; lng = pos[1]; latRaw = lat.toFixed(6); lngRaw = lng.toFixed(6); }
        else if (r < 0.65) {
          q = 'PERLU_CEK';
          const other = pick(DESA); const p2 = rnd() < 0.5 ? other.center : [dd.center[0], dd.center[1]];
          lat = p2[0]; lng = p2[1]; latRaw = lat.toFixed(6); lngRaw = lng.toFixed(6);
        }
        else if (r < 0.73) {
          q = 'INVALID';
          const v = int(0, 3);
          if (v === 0) { latRaw = pos[1].toFixed(5); lngRaw = pos[0].toFixed(5); }
          else if (v === 1) { latRaw = pos[0].toFixed(5).replace('.', ','); lngRaw = pos[1].toFixed(5).replace('.', ','); }
          else if (v === 2) { latRaw = '6°58\'' + int(10, 59) + '"'; lngRaw = '109°' + int(1, 20) + '\''; }
          else { latRaw = '-7.0'; lngRaw = '0'; }
        }
        else { q = 'KOSONG'; latRaw = rnd() < 0.5 ? '' : '0'; lngRaw = latRaw; }
        const tutup = rnd() < 0.07;
        const op = {
          idop: String(9000000 + seqOp * 11), noOp: '3328' + pad(dd.kec, 3) + pad(dd.kel % 1000, 3) + pad(seqOp, 5) + j.id,
          idwp: wp.idwp, jenis: j.id, nama: tpl[0] + ' ' + sfx, alamat: pick(JALAN) + ' No. ' + int(1, 300), rt: int(1, 12), rw: int(1, 8),
          kec: dd.kec, kel: dd.kel, latRaw, lngRaw, q, mLat: lat, mLng: lng, truth: pos,
          aktif: !tutup, tglTutup: tutup ? new Date(2025, int(0, 11), int(1, 27)) : null,
          pj: pick(DEPAN) + ' ' + pick(BELAKANG), hpPj: '08' + pick(['12', '13', '57', '96']) + pad(int(1000000, 99999999), 8),
          created: new Date(2016 + int(0, 10), int(0, 11), int(1, 27)), omzet: j.id === 1 ? int(5, 120) * 1000000 : null
        };
        OP.push(op); wp.ops.push(op.idop);
      }
    }
  })();
  const OP_BY = {}; OP.forEach(o => OP_BY[o.idop] = o);
  const WP_BY = {}; WP.forEach(w => WP_BY[w.idwp] = w);

  /* ---------------- Pembayaran (fiktif, deterministik) ---------------- */
  function ketetapan(op, th) {
    const base = { 1: 2400000, 2: 9000000, 3: 1800000, 4: 6000000, 5: 1500000, 6: 3600000, 7: 12000000, 8: 4800000 }[op.jenis];
    return Math.round(base * (0.5 + hash(op.idop + 'k') * 2.5) * (1 + (th - 2024) * 0.06) / 1000) * 1000;
  }
  function bayarRaw(op, th) {
    if (th < op.created.getFullYear()) return { status: 'TIDAK_TERSEDIA', alasan: 'Belum terdaftar pada periode ini' };
    if (!op.aktif && op.tglTutup && th > op.tglTutup.getFullYear()) return { status: 'TIDAK_TERSEDIA', alasan: 'Objek tutup' };
    const h = hash(op.idop + ':' + th);
    const k = ketetapan(op, th);
    if (h < 0.14) return { status: 'TIDAK_TERSEDIA', alasan: 'Ketetapan periode tidak ditemukan pada sumber' };
    const pLunas = th === 2026 ? 0.52 : th === 2025 ? 0.74 : 0.8;
    if (h < 0.14 + pLunas) return { status: 'LUNAS', ketetapan: k, bayar: k, tgl: new Date(th, int0(h, 11), 1 + int0(h * 7, 26)) };
    if (h < 0.14 + pLunas + 0.08) return { status: 'SEBAGIAN', ketetapan: k, bayar: Math.round(k * 0.4 / 1000) * 1000, tgl: new Date(th, int0(h, 9), 10) };
    return { status: 'BELUM_LUNAS', ketetapan: k, bayar: 0 };
  }
  function int0(h, n) { return Math.floor((h * 1000 % 1) * (n + 1)); }
  function bayar(op, th) {
    if (!state.cfg.paymentConnected) return { status: 'TIDAK_TERSEDIA', alasan: 'Sumber data pembayaran belum terhubung', sumber: 'NullPaymentProvider' };
    const r = bayarRaw(op, th); r.sumber = 'V_GIS_PEMBAYARAN (simulasi)'; return r;
  }

  /* ---------------- Store (localStorage) ---------------- */
  const DEFAULT_CFG = {
    appName: 'Spasial Pajak Daerah', shortName: 'GIS Pajak', instName: 'Badan Pendapatan Daerah Kabupaten Tegal', instShort: 'Bapenda Kab. Tegal',
    alamat: 'Jl. Dr. Soetomo No. 1 Slawi, Kabupaten Tegal', kontak: '(0283) 000000',
    radiusList: [100, 250, 500, 1000], radiusDefault: 250, radiusMax: 2000, akurasiMax: 50, radiusDuplikat: 75,
    fotoMin: 1, fotoMax: 5, basemap: 'osm', paymentConnected: true, luarWilayahViaTugas: true, sumberKoordinat: 'GIS_LALU_MASTER', ttlBayar: 15
  };
  let state;
  function seedState() {
    rnd = mulberry32(777);
    const s = { v: 1, cfg: Object.assign({}, DEFAULT_CFG), users: USERS_SEED.map(u => Object.assign({}, u)), sessionUser: null, tahun: TAHUN_BERJALAN,
      proposals: [], candidates: [], assignments: [], verifications: [], locations: [], batches: [], forwards: [], audit: [], notifs: [], seq: { prop: 0, cand: 0, tugas: 0, batch: 0, audit: 0, notif: 0 }, jobs: [], revealed: {} };
    state = s;
    const daysAgo = (n, h) => new Date(TODAY.getTime() - n * 864e5 - (h || 0) * 36e5).toISOString();
    const userKec = (u) => USERS_SEED.find(x => x.id === u).kec;
    const noCoord = (kecs) => OP.filter(o => kecs.includes(o.kec) && (o.q === 'KOSONG' || o.q === 'INVALID') && o.aktif);
    const near = (p, m) => [p[0] + (rnd() - 0.5) * m / 111000, p[1] + (rnd() - 0.5) * m / 111000];

    // Penugasan
    const tA = newTugas({ judul: 'Lengkapi koordinat objek Kec. Slawi (kawasan kota)', instruksi: 'Survei seluruh objek tanpa koordinat di wilayah kelurahan; utamakan PBJT makan & minum.', petugas: ['u4'], tenggat: daysAgo(-6), prioritas: 'Tinggi', status: 'DIKERJAKAN', created_by: 'u2', created_at: daysAgo(9) }, OP.filter(o => o.kec === 10 && (o.q !== 'VALID')).slice(0, 14).map(o => o.idop));
    const tB = newTugas({ judul: 'Pemutakhiran reklame koridor Adiwerna–Talang', instruksi: 'Periksa titik reklame yang koordinatnya tertukar/tidak valid.', petugas: ['u5'], tenggat: daysAgo(-12), prioritas: 'Sedang', status: 'DITUGASKAN', created_by: 'u2', created_at: daysAgo(3) }, OP.filter(o => [11, 12].includes(o.kec) && o.jenis === 5 && o.q !== 'VALID').slice(0, 12).map(o => o.idop));
    const tC = newTugas({ judul: 'Sapu bersih objek tanpa koordinat Balapulang', instruksi: 'Objek tanpa koordinat di Balapulang. Catat juga usaha baru yang belum terdata.', petugas: ['u6'], tenggat: daysAgo(2), prioritas: 'Tinggi', status: 'DIKERJAKAN', created_by: 'u3', created_at: daysAgo(16) }, OP.filter(o => o.kec === 4 && o.q !== 'VALID').slice(0, 10).map(o => o.idop));

    // Usulan koordinat
    const mk = (op, by, status, ago, extra) => {
      const p = newProposal(Object.assign({ idop: op.idop, jenis: op.q === 'KOSONG' ? 'BARU' : 'KOREKSI', lat: near(op.truth, 20)[0], lng: near(op.truth, 20)[1], akurasi: int(4, 28), sumber: pick(['GPS', 'GPS', 'MANUAL', 'GPS_DISESUAIKAN']), observed_at: daysAgo(ago, 2), alasan: op.q === 'KOSONG' ? 'Koordinat belum ada di master' : 'Koordinat master tidak sesuai lokasi usaha', catatan: pick(['Usaha buka, pemilik di tempat.', 'Lokasi di depan pasar, sisi timur.', 'Papan nama terlihat jelas.', 'Masuk gang ±30 m dari jalan utama.']), status, created_by: by, submitted_at: daysAgo(ago), fotos: [fotoPlaceholder(op.nama, 0), fotoPlaceholder(op.nama, 1)] }, extra || {}));
      return p;
    };
    const a = noCoord([10]); const b = noCoord([11, 12, 13]); const c = noCoord([4, 5, 6]); const dd = noCoord([18, 9]);
    [a[0], a[1], a[2], a[3]].forEach((o, i) => { const p = mk(o, 'u4', 'DIAJUKAN', i, { tugas: tA.id }); linkTarget(tA, o.idop, 'DIAJUKAN'); });
    [a[4], a[5], a[6]].forEach((o, i) => { const p = mk(o, 'u4', 'DISETUJUI', 4 + i, { tugas: tA.id }); approveSeed(p, 'u2', daysAgo(3 + i)); linkTarget(tA, o.idop, 'DISETUJUI'); });
    { const p = mk(a[7], 'u4', 'DIKEMBALIKAN', 5, { tugas: tA.id, akurasi: 64 }); s.verifications.push({ id: 'v' + s.verifications.length, target: 'proposal', tid: p.id, keputusan: 'DIKEMBALIKAN', catatan: 'Akurasi 64 m terlalu rendah dan foto tampak depan kurang jelas. Mohon ambil ulang di depan bangunan.', by: 'u2', at: daysAgo(4) }); linkTarget(tA, a[7].idop, 'DIKEMBALIKAN'); }
    [b[0], b[1], b[2]].forEach((o, i) => mk(o, 'u5', 'DIAJUKAN', i + 1));
    [b[3], b[4]].forEach((o, i) => { const p = mk(o, 'u5', 'DISETUJUI', 8 + i); approveSeed(p, 'u2', daysAgo(6 + i)); });
    { const p = mk(b[5], 'u5', 'DITOLAK', 10); s.verifications.push({ id: 'v' + s.verifications.length, target: 'proposal', tid: p.id, keputusan: 'DITOLAK', catatan: 'Titik berada di objek lain (bengkel), bukan lokasi usaha yang dimaksud.', by: 'u2', at: daysAgo(9) }); }
    [c[0], c[1], c[2], c[3]].forEach((o, i) => { mk(o, 'u6', 'DIAJUKAN', i, { tugas: tC.id }); linkTarget(tC, o.idop, 'DIAJUKAN'); });
    [c[4], c[5]].forEach((o, i) => { const p = mk(o, 'u6', 'DISETUJUI', 7 + i, { tugas: tC.id }); approveSeed(p, 'u3', daysAgo(5 + i)); linkTarget(tC, o.idop, 'DISETUJUI'); });
    linkTarget(tC, c[6] && c[6].idop, 'TIDAK_DITEMUKAN');
    [dd[0], dd[1]].forEach((o, i) => { const p = mk(o, 'u4', 'DISETUJUI', 20 + i); approveSeed(p, 'u2', daysAgo(18 + i)); });

    // Calon objek
    const mc = (kec, by, status, ago, j, nm) => {
      const desas = DESA.filter(d => d.kec === kec); const d = pick(desas); const pos = randomIn(d.geom, d.bb) || d.center;
      return newCandidate({ nama: nm, deskripsi: pick(['Usaha baru buka ±3 bulan.', 'Ramai pengunjung sore hari, belum ada papan pajak.', 'Bangunan semi permanen di tepi jalan.', 'Pemilik bersedia didata lebih lanjut.']), dugaan: j, alamat: pick(JALAN) + ' No. ' + int(1, 200), kec: d.kec, kel: d.kel, lat: pos[0], lng: pos[1], akurasi: int(5, 25), sumber: 'GPS', pemilik: pick(DEPAN) + ' ' + pick(BELAKANG), kontak: '08' + pick(['12', '57']) + pad(int(1000000, 99999999), 8), skala: pick(['Mikro', 'Kecil', 'Menengah']), status, created_by: by, created_at: daysAgo(ago), noMatchAt: daysAgo(ago), fotos: [fotoPlaceholder(nm, 0)] });
    };
    mc(10, 'u4', 'BARU', 0, 1, 'Kedai Seblak Mbak Yuni');
    mc(10, 'u4', 'BARU', 1, 4, 'Arena Mini Soccer Slawi');
    mc(18, 'u4', 'DALAM_VERIFIKASI', 2, 1, 'Angkringan Kopi Joss Dukuhwaru');
    mc(11, 'u5', 'BARU', 1, 1, 'Ayam Bakar Pak Kumis');
    mc(12, 'u5', 'PERLU_KELENGKAPAN', 5, 5, 'Reklame LED Simpang Talang');
    mc(13, 'u5', 'TERVERIFIKASI', 9, 2, 'Kost Eksklusif Griya Dukuhturi');
    mc(11, 'u5', 'COCOK_OBJEK_LAMA', 12, 1, 'Warung Sate Bu Rini');
    mc(4, 'u6', 'BARU', 0, 8, 'Gedung Walet Baru Balapulang');
    mc(5, 'u6', 'TERVERIFIKASI', 7, 7, 'Galian Tanah Urug Pagerbarang');
    mc(6, 'u6', 'TIDAK_DILANJUTKAN', 14, 1, 'Lapak Gorengan Musiman');
    mc(9, 'u4', 'TERVERIFIKASI', 11, 1, 'Resto Lesehan Pangkah Asri');
    s.candidates.forEach(cd => {
      if (cd.status === 'COCOK_OBJEK_LAMA') { const m = OP.find(o => o.kec === cd.kec && o.jenis === 1); cd.matched = m && m.idop; s.verifications.push({ id: 'v' + s.verifications.length, target: 'candidate', tid: cd.id, keputusan: 'COCOK_OBJEK_LAMA', catatan: 'Sudah terdaftar dengan nama berbeda; koordinat master kosong.', matched: cd.matched, by: 'u2', at: daysAgo(10) }); }
      if (cd.status === 'PERLU_KELENGKAPAN') s.verifications.push({ id: 'v' + s.verifications.length, target: 'candidate', tid: cd.id, keputusan: 'PERLU_KELENGKAPAN', catatan: 'Mohon foto ukuran reklame dan identitas pemasang.', by: 'u2', at: daysAgo(4) });
      if (cd.status === 'TERVERIFIKASI') s.verifications.push({ id: 'v' + s.verifications.length, target: 'candidate', tid: cd.id, keputusan: 'TERVERIFIKASI', catatan: 'Layak diteruskan ke pendataan resmi.', by: cd.kec <= 8 ? 'u3' : 'u2', at: daysAgo(6) });
      if (cd.status === 'TIDAK_DILANJUTKAN') s.verifications.push({ id: 'v' + s.verifications.length, target: 'candidate', tid: cd.id, keputusan: 'TIDAK_DILANJUTKAN', catatan: 'Usaha musiman, sudah tidak beroperasi.', by: 'u3', at: daysAgo(12) });
    });

    // Satu batch penerusan lama
    const old = s.proposals.filter(p => p.status === 'DISETUJUI').slice(-2);
    const bt = { id: 'b1', no: 'FWD-20261003-01', jenis: 'koordinat', items: old.map(p => p.id), by: 'u2', at: daysAgo(16) };
    s.batches.push(bt); s.seq.batch = 1;
    old.forEach(p => s.forwards.push({ target: 'proposal', tid: p.id, status: 'DITERAPKAN_DI_MASTER', batch: 'b1', at: daysAgo(12) }));

    // Audit & notifikasi awal
    [['u2', 'verifikasi.setujui', 'Menyetujui usulan koordinat', 3], ['u7', 'laporan.ekspor', 'Ekspor laporan persebaran (XLSX)', 2], ['u1', 'konfigurasi.ubah', 'Mengubah ambang akurasi GPS menjadi 50 m', 6], ['u4', 'usulan.kirim', 'Mengirim usulan koordinat', 0], ['u2', 'wp.pii', 'Membuka data pribadi WP', 1], ['u1', 'job.kualitas', 'Menjalankan klasifikasi kualitas koordinat master', 1], ['u5', 'login', 'Masuk ke aplikasi', 0]]
      .forEach(x => s.audit.push({ id: ++s.seq.audit, user: x[0], aksi: x[1], ket: x[2], at: daysAgo(x[3], int(1, 8)), ip: '10.20.1.' + int(10, 90) }));
    s.jobs.push({ id: 1, proses: 'Klasifikasi kualitas koordinat master', at: daysAgo(1, 3), status: 'Berhasil', ringkasan: ringkasKualitas() });
    s.jobs.push({ id: 2, proses: 'Rekonsiliasi koordinat terverifikasi', at: daysAgo(12), status: 'Berhasil', ringkasan: '2 item diterapkan di master' });
    notify('u4', 'Usulan dikembalikan', 'Usulan koordinat untuk ' + OP_BY[a[7].idop].nama + ' perlu diperbaiki.', '#/usulan/' + s.proposals.find(p => p.status === 'DIKEMBALIKAN').id, daysAgo(4));
    notify('u5', 'Penugasan baru', tB.judul, '#/tugas/' + tB.id, daysAgo(3));
    notify('u2', 'Antrean verifikasi', '7 usulan koordinat menunggu keputusan Anda.', '#/koordinat?tab=verif', daysAgo(0));
    notify('u6', 'Tenggat mendekat', tC.judul + ' — tenggat 2 hari lagi.', '#/tugas/' + tC.id, daysAgo(0));
    rnd = mulberry32(4242);
    return s;

    function approveSeed(p, by, at) {
      s.verifications.push({ id: 'v' + s.verifications.length, target: 'proposal', tid: p.id, keputusan: 'DISETUJUI', catatan: 'Sesuai foto dan lokasi.', by, at });
      s.locations.push({ idop: p.idop, lat: p.lat, lng: p.lng, akurasi: p.akurasi, sumber: p.sumber, proposal: p.id, by, at, aktif: true });
    }
    function linkTarget(t, idop, st) { if (!idop) return; const tg = t.targets.find(x => x.idop === idop); if (tg) tg.status = st; }
  }
  function desaName(kec, kel) { const d = DESA_BY[kec + '-' + kel]; return d ? d.nama : ('Desa ' + kel); }
  function fotoPlaceholder(label, i) { return { ph: true, label: label, i: i }; }

  function load() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) { state = s; state.cfg = Object.assign({}, DEFAULT_CFG, s.cfg); return; } } } catch (e) { }
    state = seedState(); save();
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { console.warn('Penyimpanan peramban penuh/terblokir', e); } }
  function reset() { try { localStorage.removeItem(LS_KEY); } catch (e) { } state = seedState(); save(); }

  /* ---------------- Entitas operasional ---------------- */
  function newProposal(o) { state.seq.prop++; const p = Object.assign({ id: 'UK-' + pad(state.seq.prop, 5), created_at: o.submitted_at || new Date().toISOString(), fotos: [] }, o); state.proposals.push(p); return p; }
  function newCandidate(o) { state.seq.cand++; const c = Object.assign({ id: 'CO-2026-' + pad(state.seq.cand, 5), fotos: [] }, o); state.candidates.push(c); return c; }
  function newTugas(o, idops) { state.seq.tugas++; const t = Object.assign({ id: 'TGS-' + pad(state.seq.tugas, 4) }, o); t.targets = (idops || []).map(id => ({ idop: id, status: 'BELUM' })); state.assignments.push(t); return t; }
  function notify(user, judul, isi, href, at) { state.seq.notif++; state.notifs.push({ id: state.seq.notif, user, judul, isi, href, at: at || new Date().toISOString(), read: false }); }
  function audit(aksi, ket, target) { const u = me(); state.seq.audit++; state.audit.push({ id: state.seq.audit, user: u ? u.id : '-', aksi, ket, target: target || '', at: new Date().toISOString(), ip: '10.20.1.25' }); }

  /* ---------------- Sesi & akses ---------------- */
  function me() { return state.sessionUser ? state.users.find(u => u.id === state.sessionUser) : null; }
  function can(perm, u) { u = u || me(); if (!u) return false; const r = PERMS[perm]; return !!(r && r.includes(u.role)); }
  function userKecs(u) { u = u || me(); if (!u) return []; return u.kec === 'all' ? KEC.map(k => k.kec) : u.kec; }
  function inScope(op, u) {
    u = u || me(); if (!u) return false;
    if (u.kec === 'all' || u.kec.includes(op.kec)) return true;
    if (u.role === 'petugas' && state.cfg.luarWilayahViaTugas) return state.assignments.some(t => ['DITUGASKAN', 'DIKERJAKAN'].includes(t.status) && t.petugas.includes(u.id) && t.targets.some(x => x.idop === op.idop));
    return false;
  }
  function scopedOps(u) { return OP.filter(o => inScope(o, u)); }

  /* ---------------- Lokasi efektif objek ---------------- */
  function activeLoc(idop) { for (let i = state.locations.length - 1; i >= 0; i--) { const l = state.locations[i]; if (l.idop === idop && l.aktif) return l; } return null; }
  function effLoc(op) {
    const l = activeLoc(op.idop);
    if (l) return { lat: l.lat, lng: l.lng, q: 'GIS', sumber: 'Lokasi GIS terverifikasi', akurasi: l.akurasi, at: l.at, by: l.by };
    if (op.q === 'VALID') return { lat: op.mLat, lng: op.mLng, q: 'VALID', sumber: 'Koordinat master BSG_OP' };
    return { lat: null, lng: null, q: op.q, sumber: op.q === 'PERLU_CEK' ? 'Master (perlu dicek, tidak ditampilkan)' : 'Belum terpetakan' };
  }
  function activeProposal(idop) { return state.proposals.find(p => p.idop === idop && (p.status === 'DIAJUKAN' || p.status === 'DIKEMBALIKAN' || p.status === 'DRAF')); }
  function mapped(op) { return effLoc(op).lat != null; }

  /* ---------------- Parser & validasi koordinat ---------------- */
  function parseCoord(latRaw, lngRaw) {
    const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(',', '.');
    const a = clean(latRaw), b = clean(lngRaw);
    if (!a || !b || a === '0' || b === '0') return { q: 'KOSONG', alasan: 'Kolom kosong atau bernilai 0' };
    if (!/^-?\d+(\.\d+)?$/.test(a) || !/^-?\d+(\.\d+)?$/.test(b)) return { q: 'INVALID', alasan: 'Format tidak dapat dibaca sebagai desimal' };
    let lat = +a, lng = +b;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { q: 'INVALID', alasan: 'Di luar rentang lintang/bujur' };
    if (lat > 100 && lng < 0) return { q: 'INVALID', alasan: 'Lintang dan bujur tertukar' };
    if (Math.abs(lat) > 20 && Math.abs(lng) < 20) return { q: 'INVALID', alasan: 'Lintang dan bujur tertukar' };
    if (!inKab(lat, lng)) return { q: 'INVALID', alasan: 'Di luar batas Kabupaten Tegal', lat, lng };
    return { q: 'VALID', lat, lng };
  }
  function validatePoint(lat, lng, op) {
    const res = { ok: true, errors: [], warnings: [] };
    if (!inKab(lat, lng)) { res.ok = false; res.errors.push('Titik berada di luar batas Kabupaten Tegal.'); return res; }
    const d = desaAt(lat, lng);
    res.desa = d;
    if (op && d && d.kec !== op.kec) res.warnings.push('Titik berada di Kec. ' + d.kecNama + ', sedangkan objek terdaftar di Kec. ' + KEC_BY[op.kec].nama + '.');
    else if (op && d && d.kel !== op.kel) res.warnings.push('Titik berada di ' + d.tipe + ' ' + d.nama + ', berbeda dengan desa terdaftar (' + desaName(op.kec, op.kel) + ').');
    return res;
  }
  function ringkasKualitas() {
    const c = { VALID: 0, PERLU_CEK: 0, INVALID: 0, KOSONG: 0 }; OP.forEach(o => c[o.q]++);
    return c.VALID + ' valid · ' + c.PERLU_CEK + ' perlu cek · ' + c.INVALID + ' invalid · ' + c.KOSONG + ' kosong';
  }

  /* ---------------- Pencocokan duplikat ---------------- */
  function norm(s) { return String(s).toLowerCase().replace(/\b(warung|rm|rumah makan|kedai|bu|pak|mbak|cv|pt|ud|toko)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function trigram(a, b) {
    a = '  ' + norm(a) + ' '; b = '  ' + norm(b) + ' ';
    const g = s => { const r = new Set(); for (let i = 0; i < s.length - 2; i++) r.add(s.slice(i, i + 3)); return r; };
    const A = g(a), B = g(b); let n = 0; A.forEach(x => { if (B.has(x)) n++; });
    return n / Math.max(1, (A.size + B.size - n));
  }
  function duplicates(lat, lng, nama, radius) {
    radius = radius || state.cfg.radiusDuplikat;
    const out = [];
    OP.forEach(o => {
      const e = effLoc(o); let dist = null;
      if (e.lat != null) dist = haversine([lat, lng], [e.lat, e.lng]);
      const sim = nama ? trigram(nama, o.nama) : 0;
      const nearOk = dist != null && dist <= radius * 3;
      const nameOk = sim >= 0.34 && Math.abs(o.truth[0] - lat) < 0.02 && Math.abs(o.truth[1] - lng) < 0.02;
      if (nearOk || nameOk) {
        const score = (dist != null ? Math.max(0, 1 - dist / (radius * 3)) * 0.55 : 0) + sim * 0.45;
        out.push({ op: o, dist, sim, score, tanpaKoordinat: e.lat == null });
      }
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  /* ---------------- Agregat ---------------- */
  function aggregate(ops, th) {
    const r = { total: 0, aktif: 0, mapped: 0, gis: 0, valid: 0, perluCek: 0, invalid: 0, kosong: 0, bayar: { LUNAS: 0, SEBAGIAN: 0, BELUM_LUNAS: 0, TIDAK_TERSEDIA: 0 }, ketetapan: 0, realisasi: 0 };
    ops.forEach(o => {
      r.total++; if (o.aktif) r.aktif++;
      const e = effLoc(o);
      if (e.lat != null) r.mapped++;
      if (e.q === 'GIS') r.gis++; else if (e.q === 'VALID') r.valid++; else if (e.q === 'PERLU_CEK') r.perluCek++; else if (e.q === 'INVALID') r.invalid++; else r.kosong++;
      if (o.aktif) { const b = bayar(o, th); r.bayar[b.status]++; if (b.ketetapan) { r.ketetapan += b.ketetapan; r.realisasi += b.bayar || 0; } }
    });
    return r;
  }

  load();

  return {
    GEO, KEC, KEC_BY, DESA, DESA_BY, JENIS, JENIS_BY, TAHUN, TAHUN_BERJALAN, TODAY,
    STATUS_BAYAR, KUALITAS, ST_USULAN, ST_CALON, ST_TUGAS, ST_TERUS, ROLES, PERMS, PERM_LABEL,
    OP, OP_BY, WP, WP_BY,
    get state() { return state; }, save, reset, audit, notify, newProposal, newCandidate, newTugas,
    me, can, userKecs, inScope, scopedOps, effLoc, activeLoc, activeProposal, mapped,
    bayar, bayarRaw, ketetapan, parseCoord, validatePoint, desaAt, inKab, desaName, haversine, polyContains,
    duplicates, trigram, aggregate, ringkasKualitas, fotoPlaceholder,
    user: (id) => state.users.find(u => u.id === id) || { nama: '—', role: '' }
  };
})();
