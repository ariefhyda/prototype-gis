# Prototipe GIS Pajak — Bapenda Kab. Tegal

Prototipe interaktif (HTML + JS vanilla + Leaflet) untuk PRD GIS Pajak (dokumen PRD disimpan terpisah dari repo ini). Mencakup semua role dan alur GIS-F01–F14.

## Menjalankan

```bash
python3 -m http.server 5178
```

Buka http://localhost:5178. Bisa juga dibuka langsung lewat `file://`, tetapi PWA/service worker hanya aktif di http(s).

## Akun contoh (masuk cepat di halaman login)

| Pengguna | Role | Cakupan |
|---|---|---|
| Rina Kusumawati | Administrator | Seluruh kabupaten |
| Budi Santoso | Supervisor/Verifikator | 10 kecamatan utara |
| Dewi Lestari | Supervisor/Verifikator | 8 kecamatan selatan |
| Andi Pratama | Petugas Lapangan | Slawi, Dukuhwaru, Pangkah |
| Sari Wulandari | Petugas Lapangan | Adiwerna, Talang, Dukuhturi |
| Joko Susilo | Petugas Lapangan | Balapulang, Pagerbarang, Lebaksiu |
| Hendra Wijaya | Viewer/Monitoring | Seluruh kabupaten |

Kontrol prototipe (tombol kuning di header) dipakai untuk berganti pengguna dan me-reset data.

## Sumber data

- **Batas wilayah:** data nyata BIG, Batas Desa/Kelurahan 2022. Datanya (287 desa) dibangun ulang dengan pipeline mapshaper di proyek induk menjadi TopoJSON di `assets/js/geo-tegal.js` (±290 KB). Langkah pembangunannya:
  - Topologi diperbaiki dan 3 serpihan digitasi (<100 m²) dibuang.
  - Garis disederhanakan secara topologis (Douglas-Peucker 4 m), sehingga batas desa yang bersebelahan tetap berimpit.
  - Kecamatan dan kabupaten dibentuk dengan menggabungkan (*dissolve*) desa.
  - Hasilnya tanpa celah atau tumpang-tindih, dengan deviasi garis ≤ 4 m dari data asli.
  - Kode `33.28.KK.DDDD` dicocokkan ke `NO_KEC_OP`/`NO_KEL_OP` di `BSG_OP`.
- **Objek, wajib pajak, pembayaran, usulan, temuan:** fiktif, dibangkitkan secara deterministik di `assets/js/data.js`. Data asli Bapenda tidak dipakai dan tidak disertakan.
- **Penyimpanan:** perubahan disimpan di `localStorage` peramban.

## Struktur

```
/
├── index.html, manifest.webmanifest, sw.js, offline.html
├── assets/css/   tokens/components/layout (design kit) + app.css
└── assets/js/    geo-tegal.js, icons.js, data.js, ui.js, maps.js, pages/*.js
```
