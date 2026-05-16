# AGENT_CONTEXT.md

Operational context for AI agents working on RackGuard. Read this before touching any code.

**What this file is:** current implementation state + exact gaps to fill.
**What this file is not:** a spec or architecture doc. For those, see `ROADMAP.md`, `RackGuard_Frontend_Context.md`, `CLAUDE.md`, `DESIGN.md`.

---

## How to Use This File

1. Read **Current State** to know what already exists — don't rebuild it.
2. Find the task you're assigned in **Open Gaps**.
3. Follow **Success Criteria** exactly — that's how you know you're done.
4. If something is ambiguous, surface it before writing code.

---

## Repo Layout

```
RackGuard/          ← Mobile app (React Native + Expo) — THIS REPO
RackGuard-web/      ← Web dashboard (Next.js) — SEPARATE REPO
script.google.com   ← GAS email automation — SEPARATE ENVIRONMENT (not a repo)
```

---

## Current State (What's Already Built)

### Mobile App — `RackGuard/` (Expo, Firebase JS SDK)

| File | Status | What it does |
|------|--------|--------------|
| `_layout.tsx` | ✅ Done | Tab 3 renamed "Bayar/Aksi", QR icon, scan tab hidden (`href: null`). Loads `PlayfairDisplay_700Bold` + `SpecialElite_400Regular` fonts at app entry. |
| `payment.tsx` | ✅ Done | Payment screen: Kembalikan mode (active tx list → detail → confirm → receipt). Pinjam mode now receives `bookId` + `selectedDays` + `dueDate` from `duration.tsx` — State 1 (pilih buku) sudah dihapus. After confirm: 30s auto-lock timer + `router.replace('/receipt')`. |
| `receipt.tsx` | ✅ Done | Vintage concert-ticket receipt screen (4 zones: Header, Body, Perforated Divider, Stub). Playfair Display + Special Elite fonts. Share via `expo-sharing`. `router.replace('/(tabs)')` on done. |
| `book/[id].tsx` | ✅ Done | "Pinjam Sekarang" routes to `/duration?bookId=...` — duration picker screen sebelum payment. |
| `duration.tsx` | ❌ Not done | Duration picker screen — muncul setelah "Pinjam Sekarang", sebelum QR payment. Berisi card buku, chip preset (7/14/21 hari), scroll picker (1–30), live due date. Lihat GAP 6. |
| `types/index.ts` | ✅ Done | `paymentStatus?: 'pending' \| 'success'` added to `Transaction` type. |
| `login.tsx` | ✅ Done | Firebase email/password auth, forgot password via email reset. |
| `register.tsx` | ✅ Done | Firebase createUser + write member profile to `users/{uid}`. Domain restricted to `@std.stei.itb.ac.id`. |

### Firebase (Realtime Database)

- `transactions/` node is being written correctly by `payment.tsx`
- `status` and `dueDate` fields are present and correct — GAS can consume them now
- `shelves/{id}/lockStatus` is written by `payment.tsx` on confirm + auto-locked after 30s
- `notifications/{uid}/` is read by `profile.tsx` via `onValue` for real-time badge

---

## Open Gaps

### GAP 1 — Mobile App: `paymentStatus: 'pending'` on transaction creation

**Repo:** `RackGuard/` · **File:** `payment.tsx` · **Priority:** Low (simulation works without it, but deviates from schema spec)

**Current behavior:** Transaction is created with `paymentStatus: 'pending'` on mount, but the payment confirmation step uses a single multi-path `update()`. Verify the pending state is actually written before the user taps confirm.

**Expected behavior per schema:**
1. User selects book → transaction written → `paymentStatus: 'pending'`
2. User taps "Konfirmasi Pinjam" → `paymentStatus` flipped to `'success'` atomically with `lockStatus`

**Important:** The confirm step must use a multi-path `update()` (single write to db root ref) — not two separate writes. This prevents race conditions.

**Success criteria:**
- [ ] A transaction exists in Firebase with `paymentStatus: 'pending'` before user taps confirm
- [ ] After confirm, the same transaction has `paymentStatus: 'success'`
- [ ] The `paymentStatus` flip and `lockStatus` change happen in a single `Firebase update()` call

---

### GAP 2 — Firebase Security Rules

**Repo:** N/A — set manually in Firebase Console · **Priority:** Medium (blocking for production, not for development)

