import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { ref as dbRef, get, update, set, remove } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Book, Transaction } from '@/types'
import {
  RotateCcw, ArrowLeft,
  CreditCard, BookOpen, AlertCircle,
} from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { formatDate, formatCurrency } from '@/lib/utils'

type Stage =
  | { kind: 'init' }
  | { kind: 'loading' }
  | { kind: 'pinjam'; book: Book; qrValue: string; txId: string; rackId: string }
  | { kind: 'return_list'; transactions: Transaction[] }
  | { kind: 'return_detail'; tx: Transaction; rackLocation: string }
  | { kind: 'confirming' }
  | { kind: 'error'; message: string }

const FINE_PER_DAY = 1000
const LOAN_DAYS = 14

// Does NOT schedule auto-lock — caller manages the timer via lockTimerRef
async function doConfirmBorrow(
  book: Book, txId: string, rackId: string, loanDays: number,
): Promise<void> {
  const now = new Date()
  const borrowDate = now.toISOString().split('T')[0]
  const dueDate = new Date(now.getTime() + loanDays * 86400000).toISOString().split('T')[0]

  await update(dbRef(database), {
    [`transactions/${txId}/paymentStatus`]: 'success',
    [`transactions/${txId}/borrowDate`]: borrowDate,
    [`transactions/${txId}/dueDate`]: dueDate,
    [`books/${book.id}/status`]: 'borrowed',
    [`shelves/${rackId}/lockStatus`]: 'unlocked',
  })
}

async function doConfirmReturn(
  tx: Transaction, rackLocation: string,
): Promise<{ rackId: string; fine: number }> {
  const now = new Date()
  const returnDate = now.toISOString().split('T')[0]
  const due = new Date(tx.dueDate)
  const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
  const fine = daysLate * FINE_PER_DAY
  // rackLocation already contains the full shelf key (e.g. "RACK-A-1")
  const rackId = rackLocation

  await update(dbRef(database), {
    [`transactions/${tx.id}/status`]: 'completed',
    [`transactions/${tx.id}/returnDate`]: returnDate,
    [`transactions/${tx.id}/fine`]: fine,
    [`books/${tx.bookId}/status`]: 'available',
    [`shelves/${rackId}/lockStatus`]: 'unlocked',
  })

  return { rackId, fine }
}


