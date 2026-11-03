# Backend pendaftaran Manba'ul Ulum

Backend ini menyimpan isian pendaftaran dan status awal "Menunggu verifikasi"
di Google Spreadsheet serta dokumen di folder Google Drive privat. Tidak ada
endpoint untuk membaca daftar pendaftar; akses database tetap melalui akun
Google pengelola. Admin mengelola status langsung di kolom **Status Pendaftaran**.

## Hosting gratis tanpa domain khusus

Anda tidak perlu membeli domain. Website ini berupa file HTML, CSS, dan
JavaScript statis; cara gratis yang sederhana adalah GitHub Pages:

1. Buat akun GitHub jika belum memilikinya, lalu buat repository **public**
   baru untuk file website. Isi website memang dapat dilihat pengunjung;
   jangan pernah menaruh password atau secret key pada repository.
2. Unggah file `index.html`, `styles.css`, `script.js`, `pendaftaran.html`,
   `admin.html`, `admin.js`, `portal-wali.html`, `portal.js`,
   `portal-config.js`, dan `registration-config.js` ke root repository.
3. Buka **Settings → Pages**, pilih **Deploy from a branch**, pilih `main` dan
   folder `/(root)`, kemudian simpan.
4. GitHub Pages akan memberikan alamat gratis, misalnya
   `https://USERNAME.github.io/NAMA-REPOSITORY/`. Tunggu proses deployment
   selesai sebelum menguji alamat tersebut.
5. Catat hostname persisnya (`USERNAME.github.io`), tanpa `https://` atau
   bagian path repository. Gunakan hostname itu ketika mendaftarkan reCAPTCHA.

Website yang dibuka langsung dari folder komputer (`file://`) belum online dan
tidak dapat dipakai untuk menerima pendaftaran publik. Setiap perubahan file
website perlu diunggah ke repository agar terbit di alamat Pages. 

## 1. Siapkan reCAPTCHA

1. Daftarkan hostname gratis dari GitHub Pages pada Google reCAPTCHA Admin
   Console sebagai **reCAPTCHA v3**. Contoh: `USERNAME.github.io`. Tidak perlu
   membeli domain sendiri.
2. Salin **site key** ke `recaptchaSiteKey` di `registration-config.js`.
3. Jangan menaruh **secret key** di website atau membagikannya melalui chat.
   Secret key akan dimasukkan langsung ke Script Properties pada langkah 3.

## 2. Buat penyimpanan

