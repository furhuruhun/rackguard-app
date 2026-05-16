# ROADMAP.md

Implementation roadmap for **RackGuard** — Payment & Automation Phase.

**Status:** Revisi Implementasi (Mei 2026)
**Companion docs:** `CLAUDE.md` · `DESIGN.md` · `RackGuard_Frontend_Context.md`

---

## Konteks Perubahan

Fase ini menggantikan mekanisme NFC dengan **simulasi pembayaran berbasis QR Code** sebagai trigger pembuka solenoid. Perubahan ini memungkinkan development dan testing menggunakan **Expo Go** (tanpa native build), karena `react-native-nfc-manager` tidak lagi diperlukan.

**Ringkasan delta dari spec sebelumnya:**

| Aspek | Sebelumnya | Sekarang |
|-------|-----------|---------|
| Trigger unlock | NFC tap ke tag rak | Konfirmasi pembayaran di app |
| Firebase SDK (mobile) | `@react-native-firebase/*` native | `firebase` JS SDK |
| Expo workflow | Dev Client + EAS Build | Expo Go (development) |
| Tab 3 mobile | "Scan & Unlock" | "Bayar / Aksi" |
| Email notification | FCM push notification | Google Apps Script + Gmail |
| Backend business logic | Firebase Cloud Functions | GAS (cron) + client-side confirm |
| `Transaction` schema | tanpa `paymentStatus` | tambah `paymentStatus` field |

---

## 1. Tech Stack (Updated)

| Komponen | Teknologi | Peran |
|----------|-----------|-------|
| Mobile App | React Native + Expo (Expo Go compatible) | Antarmuka peminjam, generator QR Code, simulasi bayar |
| Web Dashboard | Next.js (App Router) | Monitoring rak & konfirmasi transaksi manual (Admin) |
| Database | Firebase Realtime Database | Cloud-sync real-time untuk `lockStatus` dan `paymentStatus` |
| Automation | Google Apps Script (GAS) | Cron job pengirim email otomatis tanpa backend server |
| IoT Hardware | ESP32 + Solenoid + RFID | Listener `lockStatus` dari Firebase |

---

## 2. To-Do List Implementasi

### Phase 1: Pseudo-Payment & Unlocking Logic

**Tujuan:** Mengganti alur NFC menjadi simulasi pembayaran yang memicu solenoid.

#### 2.1.1 Database Schema Update (Firebase)

- [ ] Tambahkan field `paymentStatus: 'pending' | 'success'` pada node `transactions/{id}`
- [ ] Pastikan node `shelves/{id}/lockStatus` bertipe string `'locked' | 'unlocked'`
- [ ] Update Firebase Security Rules:
  - User hanya bisa mengubah `paymentStatus` pada transaksi milik mereka sendiri (`auth.uid === resource.data.memberId`)
  - `lockStatus` hanya bisa diubah oleh authenticated user (bukan publik)

Schema `transactions` setelah update:

```
transactions/
└── {transactionId}/
    ├── type: 'borrow' | 'return'
    ├── bookId, bookTitle, memberId, memberName
    ├── borrowDate, dueDate, returnDate
    ├── fine: number
    ├── status: 'active' | 'completed' | 'overdue'
    └── paymentStatus: 'pending' | 'success'   ← NEW
```

#### 2.1.2 Mobile App Refactor

- [ ] Ubah Tab 3 dari "Scan" menjadi **"Bayar / Aksi"**
- [ ] Hapus layar "Scan & Unlock" (NFC flow)
- [ ] Buat layar baru **`duration.tsx`** — muncul setelah user tap "Pinjam Sekarang" dari `book/[id].tsx`:
  - Card ringkasan buku (judul, penulis, lokasi rak) dengan skeleton loading saat fetch
  - Tiga chip preset: "7 Hari", "14 Hari", "21 Hari" — tap chip snap scroll picker ke nilai tersebut
  - Scroll picker angka hari (range 1–30, default 7) — scroll custom → semua chip menjadi tidak aktif
  - Display live "Kembalikan sebelum [tanggal]" — update real-time setiap picker bergeser
  - Tombol "Lanjut ke Pembayaran" — disabled selama fetch buku belum selesai
