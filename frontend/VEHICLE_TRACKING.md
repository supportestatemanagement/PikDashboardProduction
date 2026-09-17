# Tracking kendaraan

Peta traffic membaca stream Firebase REST `/vehicle_locations.json` (event `put` dan `patch`). URL default mengikuti proyek track-vehicle-234cb. Override opsional di `.env`:

```env
REACT_APP_VEHICLE_DATABASE_URL=https://track-vehicle-234cb-default-rtdb.asia-southeast1.firebasedatabase.app
REACT_APP_VEHICLE_FIREBASE_API_KEY=isi_web_api_key_proyek_firebase
```

Restart/build frontend setelah mengganti environment. Struktur setiap child: `latitude` dan `longitude` berupa angka, `vehicle_name`, `vehicle_id`, `plate_number`, `officer_name`, `heading` (derajat), `accuracy` (meter), `timestamp` (Unix milidetik), `tracking` (boolean).

Label tampil permanen; klik mobil untuk detail. Posisi bertransisi 900 ms, arah mengikuti heading. GPS tanpa pembaruan lebih dari 60 detik atau tracking berhenti ditampilkan abu-abu sebagai lokasi terakhir. Kendaraan yang dihapus dari Firebase hilang dari peta. Data GPS live terpisah dari filter tanggal laporan traffic.

## Status integrasi

Endpoint tanpa autentikasi mengembalikan HTTP 401 pada pengecekan 17 September 2026. Form login GPS sekarang menggunakan Firebase Authentication Email/Password untuk UID `9HpVuSHj8XYUaSvvSx7tfo5YsD32`. Token dikirim ke stream dan diperbarui sebelum kedaluwarsa. Sesi hanya disimpan di memori; reload atau keluar memerlukan login ulang. Password tidak disimpan oleh aplikasi.

Salin `vehicle-database.rules.json` ke Realtime Database > Rules lalu Publish. File ini membatasi baca seluruh `vehicle_locations` ke UID tersebut, tetapi mempertahankan izin tulis publik PATROL_01 yang sudah ada agar pengirim HP tetap berfungsi. Izin tulis ini perlu migrasi autentikasi pada aplikasi HP secara terpisah.

Isi Web API Key dari Project settings > General ke environment di atas, restart/build frontend, lalu masuk melalui form GPS di peta menggunakan akun yang dibuat. Jangan memasukkan password, database secret, atau service-account key ke environment frontend. Pengujian live masih memerlukan konfigurasi API key, publish rules, dan login oleh pemilik akun.

Kecepatan belum ditampilkan karena satuan field `speed` dari aplikasi pengirim belum dikonfirmasi.

Dokumentasi protokol: https://firebase.google.com/docs/reference/rest/database#section-streaming