1. Masuk ke akun Google milik yayasan, buka
   [script.google.com](https://script.google.com), lalu buat project baru.
2. Salin isi `Code.gs` ke editor Apps Script.
3. Pilih fungsi `setupRegistrationStorage`, lalu klik **Run** dan berikan izin
   Google Drive, Google Spreadsheet, serta permintaan eksternal Apps Script.
   Fungsi ini membuat spreadsheet dan folder Drive baru pada akun yayasan;
   keduanya tidak dibagikan ke publik.

## 3. Tambahkan secret reCAPTCHA

Di Apps Script buka **Project Settings → Script Properties**, lalu tambahkan:

| Property | Value |
| --- | --- |
| `RECAPTCHA_SECRET` | Secret key reCAPTCHA v3 |

`SPREADSHEET_ID` dan `DRIVE_FOLDER_ID` dibuat otomatis oleh fungsi setup.

## 4. Deploy

1. Klik **Deploy → New deployment → Web app**.
2. Pilih **Execute as: Me** dan **Who has access: Anyone**. Endpoint menerima
   POST publik: pendaftaran hanya menulis data, sedangkan permintaan Portal
   Wali memerlukan sesi santri atau sesi pengurus yang valid sebelum membaca
   atau mengubah data privat.
3. Deploy, lalu salin URL Web App yang berakhiran `/exec` ke `appsScriptUrl`
   dalam `registration-config.js`. Salin juga URL Spreadsheet yang dibuat saat
   setup ke `adminSpreadsheetUrl` di berkas yang sama.
4. Pastikan domain website sudah tercantum di konfigurasi reCAPTCHA, kemudian
   uji dengan data dummy sebelum membuka pendaftaran. Form mengirim melalui
   iframe tersembunyi agar konfirmasi Apps Script dapat diterima tanpa membuka
   akses baca atau memberi akses langsung ke database.
5. Setelah mengubah kode Apps Script, buat versi deployment baru melalui
   **Deploy → Manage deployments → Edit → New version**.

## Menu Admin

Menu pengelolaan Portal Wali menggunakan nama pengguna dan kata sandi khusus
pengurus, bukan Google Sign-In. Google Spreadsheet pendaftar tetap dilindungi
oleh izin berbagi Google dan mungkin meminta akun Google tersendiri saat dibuka.
Jangan pernah mengubah berbagi Spreadsheet menjadi **Siapa saja yang memiliki
link**.

Pengurus dapat mencari/mengurutkan pendaftar serta mengubah kolom
**Status Pendaftaran** langsung di Spreadsheet. Profil, program, dan teks
website masih statis; mengubahnya perlu mengedit file website lalu menerbitkan
ulang ke GitHub Pages. Menu Admin mengelola data Portal Wali, tetapi belum
mengelola konten halaman publik website.

## Portal Wali Santri

Wali masuk menggunakan **ID Santri dan kata sandi** yang dibuat pengelola.
Apps Script hanya mengirim data untuk santri yang ID-nya dan email walinya
sudah ditautkan pada tab **Portal Wali**. Kata sandi diproses dengan PBKDF2
HMAC-SHA-256 dan hanya salt serta hash yang disimpan pada tab **Akun Portal**.
Setelah login, portal menggunakan token sesi sementara; kata sandi tidak
dikirim ulang untuk permintaan data berikutnya.

### Menyiapkan login pengurus

1. Isi `appsScriptUrl` di `portal-config.js` dengan URL Web App `/exec`.
2. Pada Apps Script buka **Project Settings → Script Properties**. Tambahkan:

   | Property | Value |
   | --- | --- |
   | `PORTAL_ALLOWED_ORIGIN` | Origin HTTPS situs, misalnya `https://USERNAME.github.io` (tanpa path) |
   | `PORTAL_ADMIN_USERNAME` | Nama pengguna pengurus, 3-64 karakter: huruf, angka, titik, garis bawah, atau tanda hubung |
   | `PORTAL_ADMIN_PASSWORD` | Kata sandi sementara, minimal 14 karakter |

3. Di Apps Script pilih fungsi `configurePortalAdministrator`, lalu klik
   **Run** dan berikan izin. Fungsi ini membuat salt dan hash kata sandi,
   kemudian menghapus nilai sementara `PORTAL_ADMIN_PASSWORD`. Jangan simpan
   kata sandi ke file website, Spreadsheet, atau chat.
4. Untuk mengganti kata sandi pengurus, perbarui property
   `PORTAL_ADMIN_PASSWORD` dengan kata sandi baru, lalu jalankan kembali
   `configurePortalAdministrator()`. Sesi pengurus lama otomatis tidak berlaku.
5. Login pengurus tidak memerlukan `googleClientId` atau OAuth Client. Pastikan
   origin website diakses melalui HTTPS.

Saat ini satu nama pengguna dan kata sandi dipakai bersama oleh para pengurus
yang diberi wewenang. Bagikan kredensial hanya melalui saluran privat dan
ganti segera jika tidak lagi rahasia. Sesi pengurus berakhir otomatis paling
lama setelah enam jam. Halaman Admin harus dibuka dari alamat HTTPS situs yang
sudah dipublikasikan dan origin-nya harus cocok dengan `PORTAL_ALLOWED_ORIGIN`;
membuka `admin.html` langsung dari komputer (`file://`) tidak dapat digunakan
untuk login.

### Menyiapkan data dan akses wali

Di Apps Script jalankan kembali `setupRegistrationStorage()` agar tab portal
dibuat pada Spreadsheet yang sudah digunakan. Fungsi ini tidak menghapus data
tab portal yang sudah ada; header yang tidak sesuai akan dilaporkan sebagai
kesalahan dan perlu diperiksa sebelum menjalankannya kembali. Setelah
mengubah Apps Script, terbitkan versi baru melalui **Deploy → Manage
deployments → Edit → New version**.

Login ke halaman **Admin** dengan nama pengguna dan kata sandi pengurus yang
telah disiapkan, lalu buka menu **Kepengurusan**. Pengurus dapat membuat,
mengubah, dan menghapus data portal dari sana:

| Tab | Kolom |
| --- | --- |
| `Portal Wali` | Email Wali, ID Santri, Status Akses (`Aktif` untuk memberi akses atau `Nonaktif` untuk mencabut akses) |
| `Akun Portal` | Diisi otomatis oleh halaman Admin; jangan mengisi atau mengubah salt/hash secara manual |
| `Data Santri` | Dikelola dari Kepengurusan: ID Santri, Nama Santri, Kelas, Asrama, Status |
| `Presensi` | Dikelola dari Kepengurusan: ID, ID Santri, Tanggal, Status, Catatan |
| `Tagihan` | Dikelola dari Kepengurusan: ID, ID Santri, Nama Tagihan, Jumlah, Status, Jatuh Tempo, Tanggal Bayar |
| `Akademik` | Dikelola dari Kepengurusan: ID, ID Santri, Mata Pelajaran, Periode, Nilai, Catatan |
| `Pengumuman` | Dikelola dari Kepengurusan: ID, Judul, Isi, Terbit (`Ya`/`Tidak`), Waktu Terbit |
| `Pesan Wali` | Dibaca dari portal; pengurus dapat mengubah status dan mengirim balasan melalui Kepengurusan |

Tautkan alamat email wali yang valid ke ID santri pada tab
**Portal Wali** melalui menu **Kepengurusan**. Untuk mencabut akses, ubah
**Status Akses** menjadi `Nonaktif` atau hapus tautan wali. Satu email boleh
ditautkan ke beberapa ID santri. Data santri harus dibuat sebelum membuat
tautan wali, presensi, tagihan, atau data akademik. Untuk mengaktifkan login,
pengurus membuka halaman **Admin** dengan kredensial pengurus, lalu mengisi
ID Santri dan email wali aktif yang sudah ditautkan. Buat kata sandi unik
minimal 12 karakter dan bagikan kepada wali melalui saluran privat. Pengelola
dapat mengulang langkah tersebut untuk mengganti kata sandi. Satu ID Santri
memiliki satu kredensial; login akan menampilkan santri-santri lain yang
ditautkan ke email wali tersebut.

Portal menolak login setelah lima percobaan gagal untuk suatu ID selama
sementara waktu. Sesi login berlaku paling lama enam jam dan dapat berakhir
lebih cepat. Wali dapat keluar dari portal atau masuk kembali bila sesi
berakhir.

Portal tidak mengambil NIK atau dokumen dari tab **Pendaftar**; data pendaftar
tidak otomatis menjadi data santri aktif. Pengelola perlu membuat ID santri
dan mengisi data portal yang diperlukan secara manual. Pastikan Spreadsheet
serta folder Drive tetap privat dan jangan mengubah berbagi menjadi **Siapa
saja yang memiliki link**.

Jangan menyimpan kata sandi teks biasa, data kartu pembayaran, atau dokumen
identitas di tab portal. Kredensial login pengurus disimpan di Script
Properties dalam bentuk hash dan hanya pengelola project Apps Script yang
dapat mengubahnya; batasi akses project dan Spreadsheet hanya kepada pengurus
berwenang. Jangan menggunakan nama, alamat,
kelas, atau nomor induk sebagai kata sandi. Tetapkan prosedur backup serta
masa penyimpanan. Apps Script, Spreadsheet, dan layanan Google lain tetap
memiliki kuota dan batas pemakaian.

Jangan mengunggah dokumen asli calon santri untuk pengujian. Setiap file dibatasi
4 MB dan total semua file dalam satu pengiriman dibatasi 12 MB. Dokumen di Drive
tidak dibuat publik; hanya akun yang memiliki akses ke folder yayasan yang dapat
melihatnya.

## Kapasitas dan batas layanan Google

Paket Google AI Plus 400 GB pada tangkapan layar menyediakan ruang Drive yang
besar, tetapi kapasitas itu bukan tanpa batas untuk satu aplikasi. File yang
diunggah memakai ruang akun Google yang menjalankan Apps Script. Jalankan
`setupRegistrationStorage` dan deploy Apps Script menggunakan akun yayasan yang
memiliki ruang tersebut; jangan bagikan folder Drive atau Spreadsheet ke
**Anyone**.

Google Apps Script, Google Drive, Spreadsheet, GitHub Pages, dan reCAPTCHA juga
memiliki kuota, kebijakan pemakaian wajar, atau batas ukuran/permintaan.
Spreadsheet cocok untuk data pendaftaran dengan volume wajar, bukan sebagai
database tanpa batas. Kode ini membatasi dokumen menjadi 4 MB per file dan 12 MB
total per pendaftaran. Kuota Apps Script dapat berubah menurut jenis akun dan
Google dapat mengubah kebijakannya; periksa halaman kuota resmi sebelum menerima
pendaftaran dalam jumlah besar. Siapkan backup dan kebijakan masa penyimpanan
data, terutama karena formulir memuat NIK dan dokumen identitas.

Alamat reCAPTCHA tanpa domain khusus bisa berbeda bila nama/alamat GitHub Pages
berubah. Setelah domain terdaftar, simpan site key di konfigurasi situs dan
secret key di Script Properties seperti dijelaskan di atas.