- [ ] `book/[id].tsx` route ke `/duration?bookId=...` (bukan langsung ke `payment.tsx`)
- [ ] `payment.tsx` State 1 (pilih buku dari katalog) dihapus — selalu datang dari `duration.tsx` dengan `bookId`, `selectedDays`, `dueDate`
- [ ] Buat layar baru **"Pembayaran"** dengan dua mode:

  **Mode Pinjam (2-halaman flow):**
  - User tap "Pinjam Sekarang" di `book/[id].tsx` → route ke **`duration.tsx`**
  - **`duration.tsx`**: card ringkasan buku, chip preset 7/14/21 hari, scroll picker 1–30 hari, live tanggal kembali, tombol "Lanjut ke Pembayaran"
  - `duration.tsx` pass `bookId` + `selectedDays` + `dueDate` ke **`payment.tsx`**
  - `payment.tsx` **State 1 (pilih buku) dihapus** — langsung masuk QR Code dengan durasi yang sudah ditentukan
  - Sistem buat transaction record dengan `paymentStatus: 'pending'`
  - Tombol **"Konfirmasi Pembayaran"** tersedia di bawah QR

  **Mode Kembalikan:**
  - User pilih transaksi aktif → tap "Kembalikan Buku"
  - Tampilkan ringkasan (judul, denda jika ada)
  - Tombol **"Konfirmasi Pengembalian"**

- [ ] Implementasi fungsi `confirmPayment()`:
  ```
  1. Update transactions/{id}/paymentStatus → 'success'
  2. Update shelves/{rackId}/lockStatus → 'unlocked'
  3. Set transactions/{id}/borrowDate → timestamp sekarang
  4. Auto-relock setelah 30 detik: set lockStatus → 'locked'
  ```

- [ ] Buat layar **"Konfirmasi Berhasil"** setelah `confirmPayment()` sukses:
  - Pesan sukses + ikon checklist
  - Info: "Rak [SHELF-ID] terbuka selama 30 detik"
  - Countdown 30 detik
  - Tombol "Selesai"

#### 2.1.3 ESP32 Firmware Update *(out of frontend scope — referensi saja)*

- [ ] Pasang `Firebase.RTDB.setStreamCallback` pada path `shelves/{id}/lockStatus`
- [ ] Logika: jika status `unlocked`, tarik solenoid selama 30 detik lalu set kembali ke `locked`

---

### Phase 2: Email Alert Automation (Google Apps Script)

**Tujuan:** Mengirim email otomatis tanpa menyimpan API key di frontend.

#### 2.2.1 GAS Core Setup