**Rules to set** in Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "transactions": {
      "$txId": {
        ".read": "auth !== null && (data.child('memberId').val() === auth.uid || root.child('users/' + auth.uid + '/role').val() === 'admin')",
        ".write": "auth !== null && (data.child('memberId').val() === auth.uid || root.child('users/' + auth.uid + '/role').val() === 'admin')",
        "paymentStatus": {
          ".write": "auth !== null && data.parent().child('memberId').val() === auth.uid"
        }
      }
    },
    "shelves": {
      "$shelfId": {
        ".read": "auth !== null",
        "lockStatus": { ".write": "auth !== null" }
      }
    },
    "users": {
      "$uid": {
        ".read": "auth !== null && (auth.uid === $uid || root.child('users/' + auth.uid + '/role').val() === 'admin')",
        ".write": "auth !== null && auth.uid === $uid"
      }
    },
    "books": {
      ".read": "auth !== null",
      ".write": "auth !== null && root.child('users/' + auth.uid + '/role').val() === 'admin'"
    },
    "notifications": {
      "$uid": {
        ".read": "auth !== null && auth.uid === $uid",
        ".write": "auth !== null && auth.uid === $uid"
      }
    }
  }
}
```

**Success criteria:**
- [ ] Unauthenticated write to `transactions/` → rejected
- [ ] Authenticated user writing to another user's `paymentStatus` → rejected
- [ ] Authenticated user writing to their own `paymentStatus` → accepted
- [ ] Admin (`role === 'admin'`) can write to any transaction → accepted

---

### GAP 3 — Google Apps Script: Email Automation

**Repo:** N/A — lives at `script.google.com` · **Priority:** High (100% unimplemented, entirely independent of mobile app)
**Prerequisite:** Firebase data is ready. GAS can be built now.

**Context:** GAS runs on Google's servers, reads Firebase via `UrlFetchApp`, sends email via Gmail's internal quota (`MailApp` — no external API key needed), triggers on a time-based schedule.

#### Step 1 — Create the project
1. Go to [script.google.com](https://script.google.com)
2. New project → rename to `RackGuard-EmailAutomation`
3. Project Settings → Script Properties → add:
   - `FB_SECRET` → Firebase Database secret (Firebase Console → Project Settings → Service accounts → Database secrets)
   - `DB_URL` → `https://[your-project-id].firebaseio.com`

#### Step 2 — Core script (`Code.gs`)

```javascript
const PROPS = PropertiesService.getScriptProperties();
const DB_URL = PROPS.getProperty('DB_URL');
const FB_SECRET = PROPS.getProperty('FB_SECRET');

function fetchNode(path) {
  const url = `${DB_URL}/${path}.json?auth=${FB_SECRET}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) { Logger.log(`fetchNode failed: ${path}`); return null; }
  return JSON.parse(response.getContentText());
}

