# RackGuard — Frontend Context

Dokumen referensi front-end untuk sistem **RackGuard** (Rak Buku Pintar dengan Penguncian Elektronik).
Cross-reference: `CLAUDE.md` · `DESIGN.md` · `ROADMAP.md` · `AGENT_CONTEXT.md`

---

## 1. Ringkasan Sistem

**RackGuard** adalah sistem manajemen peminjaman buku berbasis IoT. Peminjam berinteraksi melalui **mobile app**, admin melalui **web dashboard**, rak buku fisik dikontrol oleh **ESP32**, dan email pengingat dikirim otomatis oleh **Google Apps Script**.

### 1.1 Stakeholder & Role

| Role | Platform | Akses |
|------|----------|-------|
| Peminjam (mahasiswa) | Mobile App (Expo) | Katalog, pinjam, kembalikan, riwayat, profil |
| Admin perpustakaan | Web Dashboard (Next.js) | Monitoring rak, manajemen buku & anggota, laporan |
| Sistem (otomatis) | Google Apps Script | Email reminder H-1 + overdue |
| Hardware | ESP32 | Listener `lockStatus` dari Firebase → solenoid |

### 1.2 Tech Stack (Locked)

| Layer | Mobile App | Web Dashboard |
|-------|-----------|---------------|
| Framework | React Native + Expo (Expo Go compatible) | Next.js (App Router) |
| Language | TypeScript | TypeScript |
| Styling | StyleSheet (React Native) | Tailwind CSS |
| State | Zustand | Zustand / React Context |
| Data fetching | Firebase JS SDK (`onValue`, `get`) | Firebase JS SDK |
| Auth | Firebase Auth (email/password) | Firebase Auth |
| Icons | lucide-react-native | lucide-react |
| Navigation | Expo Router (file-based) | Next.js App Router |

### 1.3 Batasan Domain

- **Peminjam** hanya bisa mengakses mobile app — tidak ada web interface untuk peminjam
- **Admin** hanya bisa mengakses web dashboard — tidak ada mobile interface untuk admin
- Email domain wajib `@std.stei.itb.ac.id` untuk registrasi

---

## 2. Mobile Application

### 2.1 Platform & Setup

- **Framework:** React Native + Expo (Expo Go compatible — tidak perlu EAS Build atau Dev Client)
- **Firebase:** `firebase` JS SDK (bukan `@react-native-firebase/*`)
- **Navigation:** Expo Router v6 (file-based routing, Stack + Tabs)
- **Auth persistence:** AsyncStorage via `getReactNativePersistence`

### 2.2 Navigasi & Tab Structure

Bottom navigation bar dengan 5 tab + 1 hidden:

| Tab | Icon | File | Keterangan |
|-----|------|------|-----------|
| Beranda | Home | `(tabs)/index.tsx` | Dashboard peminjam |
| Katalog | BookOpen | `(tabs)/catalog.tsx` | Daftar buku |
| Bayar | QrCode (center, elevated) | `(tabs)/payment.tsx` | QR payment + kembalikan |
| Riwayat | Clock | `(tabs)/history.tsx` | Riwayat transaksi |
| Profil | User | `(tabs)/profile.tsx` | Profil + notifikasi |
| *(scan)* | — | `(tabs)/scan.tsx` | `href: null` — hidden, tidak muncul di navbar |

Stack screens (di luar tabs):

| Route | File | Keterangan |
|-------|------|-----------|
| `/login` | `login.tsx` | Auth screen |
| `/register` | `register.tsx` | Registrasi screen |
| `/book/[id]` | `book/[id].tsx` | Detail buku (push, dengan header) |
| `/duration` | `duration.tsx` | Pilih durasi peminjaman (push, tanpa header) |
| `/receipt` | `receipt.tsx` | Tanda terima vintage (replace, tanpa header) |

### 2.3 Auth Guard

`_layout.tsx` menggunakan `AuthGuard` component yang:
- Listen `onAuthStateChanged` dari Firebase
- Fetch profil member dari `users/{uid}` dan simpan ke Zustand store
- Redirect ke `/login` jika belum auth, ke `/(tabs)` jika sudah auth tapi di halaman auth
- Blok render sampai `initialized && fontsLoaded` (kedua kondisi harus terpenuhi)

