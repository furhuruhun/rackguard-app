# RackGuard — Mobile App

> Sistem Rak Buku Pintar dengan Penguncian Elektronik
> Mata Kuliah II3240 Rekayasa Sistem dan Teknologi Informasi — Kelompok 01

---

## Apa Itu RackGuard?

RackGuard adalah sistem peminjaman buku berbasis IoT yang terdiri dari:
- **Mobile App** (repo ini) — antarmuka peminjam
- **Web Dashboard** (repo terpisah: `RackGuard-web/`) — panel admin
- **ESP32 + Solenoid** — pengunci rak fisik yang dikontrol via Firebase
- **Google Apps Script** — cron job email otomatis (H-1 + overdue)

Alih-alih NFC, sistem ini menggunakan **simulasi pembayaran berbasis QR Code** sebagai trigger pembuka solenoid — memungkinkan development di Expo Go tanpa native build.

---

## Cara Kerja Sistem

```
Peminjam (Mobile App)
    │
    ├─ 1. Pilih buku di Katalog → Detail Buku → tap "Pinjam Sekarang"
    │
    ├─ 2. Pilih durasi (duration.tsx): 7/14/21 hari atau custom picker
    │
    ├─ 3. Lihat QR Code simulasi (payment.tsx) → tap "Konfirmasi Pembayaran"
    │       ↓ (Firebase multi-path update)
    │       transactions/{id}/paymentStatus → 'success'
    │       shelves/{rackId}/lockStatus    → 'unlocked'
    │       transactions/{id}/borrowDate   → sekarang
    │
    ├─ 4. Tanda terima vintage (receipt.tsx) muncul — bisa di-share sebagai PNG
    │
    └─ 5. Rak terbuka selama 30 detik → auto-relock

ESP32 (Hardware)
    └─ Firebase listener pada lockStatus → solenoid terbuka 30 detik

Google Apps Script (Tengah Malam)
    ├─ Fetch transactions dari Firebase
    ├─ H-1: kirim email reminder + tulis notifikasi ke Firebase
    └─ Overdue: kirim email peringatan + update status + tulis notifikasi

Mobile App (Real-time)
    └─ profile.tsx mendengarkan notifications/{uid} via onValue
       → badge merah muncul tanpa refresh
```

---

## Struktur File Penting

```
app/
├── _layout.tsx          Stack root + AuthGuard + font loading
├── login.tsx            Halaman login
├── register.tsx         Halaman registrasi
├── receipt.tsx          Tanda terima vintage (setelah konfirmasi)
├── duration.tsx         ⚠️ BELUM DIBUAT — pilih durasi peminjaman
├── (tabs)/
│   ├── _layout.tsx      Tab bar custom (5 tab)
│   ├── index.tsx        Beranda
│   ├── catalog.tsx      Katalog buku
│   ├── payment.tsx      Bayar / Aksi (QR + kembalikan)
│   ├── history.tsx      Riwayat transaksi
│   ├── profile.tsx      Profil + notifikasi real-time
│   └── scan.tsx         (hidden, href: null)
└── book/
    └── [id].tsx         Detail buku

lib/
├── firebase.ts          Inisialisasi Firebase app, auth, database
└── utils.ts             formatDate, formatCurrency, getInitials, dll.

store/
└── authStore.ts         Zustand store: firebaseUser, member, memberId

types/
└── index.ts             TypeScript interfaces: Member, Book, Transaction, Shelf, Notification
```

---

## Dokumen Pendamping

| File | Isi | Untuk Siapa |
|------|-----|-------------|
| [`ROADMAP.md`](./ROADMAP.md) | To-do list implementasi per phase (Payment, GAS, Web Dashboard, Receipt) | Developer — roadmap kerja |
| [`AGENT_CONTEXT.md`](./AGENT_CONTEXT.md) | Current state + open gaps dengan success criteria yang verifiable | AI agent / developer — task execution |
| [`RackGuard_Frontend_Context.md`](./RackGuard_Frontend_Context.md) | Spec lengkap semua halaman, database structure, design tokens, checklist | Developer baru — onboarding |
| `CLAUDE.md` | Behavioral guidelines untuk AI agent (simplicity, surgical changes, dll.) | AI agent |
| `DESIGN.md` | Design tokens, typography, component patterns, receipt spec visual | AI agent + designer |

---

## Flow Navigasi

```
/login ──────────────────────────────────────────── (auth required)
    │
    └─ /(tabs)
         ├─ /index          (Beranda)
         ├─ /catalog        (Katalog)
         │    └─ /book/[id] (Detail Buku)
         │         └─ /duration        (Pilih Durasi) ← BELUM ADA
         │              └─ /(tabs)/payment (QR + Konfirmasi)
         │                   └─ /receipt  (Tanda Terima)
         ├─ /payment        (Bayar / Aksi — init screen)
         │    └─ (mode kembalikan → receipt)
         ├─ /history        (Riwayat)
         └─ /profile        (Profil + Notifikasi)
```

---

## Firebase Database Nodes

| Node | Digunakan oleh | Keterangan |
|------|---------------|-----------|
| `users/{uid}` | Mobile auth, GAS | Profil member |
| `books/{bookId}` | Katalog, detail, payment | Data buku |
| `transactions/{txId}` | Payment, history, GAS | Rekaman peminjaman |
| `shelves/{shelfId}` | Payment, web dashboard, ESP32 | Status kunci rak |
| `notifications/{uid}/{id}` | Profile (onValue), GAS | Notifikasi real-time |

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| Auth (login/register) | ✅ Selesai |
| Beranda | ✅ Selesai |
| Katalog + Detail Buku | ✅ Selesai |
| **Duration Picker** (`duration.tsx`) | ❌ Belum |
| Payment / QR + Kembalikan | ✅ Selesai |
| Vintage Receipt | ✅ Selesai |
| Profil + Notifikasi real-time | ✅ Selesai |
| Riwayat | ✅ Selesai |
| Firebase Security Rules | ❌ Perlu set manual di Console |
| GAS Email Automation | ❌ Belum (lihat AGENT_CONTEXT.md GAP 3) |
| Web Dashboard updates | ❌ Belum (lihat AGENT_CONTEXT.md GAP 4) |

---

## Quick Start Dev

```bash
# Install dependencies
npm install --legacy-peer-deps

# Jalankan di Expo Go
npx expo start

# TypeScript check
npx tsc --noEmit
```

**Environment variables** (`.env` atau `app.config.js`):
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=
```

---

## Task Prioritas Berikutnya

1. **Buat `duration.tsx`** (lihat AGENT_CONTEXT.md GAP 6) — entry point baru ke payment flow
2. **Update `book/[id].tsx`** — ganti route ke `/duration` (satu baris)
3. **Set Firebase Security Rules** (lihat AGENT_CONTEXT.md GAP 2)
4. **Setup GAS** (lihat AGENT_CONTEXT.md GAP 3) — email automation
5. **Update Web Dashboard** (lihat AGENT_CONTEXT.md GAP 4)
