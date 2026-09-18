# Track Vehicle: satu login dashboard

Login tetap memakai username/password dan Sheet OFFICER. Kode lama mencocokkan kolom `NAMA LENGKAP` dan `PASSWORD`, bukan Firebase. Pencocokan itu dipertahankan; kolom `username` juga didukung jika `NAMA LENGKAP` tidak ada. Email dan role/level diambil sebagai metadata bila tersedia.

Sebelumnya tidak ada session/JWT backend: frontend hanya menyimpan `cc_isLoggedIn=true`, dan respons login mengembalikan seluruh baris termasuk password. Kini login yang sama menerbitkan session bearer bertanda tangan (itsdangerous, bukan JWT), berlaku 8 jam secara default. Respons hanya memuat username/email/role, sessionToken, expiresAt. Password hanya dikirim ke endpoint login existing melalui HTTPS dan tidak dikirim ke Firebase atau disimpan. Setelah deployment pengguna perlu login ulang sekali; penanda boolean lama tidak dianggap autentikasi.

## File dan dependency

Backend:
- `app.py`: mendaftarkan route auth pada Flask existing dengan pembaca Sheet OFFICER existing.
- `dashboard_auth.py`: validasi login, signed session, GET `/api/session`, GET `/api/firebase-token`. Endpoint token memverifikasi bearer session, mengabaikan identitas yang dikirim client, menolak anonymous/invalid/expired dengan 401, serta menyamarkan error konfigurasi dengan 503. Respons auth memakai `Cache-Control: no-store`.
- `firebase_admin_service.py`: inisialisasi Admin SDK secara lazy dari environment backend; UID `dashboard_{username}` (hash deterministik untuk username yang terlalu panjang); custom claims `role=dashboard`, `username`, `officer_email`, `officer_role`. `email` adalah reserved OIDC claim, sehingga metadata memakai `officer_email`.
- `requirements.txt`: menambah firebase-admin dan deklarasi itsdangerous (dependency Flask).
- `test_dashboard_auth.py`: pengujian route/session/claims dengan data OFFICER dan token signer tiruan, tanpa akses produksi.

Frontend (Create React App):
- `config/firebase.js`: Firebase Web SDK modular, konfigurasi environment, auth/database satu instance.
- `services/dashboardSession.js`, `useDashboardSession.js`: simpan hanya signed session + metadata, validasi saat reload, pemeriksaan expiry/401, logout lintas tab.
- `services/firebaseAuth.js`: validasi dashboard session, reuse Firebase user yang cocok, minta custom token bila perlu, `signInWithCustomToken`, antrean untuk mencegah race login/logout.
- `components/VehicleAuthProvider.js`: state connecting/ready/error, pemulihan melalui Coba lagi; kegagalan Firebase tidak memblokir menu lain.
- `App.js`, `Login.js`: login username/password yang sama, lifecycle session, logout Firebase.
- `services/vehicleTrackingService.js`: `onValue(vehicle_locations)` setelah auth ready. SDK menangani refresh ID token dan reconnect. `.info/connected` hanya untuk status koneksi.
- `components/VehicleTrackingLayer.js`: menunggu auth dan membersihkan listener; login GPS kedua dihapus beserta `VehicleLogin.js` dan `vehicleAuthService.js`.
- `package.json`/lock: dependency `firebase`.
- Tes Navbar diselaraskan dengan label Emergency/Parking yang sudah ada; menu tidak diubah.

Peta satelit, marker, popup, dan aturan status kendaraan dipertahankan. Tracking tetap berada di peta Traffic existing; perubahan ini tidak menambah/memindahkan menu peta.

## Environment Render

Tambahkan pada service backend:

| Variable | Isi |
| --- | --- |
| `DASHBOARD_SESSION_SECRET` | Secret acak minimal 32 karakter; stabil antar restart/worker |
| `DASHBOARD_SESSION_TTL_SECONDS` | Opsional, default `28800` (8 jam) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Seluruh isi JSON service account Firebase, bukan nama/path file |

`GOOGLE_CREDENTIALS` existing tetap dipakai untuk Google Sheets. Jangan menggantinya dengan credential Firebase. Backend tidak otomatis membaca `.env`; lokal gunakan environment shell atau mekanisme env yang Anda gunakan.

Firebase Console > Project settings > Service accounts > Firebase Admin SDK > Generate new private key. Gunakan service account dari proyek Realtime Database yang sama. Masukkan seluruh JSON ke environment Render, termasuk private_key dengan escape `\n` JSON aslinya. Jangan menaruh JSON/private key pada Vercel, frontend, atau Git. Tidak perlu membuat user Firebase Email/Password. Admin SDK menandatangani custom token; Firebase membuat user custom-auth saat pertama kali sign-in.