### 2.4 State Management

```typescript
// store/authStore.ts — Zustand
interface AuthStore {
  firebaseUser: FirebaseUser | null
  member: Member | null
  memberId: string | null
  initialized: boolean
}
// Akses: const { member, memberId } = useAuthStore()
```

### 2.5 Font Loading

Dua font khusus receipt — diload di `_layout.tsx` agar tidak flicker:
- `PlayfairDisplay_700Bold` — header title, nilai field receipt
- `SpecialElite_400Regular` — label, eyebrow, stub text receipt

Font ini **tidak boleh dipakai di komponen lain** selain `receipt.tsx`.

---

## 3. Detail Halaman Mobile App

### Halaman A — Login (`/login`)

- Input: email institusi + password
- Validasi format email sebelum submit
- "Lupa Password?" → `sendPasswordResetEmail` ke email yang diinput
- Link ke Daftar (`/register`)
- Error handling: translate Firebase error code ke pesan Bahasa Indonesia

### Halaman B — Registrasi (`/register`)

- Input: nama panggilan, email, password, konfirmasi password
- Domain email wajib `@std.stei.itb.ac.id`
- Password minimal 6 karakter
- Success: write profil ke `users/{uid}` → redirect ke app
- Error handling: translate Firebase error code

### Halaman C — Beranda (`/(tabs)/index.tsx`)

- Greeting dengan nama user
- Kartu peminjaman aktif (buku yang sedang dipinjam)
- Badge notifikasi di pojok kanan atas (Bell icon) — real-time via `onValue`
- Quick action: "Pinjam Buku" → Katalog, "Kembalikan" → Payment
- Status badge peminjaman aktif (hari tersisa / overdue)

### Halaman D — Detail Buku (`/book/[id]`)

- Fetch data buku dari `books/{id}`
- Tampil: cover placeholder, judul, penulis, ISBN, kategori, lokasi rak, deskripsi, status
- Status badge: `available` (hijau) / `borrowed` (amber) / `overdue` (merah)
- Tombol **"Pinjam Sekarang"** → route ke `/duration?bookId={id}` (bukan langsung ke payment)
- Tombol disabled jika buku tidak `available`
- Header stack dengan tombol Kembali

### Halaman D.5 — Pilih Durasi Peminjaman (`/duration`)

**Trigger:** user tap "Pinjam Sekarang" dari Halaman D.

Komponen dari atas ke bawah:

1. **Header:** "Pilih Durasi Peminjaman"

2. **Card ringkasan buku** — fetch `books/{bookId}` sekali (`get()`, bukan listener). Tampilkan skeleton saat loading. Setelah fetch: judul, penulis, lokasi rak. Tujuan: konfirmasi bahwa user memilih buku yang benar.

3. **Section "Durasi":**
   - Tiga chip preset: **"7 Hari"**, **"14 Hari"**, **"21 Hari"** — default aktif: 7 Hari. Tap chip → snap scroll picker ke nilai tersebut.
   - Scroll picker range 1–30 hari. Scroll ke nilai custom → semua chip menjadi tidak aktif.

4. **Display kalkulasi live:** `"Kembalikan sebelum [tanggal]"` — update real-time setiap picker bergeser. Format: "30 Mei 2026". Dihitung dari `Date.now() + selectedDays * 86400000`.

5. **Tombol "Lanjut ke Pembayaran →"** — disabled selama fetch buku belum selesai atau gagal.

**Navigation output:**
```typescript
router.push({
  pathname: '/payment',
  params: { bookId, selectedDays: String(selectedDays), dueDate: isoString },
});
```

### Halaman E — Katalog (`/(tabs)/catalog.tsx`)

- List semua buku dari `books/` dengan real-time listener
- Filter kategori (chip horizontal scroll)
- Search bar (filter lokal, tanpa fetch ulang)
- Item: cover placeholder, judul, penulis, status badge
- Tap item → `/book/[id]`