- [ ] Buat project baru di [script.google.com](https://script.google.com)
- [ ] Hubungkan ke Firebase Realtime Database menggunakan `UrlFetchApp`:
  ```javascript
  const DB_URL = 'https://[project-id].firebaseio.com';
  const SECRET = PropertiesService.getScriptProperties().getProperty('FB_SECRET');

  function fetchTransactions() {
    const url = `${DB_URL}/transactions.json?auth=${SECRET}`;
    const res = UrlFetchApp.fetch(url);
    return JSON.parse(res.getContentText());
  }
  ```
- [ ] Simpan `FB_SECRET` di **Script Properties** (bukan hardcode di skrip)
- [ ] Gunakan `MailApp.sendEmail()` — memanfaatkan kuota Gmail internal (tidak perlu API key eksternal)

> **GAS Email Quota:** akun Gmail biasa ~100 email/hari, akun Google Workspace ~1500 email/hari. Sesuaikan dengan skala pengguna.

#### 2.2.2 Logic & Trigger Setup

- [ ] **Mode Testing** — trigger satu kali untuk verifikasi:
  ```javascript
  function setupTestTrigger() {
    ScriptApp.newTrigger('checkOverdueAndSendEmail')
      .timeBased()
      .after(15 * 60 * 1000) // 15 menit setelah setup
      .create();
  }
  ```

- [ ] **Mode Produksi** — time-driven trigger harian:
  ```javascript
  function setupDailyTrigger() {
    ScriptApp.newTrigger('checkOverdueAndSendEmail')
      .timeBased()
      .everyDays(1)
      .atHour(0) // tengah malam
      .create();
  }
  ```

- [ ] Logika pengecekan overdue:
  ```
  1. Fetch semua transactions dari Firebase
  2. Filter: status === 'active' && dueDate < today
  3. Untuk setiap transaksi overdue: fetch user email dari users/{memberId}
  4. Kirim email ke user
  5. (Opsional) Update status → 'overdue' di Firebase
  ```

#### 2.2.3 Email Template

- [ ] Buat template HTML dengan variabel dinamis:

  ```html
  <div style="font-family: sans-serif; max-width: 600px;">
    <h2>Pengingat Pengembalian Buku — RackGuard</h2>
    <p>Halo <strong>{{namaUser}}</strong>,</p>
    <p>Buku <strong>"{{judulBuku}}"</strong> yang Anda pinjam
       telah melewati batas waktu pengembalian
       (<strong>{{dueDate}}</strong>).</p>
    <p>Denda saat ini: <strong>Rp {{jumlahDenda}}</strong></p>
    <p>Segera kembalikan buku melalui aplikasi RackGuard.</p>
    <hr/>
    <small>Email ini dikirim otomatis oleh sistem RackGuard.</small>
  </div>
  ```

---

### Phase 3: Admin Web Dashboard Integration

**Tujuan:** Memberikan kontrol manual bagi admin untuk melihat dan mengoverride status.

#### 2.3.1 Real-time Monitoring

- [ ] Pasang Firebase listener pada `transactions/` untuk melihat perubahan `paymentStatus` secara instan di tabel Transactions
- [ ] Tambahkan kolom **"Payment"** di tabel Transactions:

  | Kolom | Nilai |
  |-------|-------|
  | `paymentStatus` | badge `pending` (kuning) / `success` (hijau) |

- [ ] Tambahkan tombol **"Manual Unlock"** pada halaman Shelf Status — untuk emergency override:
  - Konfirmasi modal: "Yakin membuka rak [SHELF-ID] secara manual?"
  - Action: set `shelves/{id}/lockStatus → 'unlocked'` langsung dari web dashboard

#### 2.3.2 Report System Update

- [ ] Filter statistik denda di halaman Reports: hanya hitung transaksi dengan `paymentStatus === 'success'`
- [ ] Tambahkan metrik baru di KPI card: **"Pembayaran Pending"** (count transaksi dengan `paymentStatus === 'pending'`)

---

## 3. Mekanisme Kerja Sistem (Real-time Flow)

```
[Mobile App]
    │
    ├─ 1. User pilih buku → transaksi dibuat (paymentStatus: 'pending')
    │
    ├─ 2. User lihat QR Code simulasi → tap "Konfirmasi Pembayaran"
    │
    └─ 3. confirmPayment() dipanggil:
           ├─ transactions/{id}/paymentStatus → 'success'
           ├─ shelves/{rackId}/lockStatus   → 'unlocked'
           └─ [auto 30s] lockStatus         → 'locked'

[Firebase Realtime Database]
    │
    ├─ Cloud sync real-time ke ESP32 (via internet)
    └─ Cloud sync real-time ke Web Dashboard (Admin)

[ESP32]
    └─ Listener detects 'unlocked' → tarik solenoid 30 detik

[Google Apps Script — tengah malam]
    ├─ Fetch transactions dari Firebase
    ├─ Filter overdue (dueDate < today && status === 'active')
    └─ MailApp.sendEmail() ke masing-masing user
```

---

## 4. Catatan Keamanan & Batas Sistem

| Aspek | Ketentuan |
|-------|-----------|
| Firebase Rules | User hanya bisa ubah `paymentStatus` transaksi milik sendiri |
| GAS Secret | `FB_SECRET` disimpan di Script Properties, bukan di kode |
| GAS Email Quota | ~100 email/hari (Gmail biasa) — pantau jika user banyak |
| ESP32 Connectivity | Harus selalu terhubung Wi-Fi agar listener tidak terputus |
| Auto-relock | Solenoid wajib kembali ke `locked` setelah 30 detik (fail-secure) |
| `confirmPayment()` | Jalankan sebagai atomic operation — gunakan Firebase `update()` multi-path |

---

## 5. Urutan Pengerjaan yang Disarankan

```
1. Update Firebase schema (tambah paymentStatus) + update Security Rules
2. Refactor mobile app: rename tab + ganti Scan screen → Payment screen
2b. Buat duration.tsx — duration picker screen dengan preset chips + live date calculation
3. Implement confirmPayment() dengan multi-path Firebase update
4. Test end-to-end: mobile → Firebase → ESP32 response
5. Setup GAS: core fetch + MailApp + test trigger (15 menit)
6. Verifikasi email terkirim di mode testing
7. Ganti ke daily trigger (produksi)
8. Update web dashboard: tambah kolom paymentStatus + tombol Manual Unlock
9. Update laporan: filter by paymentStatus === 'success'
10. Buat receipt.tsx — vintage receipt screen setelah confirmPayment() resolve
11. Integrasi expo-sharing: screenshot receipt → share via native share sheet
```

---

### Phase 4: Vintage Receipt Screen

**Tujuan:** Menggantikan State 3 ("Konfirmasi Berhasil") di `payment.tsx` dengan layar receipt bergaya vintage concert ticket sebagai halaman penuh tersendiri.

**Konteks desain:** Receipt menggunakan visual language tiket konser vintage — cream paper background, serif display font, typewriter body font, rotated stamp, perforated divider, dan stub section. Detail visual lengkap ada di `DESIGN.md` section "Vintage Receipt / Ticket Component".

#### 4.1 Dependencies Baru

- [ ] Install `react-native-view-shot` — screenshot komponen React Native menjadi image file
- [ ] Install `expo-sharing` — trigger native share sheet dengan file image
- [ ] Pastikan `react-native-svg` sudah ada (dibutuhkan untuk perforated divider)

> `react-native-view-shot` dan `expo-sharing` tidak butuh native module rebuild — keduanya compatible dengan Expo Go.

#### 4.2 File Baru: `receipt.tsx`

- [ ] Buat screen baru `receipt.tsx` — **bukan modifikasi `payment.tsx`**
- [ ] `payment.tsx` memanggil `router.replace('/receipt')` (bukan `push`) setelah `confirmPayment()` resolve, dengan pass transaction data sebagai params
- [ ] `receipt.tsx` tidak bisa di-back — stack di-replace, bukan di-push

**Data yang dipopulasi dari params / auth state:**

| Field di receipt | Sumber data |
|-----------------|-------------|
| Nama peminjam | `auth.currentUser.displayName` atau `user.name` dari Firebase |
| Judul buku | `transaction.bookTitle` |
| No. rak | `book.rackLocation` (fetch by `transaction.bookId`) |
| Tanggal pinjam | `transaction.borrowDate` (timestamp dari `confirmPayment()`) |
| Tanggal kembali | `transaction.dueDate` |
| Denda per hari | Hardcoded konstanta — jangan ambil dari Firebase |
| No. transaksi | `transaction.id` |
| Stamp text | Conditional: `transaction.type === 'borrow'` → "DIPINJAM", `'return'` → "DIKEMBALIKAN" |

#### 4.3 Layout: 4 Zone Wajib (Berurutan)

**Zone 1 — Header**
- Background gelap (`#1A1A2E`)
- Eyebrow text: "Perpustakaan RackGuard" (hardcoded)
- Title: "Tanda Terima Peminjaman" (serif display font)
- Subtitle: "— Receipt of Loan —"
- Corner ornaments di 4 sudut header

**Zone 2 — Body**
- Background cream (`#F5F0E8`)
- Grid field data 2 kolom: nama peminjam (full width), judul buku + no. rak, tgl pinjam + tgl kembali, denda/hari + no. transaksi
- Rotated stamp (rotate -12deg) di pojok kanan atas body — circular border, text kondisional
- Diamond divider ornamen di atas dan bawah body

**Zone 3 — Perforated Divider**
- Implementasi via `react-native-svg` — bukan CSS/View biasa
- Alasan: React Native memotong overflow, lingkaran "lubang" harus keluar dari sisi card
- Dua semicircle di ujung kiri dan kanan dengan fill warna identik page background
- Garis dashed di tengah
- Warna lingkaran diambil dari `useColorScheme()` — tidak boleh hardcoded

**Zone 4 — Stub**
- Background gelap (`#1A1A2E`)
- Kiri: label "Stub · Simpan" + nilai `transaction.id`
- Kanan: label "Kembali Sebelum" + nilai `transaction.dueDate` (formatted)

#### 4.4 Font Loading

- [ ] Load via `expo-font` di app entry point (bukan di `receipt.tsx`) agar tidak flicker
- [ ] Tiga font khusus receipt — tidak dipakai di komponen lain:
  - `Playfair_Display_700` — header title dan nilai field utama
  - `Special_Elite_400` — body label, stub text, eyebrow
  - `Libre_Barcode_39` — barcode string di atas stub (opsional, bisa diganti QR)
- [ ] Semua dari Google Fonts, load via `@expo-google-fonts/playfair-display`, `@expo-google-fonts/special-elite`

> Untuk `Libre Barcode 39` yang tidak ada di expo-google-fonts, load manual via `Font.loadAsync()` dengan URL dari Google Fonts CDN.

#### 4.5 Share Functionality

- [ ] Bungkus seluruh komponen receipt dalam `ref` yang diteruskan ke `react-native-view-shot`
- [ ] Tombol "Bagikan" → `captureRef(receiptRef)` → return URI file image → `Sharing.shareAsync(uri)`
- [ ] Tombol "Selesai" → `router.replace('/(tabs)')` — reset ke Beranda, bukan back

#### 4.6 Catatan Implementasi

- Seluruh warna receipt (cream, near-black, gold) didefinisikan sebagai konstanta lokal di `receipt.tsx` — tidak masuk ke design system global
- Jangan gunakan font receipt (`Playfair Display`, `Special Elite`) di luar file ini
- Warna lingkaran perforated divider **wajib** diambil dari `useColorScheme()` — ini satu-satunya nilai yang tidak boleh hardcoded di file ini
- Receipt hanya boleh dirender setelah `confirmPayment()` resolve dengan data lengkap — jangan render dengan data partial atau loading state