export default function PaymentScreen() {
  const { bookId, selectedDays: selectedDaysParam } = useLocalSearchParams<{ bookId?: string; selectedDays?: string }>()
  const { member, memberId } = useAuthStore()
  const [stage, setStage] = useState<Stage>({ kind: 'init' })
  const [activeTxsCache, setActiveTxsCache] = useState<Transaction[]>([])
  const processedBookIdRef = useRef<string | null>(null)
  const loanDays = Number(selectedDaysParam) || LOAN_DAYS

  // Auto-lock timer — starts after confirm, fires after 30s regardless of navigation
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track unconfirmed pending txId so it can be cleaned up if user navigates away
  const pendingTxRef = useRef<string | null>(null)

  useEffect(() => {
    if (stage.kind === 'pinjam') {
      pendingTxRef.current = stage.txId
    } else {
      pendingTxRef.current = null
    }
  }, [stage])

  // On unmount: delete any transaction that was never confirmed
  useEffect(() => {
    return () => {
      if (pendingTxRef.current) {
        remove(dbRef(database, `transactions/${pendingTxRef.current}`)).catch(() => {})
        pendingTxRef.current = null
      }
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bookId || processedBookIdRef.current === bookId) return
    if (!memberId || !member) return
    processedBookIdRef.current = bookId
    setStage({ kind: 'loading' })
    get(dbRef(database, `books/${bookId}`))
      .then(async (snap) => {
        if (!snap.exists()) {
          setStage({ kind: 'error', message: 'Buku tidak ditemukan.' })
          return
        }
        const book = { id: bookId, ...snap.val() } as Book
        if (book.status !== 'available') {
          setStage({ kind: 'error', message: 'Buku ini sudah tidak tersedia.' })
          return
        }
        const txId = `TX-${Date.now()}`
        // rackLocation already contains the full shelf key (e.g. "RACK-A-1")
        const rackId = book.rackLocation
        await update(dbRef(database, `transactions/${txId}`), {
          type: 'borrow',
          bookId: book.id,
          bookTitle: book.title,
          memberId,
          memberName: member.name,
          borrowDate: '',
          dueDate: '',
          returnDate: null,
          fine: 0,
          status: 'active',
          paymentStatus: 'pending',
        })
        setStage({
          kind: 'pinjam',
          book,
          qrValue: `RACKGUARD-BORROW-${bookId}-${txId}`,
          txId,
          rackId,
        })
      })
      .catch(() => setStage({ kind: 'error', message: 'Gagal memuat data buku.' }))
  }, [bookId])

  const handleOpenReturn = () => {
    if (!memberId) return
    setStage({ kind: 'loading' })
    get(dbRef(database, 'transactions'))
      .then((snap) => {
        const all = snap.exists()
          ? (snap.val() as Record<string, Omit<Transaction, 'id'>>)
          : {}
        const active = Object.entries(all)
          .map(([id, val]) => ({ id, ...val }))
          .filter((tx) => tx.memberId === memberId && tx.status === 'active' && tx.paymentStatus !== 'pending')
        setActiveTxsCache(active)
        setStage({ kind: 'return_list', transactions: active })
      })
      .catch(() => setStage({ kind: 'error', message: 'Gagal memuat transaksi.' }))
  }

  const handleSelectTransaction = (tx: Transaction) => {
    setStage({ kind: 'loading' })
    get(dbRef(database, `books/${tx.bookId}`))
      .then((snap) => {
        const book = snap.val() as Book | null
        setStage({ kind: 'return_detail', tx, rackLocation: book?.rackLocation ?? 'RACK-A-1' })
      })
      .catch(() => setStage({ kind: 'error', message: 'Gagal memuat data buku.' }))
  }

  const handleConfirmBorrow = () => {
    if (stage.kind !== 'pinjam' || !member || !memberId) return
    const { book, txId, rackId } = stage
    setStage({ kind: 'confirming' })
    doConfirmBorrow(book, txId, rackId, loanDays)
      .then(() => {
        lockTimerRef.current = setTimeout(() => {
          set(dbRef(database, `shelves/${rackId}/lockStatus`), 'locked').catch(() => {})
          lockTimerRef.current = null
        }, 30000)
        router.replace({ pathname: '/receipt', params: { transactionId: txId, type: 'borrow' } })
      })
      .catch(() => setStage({ kind: 'error', message: 'Konfirmasi gagal. Coba lagi.' }))
  }

  const handleCancelBorrow = () => {
    if (stage.kind !== 'pinjam') return
    remove(dbRef(database, `transactions/${stage.txId}`)).catch(() => {})
    setStage({ kind: 'init' })
  }

  const handleConfirmReturn = () => {
    if (stage.kind !== 'return_detail') return
    const { tx, rackLocation } = stage
    setStage({ kind: 'confirming' })
    doConfirmReturn(tx, rackLocation)
      .then(({ rackId }) => {
        lockTimerRef.current = setTimeout(() => {
          set(dbRef(database, `shelves/${rackId}/lockStatus`), 'locked').catch(() => {})
          lockTimerRef.current = null
        }, 30000)
        router.replace({ pathname: '/receipt', params: { transactionId: tx.id, type: 'return' } })
      })
      .catch(() => setStage({ kind: 'error', message: 'Konfirmasi gagal. Coba lagi.' }))
  }

  // ── Loading ──
  if (stage.kind === 'loading' || stage.kind === 'confirming') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFull}>
          <ActivityIndicator color="#3B82F6" size="large" />
          <Text style={styles.loadingText}>
            {stage.kind === 'confirming' ? 'Memproses...' : 'Memuat...'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Error ──
  if (stage.kind === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerFull}>
          <AlertCircle color="#EF4444" size={56} />
          <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
          <Text style={styles.errorMsg}>{stage.message}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setStage({ kind: 'init' })}
          >
            <Text style={styles.retryBtnText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Init / Mode Select ──
  if (stage.kind === 'init') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Bayar / Aksi</Text>
            <Text style={styles.subtitle}>Pilih aksi yang ingin dilakukan</Text>
          </View>

          <View style={styles.modeGrid}>
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => router.push('/(tabs)/catalog')}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: '#dbeafe' }]}>
                <BookOpen color="#3B82F6" size={32} />
              </View>
              <Text style={styles.modeLabel}>Pinjam Buku</Text>
              <Text style={styles.modeHint}>Pilih dari Katalog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeCard}
              onPress={handleOpenReturn}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIcon, { backgroundColor: '#d1fae5' }]}>
                <RotateCcw color="#10B981" size={32} />
              </View>
              <Text style={styles.modeLabel}>Kembalikan Buku</Text>
              <Text style={styles.modeHint}>Peminjaman aktif</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Pinjam: QR + Confirm ──
  if (stage.kind === 'pinjam') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Konfirmasi Pinjam</Text>
          </View>

          <View style={styles.bookCard}>
            <View style={styles.bookCoverSmall}>
              <BookOpen color="#6366f1" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookTitle} numberOfLines={2}>{stage.book.title}</Text>
              <Text style={styles.bookAuthor}>{stage.book.author}</Text>
              <Text style={styles.bookRack}>Rak {stage.book.rackLocation}</Text>
            </View>
          </View>

          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Kode Pembayaran (Simulasi)</Text>
            <View style={styles.qrBox}>
              <QRCode value={stage.qrValue} size={160} />
            </View>
            <Text style={styles.qrHint}>Tidak perlu dipindai — tekan konfirmasi di bawah</Text>
          </View>

          <View style={styles.infoRow}>
            <CreditCard color="#6b7280" size={15} />
            <Text style={styles.infoText}>
              {`Masa pinjam ${loanDays} hari · Denda Rp 1.000/hari jika terlambat`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmBorrow}
            activeOpacity={0.85}
          >
            <CreditCard color="#fff" size={18} />
            <Text style={styles.confirmBtnText}>Konfirmasi Pembayaran</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={handleCancelBorrow}
          >
            <Text style={styles.cancelLinkText}>Batal</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Return: Transaction List ──
  if (stage.kind === 'return_list') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <TouchableOpacity
            onPress={() => setStage({ kind: 'init' })}
            style={styles.backBtn}
          >
            <ArrowLeft color="#374151" size={20} />
          </TouchableOpacity>
          <Text style={styles.title}>Kembalikan Buku</Text>
        </View>

        {stage.transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen color="#d1d5db" size={48} />
            <Text style={styles.emptyTitle}>Tidak Ada Peminjaman Aktif</Text>
            <Text style={styles.emptyText}>Anda belum meminjam buku apapun.</Text>
          </View>
        ) : (
          <FlatList
            data={stage.transactions}
            keyExtractor={(tx) => tx.id}
            renderItem={({ item: tx }) => (
              <TouchableOpacity
                style={styles.txItem}
                onPress={() => handleSelectTransaction(tx)}
                activeOpacity={0.75}
              >
                <View style={styles.txIconWrap}>
                  <BookOpen color="#6366f1" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle} numberOfLines={2}>{tx.bookTitle}</Text>
                  <Text style={styles.txMeta}>Jatuh tempo: {formatDate(tx.dueDate)}</Text>
                  {tx.fine > 0 && (
                    <Text style={styles.txFine}>Denda: {formatCurrency(tx.fine)}</Text>
                  )}
                </View>
                <Text style={styles.txChevron}>›</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    )
  }

  // ── Return: Detail + Confirm ──
  if (stage.kind === 'return_detail') {
    const { tx } = stage
    const now = new Date()
    const due = new Date(tx.dueDate)
    const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
    const estimatedFine = daysLate * FINE_PER_DAY

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navHeader}>
            <TouchableOpacity
              onPress={() =>
                setStage({ kind: 'return_list', transactions: activeTxsCache })
              }
              style={styles.backBtn}
            >
              <ArrowLeft color="#374151" size={20} />
            </TouchableOpacity>
            <Text style={styles.title}>Konfirmasi Pengembalian</Text>
          </View>

          <View style={styles.returnCard}>
            {[
              { label: 'Judul Buku', value: tx.bookTitle },
              { label: 'Jatuh Tempo', value: formatDate(tx.dueDate) },
              {
                label: 'Keterlambatan',
                value: daysLate > 0 ? `${daysLate} hari` : 'Tepat waktu',
              },
              {
                label: 'Estimasi Denda',
                value: estimatedFine > 0 ? formatCurrency(estimatedFine) : '-',
                red: estimatedFine > 0,
              },
            ].map(({ label, value, red }) => (
              <View key={label} style={styles.returnRow}>
                <Text style={styles.returnLabel}>{label}</Text>
                <Text style={[styles.returnValue, red && { color: '#EF4444' }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmReturn}
            activeOpacity={0.85}
          >
            <RotateCcw color="#fff" size={18} />
            <Text style={styles.confirmBtnText}>Konfirmasi Pengembalian</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return null
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  centerFull: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },

  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },

  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#1A1F2E', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  pageHeader: { marginBottom: 24 },
  navHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  modeGrid: { flexDirection: 'row', gap: 12 },
  modeCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  modeIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  modeLabel: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modeHint: { fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  bookCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20,
  },
  bookCoverSmall: {
    width: 48, height: 64, borderRadius: 8, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bookTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  bookAuthor: { fontSize: 12, color: '#6b7280', marginBottom: 3 },
  bookRack: { fontSize: 11, color: '#9ca3af' },

  qrSection: { alignItems: 'center', marginBottom: 20 },
  qrLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 16 },
  qrBox: {
    backgroundColor: '#fff', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  qrHint: { fontSize: 11, color: '#9ca3af', marginTop: 10, textAlign: 'center' },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 18 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 15,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cancelLink: { alignItems: 'center', paddingTop: 16 },
  cancelLinkText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },

  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  txIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  txTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  txMeta: { fontSize: 12, color: '#6b7280' },
  txFine: { fontSize: 12, color: '#ef4444', marginTop: 2 },
  txChevron: { fontSize: 22, color: '#9ca3af' },

  returnCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24, overflow: 'hidden',
  },
  returnRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  returnLabel: { fontSize: 13, color: '#6b7280' },
  returnValue: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right', maxWidth: '60%' },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 8, paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

})