### Halaman F — Bayar / Aksi (`/(tabs)/payment.tsx`)

**State pertama yang muncul selalu QR Code** — State 1 (pilih buku) sudah tidak ada, karena entry point kini dari `duration.tsx`.

**Mode Pinjam (masuk via `duration.tsx`):**
- Params diterima: `bookId`, `selectedDays`, `dueDate`
- State 2: tampilkan QR Code simulasi + card buku + info durasi
- Tombol "Konfirmasi Pembayaran" → `confirmPayment()`:
  - Multi-path atomic update: `paymentStatus: 'success'`, `lockStatus: 'unlocked'`, `borrowDate`
  - Auto-relock 30s via `setTimeout` (global timer, tetap berjalan setelah navigasi)
  - `router.replace('/receipt', { transactionId, type: 'borrow' })`

**Mode Kembalikan (masuk dari init screen):**
- List transaksi aktif milik user
- Tap transaksi → detail (judul, jatuh tempo, estimasi denda)
- "Konfirmasi Pengembalian" → `doConfirmReturn()` → `router.replace('/receipt', { ..., type: 'return' })`

**Init screen (pilih mode):**
- Dua kartu: "Pinjam Buku" (→ Katalog) dan "Kembalikan Buku" (→ list transaksi aktif)

### Halaman G — Riwayat (`/(tabs)/history.tsx`)

- List semua transaksi milik user (filter by `memberId`)
- Status badge: `active` (biru), `completed` (hijau), `overdue` (merah)
- Info per item: judul buku, tanggal pinjam, tanggal kembali, denda
- Sort: terbaru di atas

### Halaman H — Profil (`/(tabs)/profile.tsx`)

- Avatar dengan initials + warna dari nama
- Info: nama, email, status akun, tanggal bergabung
- Statistik: total dipinjam, sedang dipinjam, total denda
- Section "Notifikasi" dengan badge merah (unread count) — real-time via `onValue` pada `notifications/{memberId}`
- Modal notifikasi: list item dengan background biru (unread) / abu-abu (read), tap → set `read: true` ke Firebase
- Tombol Keluar → `signOut(auth)`

### Halaman I — Vintage Receipt (`/receipt`)

Muncul setelah `confirmPayment()` resolve, via `router.replace` (tidak bisa di-back).

**4 Zone berurutan (dalam ViewShot untuk share):**

| Zone | Background | Konten |
|------|-----------|--------|
| 1 — Header | `#1A1A2E` (gelap) | Eyebrow "Perpustakaan RackGuard", title serif, subtitle, 4 corner ornaments emas |
| 2 — Body | `#F5F0E8` (cream) | Grid field 2-kolom, rotated stamp −12° (DIPINJAM / DIKEMBALIKAN), diamond ornaments |
| 3 — Perforated Divider | cream / gelap | SVG: lingkaran kiri-kanan (warna page bg dari `useColorScheme()`), dashed line tengah |
| 4 — Stub | `#1A1A2E` (gelap) | Transaction ID (kiri), tanggal kembali (kanan) |

**Tombol (di luar ViewShot):**
- "Bagikan" → `captureRef` → PNG → `Sharing.shareAsync`
- "Selesai" → `router.replace('/(tabs)')`

---

## 4. Firebase Database Structure