function updateNode(path, payload) {
  UrlFetchApp.fetch(`${DB_URL}/${path}.json?auth=${FB_SECRET}`, {
    method: 'patch', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
}

function pushNode(path, payload) {
  UrlFetchApp.fetch(`${DB_URL}/${path}.json?auth=${FB_SECRET}`, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
}

function checkOverdueAndSendEmail() {
  const transactions = fetchNode('transactions');
  if (!transactions) { Logger.log('No transactions or fetch failed.'); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let emailsSent = 0;

  Object.entries(transactions).forEach(([txId, tx]) => {
    if (tx.status !== 'active' || !tx.dueDate || !tx.memberId) return;
    const due = new Date(tx.dueDate); due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / 86400000);

    if (diffDays === 1 && !tx.reminderSent) {
      const user = fetchNode(`users/${tx.memberId}`);
      if (!user?.email) return;
      const dueDateStr = due.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      try {
        MailApp.sendEmail({ to: user.email,
          subject: `[RackGuard] Pengingat: "${tx.bookTitle}" jatuh tempo besok`,
          htmlBody: `<p>Halo <b>${user.name}</b>, buku <b>"${tx.bookTitle}"</b> jatuh tempo besok (${dueDateStr}). Kembalikan melalui app RackGuard.</p>` });
        updateNode(`transactions/${txId}`, { reminderSent: true });
        pushNode(`notifications/${tx.memberId}`, { userId: tx.memberId, type: 'reminder',
          title: 'Pengingat Pengembalian Buku',
          message: `Buku "${tx.bookTitle}" jatuh tempo besok (${dueDateStr}).`,
          read: false, createdAt: Date.now() });
        emailsSent++;
        Logger.log(`H-1 reminder sent to ${user.email} for tx ${txId}`);
      } catch (e) { Logger.log(`Failed H-1 for ${txId}: ${e.message}`); }
      return;
    }

    if (diffDays < 0) {
      const user = fetchNode(`users/${tx.memberId}`);
      if (!user?.email) return;
      const daysOverdue = Math.abs(diffDays);
      const fine = tx.fine ?? daysOverdue * 1000;
      const dueDateStr = due.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      try {
        MailApp.sendEmail({ to: user.email,
          subject: `[RackGuard] Buku "${tx.bookTitle}" telah melewati batas waktu`,
          htmlBody: `<p>Halo <b>${user.name}</b>, buku <b>"${tx.bookTitle}"</b> terlambat ${daysOverdue} hari. Denda: Rp ${fine.toLocaleString('id-ID')}.</p>` });
        updateNode(`transactions/${txId}`, { status: 'overdue', fine });
        pushNode(`notifications/${tx.memberId}`, { userId: tx.memberId, type: 'overdue',
          title: 'Keterlambatan Pengembalian Buku',
          message: `Buku "${tx.bookTitle}" terlambat ${daysOverdue} hari. Denda: Rp ${fine.toLocaleString('id-ID')}.`,
          read: false, createdAt: Date.now() });
        emailsSent++;
        Logger.log(`Overdue alert sent to ${user.email} for tx ${txId}`);
      } catch (e) { Logger.log(`Failed overdue for ${txId}: ${e.message}`); }
    }
  });

  Logger.log(`Done. ${emailsSent} email(s) sent.`);
}

function setupTestTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkOverdueAndSendEmail')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkOverdueAndSendEmail').timeBased().after(15 * 60 * 1000).create();
  Logger.log('Test trigger set — fires in ~15 min.');
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkOverdueAndSendEmail')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkOverdueAndSendEmail').timeBased().everyDays(1).atHour(0).create();
  Logger.log('Daily trigger set — runs at midnight.');
}
```

**Success criteria:**
- [ ] `checkOverdueAndSendEmail()` runs without error in Execution Log
- [ ] Email received with correct `namaUser`, `judulBuku`, `dueDate`
- [ ] Transaction `status` updated to `'overdue'` in Firebase after overdue email
- [ ] `reminderSent: true` written after H-1 reminder (prevents duplicate)
- [ ] Daily trigger visible in Triggers tab
- [ ] No secret hardcoded in `Code.gs`

---

### GAP 4 — Web Dashboard: Phase 3 items

**Repo:** `RackGuard-web/` (Next.js, separate repo) · **Priority:** Medium

#### 4a — `paymentStatus` badge column in Transactions table

```tsx
function PaymentBadge({ status }: { status: 'pending' | 'success' | undefined }) {
  if (!status) return <span className="text-gray-400">—</span>;
  return status === 'success' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Lunas
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending
    </span>
  );
}
```

#### 4b — Firebase real-time listener on `transactions/`
Convert any `get()` on transactions to `onValue()` so the table updates without page refresh.

#### 4c — "Manual Unlock" button on Shelf Status page

```tsx
async function handleManualUnlock(shelfId: string) {
  if (!window.confirm(`Buka rak ${shelfId} secara manual?`)) return;
  await update(ref(db, `shelves/${shelfId}`), { lockStatus: 'unlocked' });
}
```

#### 4d — Reports: fine totals filtered by `paymentStatus === 'success'`

```typescript
const totalFines = transactions
  .filter(tx => tx.paymentStatus === 'success')
  .reduce((sum, tx) => sum + (tx.fine ?? 0), 0);
```

#### 4e — New KPI card: "Pembayaran Pending"

```typescript
const pendingPayments = transactions.filter(tx => tx.paymentStatus === 'pending').length;
```

Display as a KPI card with amber color.

---

### GAP 5 — Mobile App: Vintage Receipt Screen

**Repo:** `RackGuard/` · **File:** `receipt.tsx` · **Status:** ✅ Implemented
**Note:** receipt.tsx sudah dibuat. Verifikasi dengan test end-to-end (lihat ROADMAP.md section Verification).

---

### GAP 6 — Mobile App: Duration Picker Screen

**Repo:** `RackGuard/` · **File baru:** `duration.tsx` · **Priority:** Medium
**Harus selesai sebelum GAP 5 dapat ditest end-to-end** — `duration.tsx` adalah entry point baru ke payment flow.
**Prerequisite:** `book/[id].tsx` sudah jalan, `payment.tsx` sudah jalan.

#### Perubahan di `book/[id].tsx`

Satu baris yang berubah — ganti destination routing:

```typescript
// Sebelum:
router.push({ pathname: '/(tabs)/payment', params: { bookId } });

