# Toko Foto Sederhana — Cloudflare Workers + D1

Website katalog sederhana untuk **memajang foto produk**. Admin masuk dengan PIN, lalu bisa menambah dan menghapus foto. Tidak ada keranjang, pembayaran, atau checkout.

Warna tema mengikuti gambar referensi: hijau teal gelap `#0B3D3B` dan oranye bata `#BD5121`, dengan latar krem.

## Catatan penyimpanan gambar

Sesuai permintaan, file foto disimpan sebagai BLOB langsung di Cloudflare D1. Agar pemakaian D1 lebih masuk akal, unggahan dibatasi **1,5 MB per foto** dan hanya menerima JPG, PNG, atau WebP. D1 lebih cocok untuk data terstruktur daripada file media; jika nanti jumlah foto atau ukurannya bertambah, Cloudflare R2 lebih cocok untuk gambar, sedangkan D1 menyimpan nama/keterangan.

## Persiapan

1. Pasang Node.js versi LTS.
2. Instal Wrangler:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Buat database:
   ```bash
   npx wrangler d1 create toko-foto-db
   ```
4. Salin `database_id` dari output ke `wrangler.toml`, menggantikan `GANTI_DENGAN_DATABASE_ID`.
5. Buat tabel:
   ```bash
   npx wrangler d1 execute toko-foto-db --remote --file=./schema.sql
   ```
6. Tetapkan PIN admin sebagai secret (jangan simpan PIN dalam kode atau repositori):
   ```bash
   npx wrangler secret put ADMIN_PIN
   ```
   Masukkan PIN yang kuat saat diminta. Walau disebut PIN, gunakan kombinasi panjang/acak karena ini melindungi konsol admin.
7. (Opsional) Ganti `STORE_NAME` di `wrangler.toml`.
8. Jalankan lokal:
   ```bash
   npx wrangler dev
   ```
   Untuk database lokal, buat tabel lokal dengan:
   ```bash
   npx wrangler d1 execute toko-foto-db --local --file=./schema.sql
   ```
9. Deploy:
   ```bash
   npx wrangler deploy
   ```

## Fitur

- Galeri produk responsif untuk ponsel dan desktop.
- Konsol admin dilindungi PIN secret Cloudflare.
- Tambah foto, nama, dan keterangan.
- Hapus foto dari konsol admin.
- Foto disimpan langsung sebagai BLOB di D1.
- Sesi admin bertahan 8 jam menggunakan cookie HttpOnly, Secure, dan SameSite Strict.

## Struktur

- `src/index.js` — Worker API dan UI.
- `schema.sql` — tabel D1.
- `wrangler.toml` — konfigurasi deployment.

## Pengamanan dan batasan

- Gunakan PIN acak yang panjang, jangan PIN umum seperti `1234`.
- Pastikan database dan secret dibuat pada akun Cloudflare Anda sendiri.
- Batasi ukuran foto untuk mengurangi risiko cepat menghabiskan kuota D1.
- Endpoint foto bersifat publik karena katalog memang ditujukan untuk pengunjung.
- Ini starter sederhana; untuk toko yang trafiknya besar, pertimbangkan Cloudflare R2, rate limiting login, dan optimasi gambar.