```
Firebase Realtime Database
├── users/
│   └── {uid}/
│       ├── name: string
│       ├── email: string
│       ├── avatar: string           // initials
│       ├── status: 'active' | 'warned' | 'suspended'
│       ├── memberSince: string      // YYYY-MM-DD
│       ├── totalBorrowed: number
│       ├── currentBorrowed: number
│       └── totalFines: number
│
├── books/
│   └── {bookId}/
│       ├── title, author, isbn, category
│       ├── rackLocation: string     // e.g. "RACK-A-1"
│       ├── rfidTag: string
│       ├── status: 'available' | 'borrowed' | 'overdue'
│       ├── coverUrl?: string
│       └── description?: string
│
├── transactions/
│   └── {txId}/                      // TX-{timestamp}
│       ├── type: 'borrow' | 'return'
│       ├── bookId, bookTitle
│       ├── memberId, memberName
│       ├── borrowDate, dueDate, returnDate
│       ├── fine: number             // Rupiah
│       ├── status: 'active' | 'completed' | 'overdue'
│       ├── paymentStatus: 'pending' | 'success'
│       └── reminderSent?: boolean
│
├── shelves/
│   └── {shelfId}/                   // e.g. "RACK-A-1"
│       ├── name, location
│       ├── capacity: { current, max }
│       ├── lockStatus: 'locked' | 'unlocked'
│       ├── connectivity: 'online' | 'offline'
│       └── lastUpdate: number
│
└── notifications/
    └── {uid}/
        └── {notifId}/
            ├── userId: string
            ├── type: 'reminder' | 'overdue' | 'fine' | 'system'
            ├── title, message: string
            ├── read: boolean
            └── createdAt: number    // Unix ms
```

---

## 5. User Flow Utama

### Flow 1 — Peminjaman Buku

```
Login/Register
    ↓
Katalog → tap buku → Detail Buku
    ↓
"Pinjam Sekarang" → /duration
    ↓ (pilih 7/14/21 hari atau custom, lihat live due date)
"Lanjut ke Pembayaran" → /payment (bookId + selectedDays + dueDate)
    ↓ (lihat QR Code simulasi)
"Konfirmasi Pembayaran"
    ↓ (Firebase: paymentStatus→success, lockStatus→unlocked, auto-relock 30s)
/receipt (vintage ticket) → "Selesai" → Beranda
```

### Flow 2 — Pengembalian Buku

```
Tab "Bayar / Aksi" → "Kembalikan Buku"
    ↓
List transaksi aktif → tap transaksi
    ↓
Detail pengembalian (estimasi denda)
    ↓
"Konfirmasi Pengembalian"
    ↓ (Firebase: status→completed, lockStatus→unlocked, auto-relock 30s)
/receipt (stamp: DIKEMBALIKAN) → "Selesai" → Beranda
```

### Flow 3 — Notifikasi Real-time

```
GAS cron (tengah malam):
    → Filter transactions: status=active && dueDate H-1 atau overdue
    → MailApp.sendEmail() ke email user
    → pushNode('notifications/{uid}', {...})
    → updateNode('transactions/{txId}', { reminderSent: true })

Mobile app (profile.tsx):
    → onValue('notifications/{memberId}') → badge count (unread)
    → User buka modal → list notifikasi
    → Tap item → update(ref, 'notifications/{uid}/{id}/read': true)
```

---

## 6. Design Tokens (Mobile)

### Warna Utama

| Token | Hex | Penggunaan |
|-------|-----|-----------|
| Brand dark | `#1A1F2E` | Header, tombol utama, background auth |
| Blue primary | `#3B82F6` | CTA, tab aktif, link, badge |
| Green success | `#10B981` | Status tersedia, sukses |
| Amber warning | `#F59E0B` | Status warn, overdue warning |
| Red danger | `#EF4444` | Status overdue, error |
| Surface | `#F9FAFB` | Background halaman |
| White card | `#FFFFFF` | Background card |
| Border | `#E5E7EB` | Border card, divider |
| Muted text | `#6B7280` | Teks sekunder |

### Warna Receipt (lokal di `receipt.tsx` saja)

| Token | Hex | Penggunaan |
|-------|-----|-----------|
| `C.paper` | `#F5F0E8` | Background body receipt |
| `C.dark` | `#1A1A2E` | Background header + stub |
| `C.gold` | `#C8A96E` | Ornamen, border stamp, accent |
| `C.brown` | `#8B7355` | Label text di body |
| `C.border` | `#C8B89A` | Border card receipt |

---

## 7. Checklist Development — Mobile App

### Setup & Core
- [x] Expo project dengan Firebase JS SDK
- [x] Auth guard (`_layout.tsx`) dengan Zustand store
- [x] Font loading (`PlayfairDisplay_700Bold`, `SpecialElite_400Regular`)
- [x] Tab layout 5-tab dengan custom bottom bar
- [x] Login & Register screen