## Environment Vercel

Pada proyek frontend, isi konfigurasi Firebase Web dari Project settings > General > Your apps. Contoh tersedia di `.env.example`:

```env
REACT_APP_API_URL=https://YOUR-BACKEND.onrender.com
REACT_APP_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN=track-vehicle-234cb.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://track-vehicle-234cb-default-rtdb.asia-southeast1.firebasedatabase.app
REACT_APP_FIREBASE_PROJECT_ID=track-vehicle-234cb
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

Salin nilai app yang sesuai. Untuk auth/database implementasi ini minimal memerlukan API_KEY, DATABASE_URL, PROJECT_ID. Tidak memakai Storage/Messaging tetapi field konfigurasi didukung. API key Web bukan Admin private key. Alias lama `REACT_APP_VEHICLE_FIREBASE_API_KEY` dan `REACT_APP_VEHICLE_DATABASE_URL` masih diterima untuk migrasi. Prefix baru diprioritaskan. Simpan env untuk Production/Preview yang dipakai lalu rebuild/deploy Vercel. `.env` lokal tetap di-ignore.

## Realtime Database Rules

Tambahkan hanya izin baca berikut pada `vehicle_locations`:

```json
".read": "auth != null && auth.token.role === 'dashboard'"
```

File `vehicle-database.rules.json` menyediakan rules lengkap berdasarkan rules terakhir yang Anda berikan. Izin tulis `PATROL_01` dipertahankan, bukan diperluas atau diganti. Jika rules writer Android sudah berubah di Firebase, gabungkan hanya `.read` di atas, jangan menimpa aturan writer yang baru. Publish rules di Firebase Console. Jangan memakai `.read: true`.

## Deployment dan pengujian

1. Isi env Render sebelum deploy backend baru; tanpa SESSION_SECRET login gagal tertutup. Deploy dependency/backend. Kesalahan Admin credential tidak memblokir login dashboard, tetapi GPS menampilkan error.
2. Publish rule role dashboard, isi env Vercel, push perubahan kode, dan rebuild/deploy frontend.
3. Login memakai USERNAME + PASSWORD existing. Tidak ada form email/password GPS.
4. Di Network browser: POST `/api/login` berhasil, GET `/api/session` berhasil, lalu GET `/api/firebase-token` memakai Authorization bearer. Respons tidak mengandung password. Jangan menyalin token/password ke log/chat.
5. Firebase Authentication > Users menampilkan UID dashboard_USERNAME. Buka Traffic/peta tracking: status Connecting berubah menjadi Terhubung. Perubahan GPS HP memperbarui marker.
6. Refresh halaman: dashboard session divalidasi server, Firebase user valid dipakai ulang tanpa request custom token setiap render.
7. Logout: dashboard kembali ke login, signed session lokal dibuang, Firebase signOut, listener dilepas. Cek juga logout lintas tab dan login akun lain.
8. Anonymous/forged/expired request ke `/api/firebase-token` harus 401. Session dashboard yang expired mengembalikan login existing. Permission denied atau jaringan gagal hanya memengaruhi GPS, dengan pesan Unable to connect to realtime vehicle data dan tombol Coba lagi.
9. Verifikasi menu CCTV/Call Center/Pump/Parking tetap dapat dibuka saat Firebase gagal.

Perintah lokal: `npm test -- --watchAll=false --runInBand` dan `npm run build` dari frontend. Dari backend, setelah install requirements: `python -m unittest test_dashboard_auth -v`.

Session dashboard merupakan bearer stateless bertanda tangan; logout menghapus sesi client, bukan daftar revocation server. Token yang telah disalin tetap berlaku sampai expiry. Rotasi DASHBOARD_SESSION_SECRET membatalkan semua dashboard session. Firebase session memiliki lifecycle SDK tersendiri; aplikasi signOut ketika dashboard logout/expired, tetapi pencabutan Firebase token lintas perangkat memerlukan mekanisme admin tambahan. Perubahan akun di Sheet berlaku pada login berikutnya.

Pengujian otomatis tidak menggantikan verifikasi live Render/Vercel/Firebase dengan credential pemilik proyek.

Referensi: https://firebase.google.com/docs/auth/admin/create-custom-tokens dan https://firebase.google.com/docs/auth/web/custom-auth