// Sesudah:
router.push({ pathname: '/duration', params: { bookId } });
```

#### Perubahan di `payment.tsx`

`payment.tsx` sekarang selalu menerima tiga params: `bookId`, `selectedDays`, `dueDate`. State 1 (tampilan "pilih buku dari katalog") sudah dihapus — payment langsung masuk ke State 2 (QR Code + konfirmasi). `dueDate` diterima sebagai param string ISO dari `duration.tsx`.

#### Struktur `duration.tsx`

Layout dari atas ke bawah:

1. **Card ringkasan buku** — fetch by `bookId` dari Firebase (satu kali, `get()` bukan `onValue()`). Tampilkan **skeleton** saat loading (bukan spinner). Setelah fetch: judul, penulis, lokasi rak. Ini konteks keputusan durasi — bukan dekorasi.

2. **Section "Pilih Durasi Peminjaman"** dengan dua elemen:
   - Tiga chip preset: `"7 Hari"`, `"14 Hari"`, `"21 Hari"`. Tap chip → snap picker ke nilai tersebut. Chip aktif mendapat highlight. Default chip aktif: 7 Hari.
   - Scroll picker angka hari — range 1–30. Default 7. Scroll picker ke custom value → semua chip menjadi tidak aktif (deselect).

3. **Display kalkulasi live** — satu baris teks: `"Kembalikan sebelum [tanggal]"`. Tanggal dihitung dari `Date.now() + selectedDays * 86400000`, diformat ke format Indonesia (contoh: "30 Mei 2026"). Harus update tanpa delay terasa — tidak boleh ada `setTimeout` atau debounce.

4. **Tombol "Lanjut ke Pembayaran"** — disabled selama fetch buku belum selesai atau buku tidak ditemukan.

#### Navigation

```typescript
router.push({
  pathname: '/payment',
  params: {
    bookId,
    selectedDays: String(selectedDays),
    dueDate: new Date(Date.now() + selectedDays * 86400000).toISOString(),
  },
});
```

#### Data yang dibutuhkan

| Sumber | Data |
|--------|------|
| Route params | `bookId` |
| Firebase `get()` | `book.title`, `book.author`, `book.rackLocation` |
| Local state | `selectedDays` (default 7) |
| Calculated client-side | `dueDate` dari `selectedDays` — jangan fetch dari Firebase |

#### Stack registration

Tambahkan di `app/_layout.tsx` Stack:
```tsx
<Stack.Screen name="duration" options={{ headerShown: false }} />
```

#### Success criteria

- [ ] Chip preset "7 Hari" aktif by default saat halaman pertama dibuka
- [ ] Tap chip → picker snap ke nilai yang sesuai
- [ ] Scroll picker ke angka custom → semua chip menjadi tidak aktif
- [ ] Teks "Kembalikan sebelum [tanggal]" berubah real-time setiap picker bergeser, tanpa lag terasa
- [ ] Card buku menampilkan skeleton saat fetch, data aktual setelah selesai
- [ ] Tombol "Lanjut ke Pembayaran" ter-disabled selama fetch buku belum selesai
- [ ] `payment.tsx` menerima `bookId`, `selectedDays`, `dueDate` sebagai params dan langsung masuk ke State 2 (QR Code) tanpa State 1

---

## Quick Reference: Data Shapes

```typescript
interface Transaction {
  id: string;              // TX-XXXX
  type: 'borrow' | 'return';
  bookId: string;
  bookTitle: string;
  memberId: string;
  memberName: string;
  borrowDate: string;      // ISO date string
  dueDate: string;         // ISO date string
  returnDate: string | null;
  fine: number;            // Rupiah
  status: 'active' | 'completed' | 'overdue';
  paymentStatus?: 'pending' | 'success';
  reminderSent?: boolean;
}

interface Book {
  id: string;
  title: string;
  author: string;
  rackLocation: string;   // e.g. "RACK-A-1"
  status: 'available' | 'borrowed' | 'overdue';
}

interface Shelf {
  id: string;
  lockStatus: 'locked' | 'unlocked';
}

interface Notification {
  id: string;
  userId: string;
  type: 'reminder' | 'overdue' | 'fine' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: number; // Unix ms
}
```

---

## Firebase Multi-Path Update Pattern

```typescript
// ✅ Correct — single atomic write
await update(ref(db, '/'), {
  [`transactions/${txId}/paymentStatus`]: 'success',
  [`shelves/${rackId}/lockStatus`]: 'unlocked',
  [`transactions/${txId}/borrowDate`]: borrowDate,
});

// ❌ Wrong — two separate writes = race condition risk
await update(ref(db, `transactions/${txId}`), { paymentStatus: 'success' });
await update(ref(db, `shelves/${rackId}`), { lockStatus: 'unlocked' });
```

---

## Constraints (from CLAUDE.md)

- Don't implement real payment gateway — pseudo/simulation only
- Don't reintroduce NFC — replaced by payment flow
- Don't add features beyond the gaps listed here without explicit request
- UI copy in Bahasa Indonesia; code, comments, variables in English
- Status vocabulary is strict — use exact strings: `'pending'`, `'success'`, `'active'`, `'overdue'`, `'locked'`, `'unlocked'`
- Match existing code style — don't "improve" adjacent code
- Receipt fonts (`Playfair Display`, `Special Elite`) are `receipt.tsx`-only — don't use elsewhere
- Perforated divider circle color must come from `useColorScheme()` — never hardcode