### Halaman
- [x] Beranda (index.tsx) — dashboard peminjam
- [x] Katalog (catalog.tsx) — list + filter + search
- [x] Detail Buku (book/[id].tsx) — route ke `/duration`
- [ ] **Halaman Pilih Durasi (duration.tsx):**
  - [ ] Card ringkasan buku dari Firebase fetch (skeleton saat loading)
  - [ ] Chip preset 7/14/21 hari dengan snap ke picker
  - [ ] Scroll picker 1–30 hari, default 7
  - [ ] Live due date display real-time
  - [ ] Pass `bookId` + `selectedDays` + `dueDate` ke `payment.tsx`
  - [ ] "Pinjam Sekarang" di `book/[id].tsx` route ke `duration.tsx`, bukan `payment.tsx`
- [x] Bayar / Aksi (payment.tsx) — Mode Pinjam (terima params dari duration) + Mode Kembalikan
- [x] Riwayat (history.tsx)
- [x] Profil (profile.tsx) — dengan notifikasi real-time
- [x] Vintage Receipt (receipt.tsx) — 4 zone, share via expo-sharing

### Integrasi
- [x] Firebase Auth (email/password)
- [x] Firebase Realtime Database (read/write/listen)
- [x] QR Code simulasi (react-native-qrcode-svg)
- [x] Multi-path atomic update untuk confirmPayment()
- [x] Auto-relock 30s via setTimeout
- [ ] Firebase Security Rules (set di Console)

---

## 8. Library & Dependencies (Mobile)

| Package | Versi | Kegunaan |
|---------|-------|---------|
| `expo` | ~54.0 | SDK utama |
| `expo-router` | ~6.0 | File-based navigation |
| `firebase` | JS SDK | Auth + Realtime Database |
| `zustand` | — | State management |
| `react-native-qrcode-svg` | ^6.3 | QR Code generator |
| `react-native-svg` | ^15.12 | SVG (perforated divider) |
| `expo-font` | ~14.0 | Custom font loading |
| `@expo-google-fonts/playfair-display` | — | Serif font (receipt) |
| `@expo-google-fonts/special-elite` | — | Typewriter font (receipt) |
| `react-native-view-shot` | — | Screenshot komponen → PNG |
| `expo-sharing` | — | Native share sheet |
| `expo-secure-store` | ~15.0 | Secure storage |
| `lucide-react-native` | ^0.408 | Icon set |

---

## 9. Catatan Penting

1. **Expo Go compatible** — tidak perlu EAS Build. Semua library yang dipakai bekerja di Expo Go.
2. **Firebase JS SDK, bukan native** — `firebase` (JS), bukan `@react-native-firebase/*`.
3. **UI copy Bahasa Indonesia, code Bahasa Inggris** — variabel, komentar, dan identifier harus dalam Bahasa Inggris.
4. **Status vocabulary strict** — gunakan exact strings: `'pending'`, `'success'`, `'active'`, `'completed'`, `'overdue'`, `'locked'`, `'unlocked'`.
5. **Receipt fonts receipt-only** — `Playfair Display` dan `Special Elite` tidak boleh bocor ke komponen lain.
6. **Perforated divider via SVG** — React Native memotong overflow, sehingga lingkaran "lubang" harus dirender via `react-native-svg`, bukan View biasa.
7. **Auto-relock via global setTimeout** — timer berjalan via global JS timer, tetap aktif setelah `router.replace`. Firebase write tetap terjadi bahkan setelah component unmount.
8. **Multi-path update wajib untuk confirmPayment()** — gunakan `update(ref(db, '/'), { ...multiple paths... })`, bukan dua write terpisah.
9. **duration.tsx adalah entry point baru** — `book/[id].tsx` harus route ke `/duration`, bukan `/payment`. Payment selalu menerima context dari duration.
10. **GAS tidak di repo** — Google Apps Script berada di `script.google.com`, bukan bagian dari repo ini. Secret disimpan di Script Properties, bukan di kode.
