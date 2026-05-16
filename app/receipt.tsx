import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Dimensions, useColorScheme,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { ref as dbRef, get } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Book, Transaction } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Svg, Line, Circle } from 'react-native-svg'

// Receipt-only color tokens — not part of global design system
const C = {
  paper:  '#F5F0E8',
  dark:   '#1A1A2E',
  gold:   '#C8A96E',
  brown:  '#8B7355',
  border: '#C8B89A',
}

const FINE_PER_DAY = 1000
const LIBRARY_NAME = 'Perpustakaan RackGuard'
const SCREEN_WIDTH = Dimensions.get('window').width

// ── Corner ornament ───────────────────────────────────────────────────────────
function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position === 'tl' || position === 'tr'
  const isLeft = position === 'tl' || position === 'bl'
  return (
    <View style={[
      ornStyles.corner,
      isTop ? { top: 10 } : { bottom: 10 },
      isLeft ? { left: 10 } : { right: 10 },
      !isTop && !isLeft && ornStyles.cornerBR,
      !isTop && isLeft && ornStyles.cornerBL,
      isTop && !isLeft && ornStyles.cornerTR,
    ]} />
  )
}

const ornStyles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: C.gold,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: { borderTopWidth: 2, borderLeftWidth: 0, borderRightWidth: 2 },
  cornerBL: { borderTopWidth: 0, borderLeftWidth: 2, borderBottomWidth: 2 },
  cornerBR: { borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 2, borderBottomWidth: 2 },
})

// ── Perforated divider ────────────────────────────────────────────────────────
function PerforatedDivider() {
  const scheme = useColorScheme()
  // Match SafeAreaView background colour of the page
  const pageBg = scheme === 'dark' ? '#000000' : '#ffffff'
  const r = 14
  const h = r * 2

  return (
    <Svg width={SCREEN_WIDTH} height={h}>
      <Line
        x1={r + 8} y1={r} x2={SCREEN_WIDTH - r - 8} y2={r}
        stroke={C.gold} strokeWidth={1} strokeDasharray="6,5"
      />
      <Circle cx={0} cy={r} r={r} fill={pageBg} />
      <Circle cx={SCREEN_WIDTH} cy={r} r={r} fill={pageBg} />
    </Svg>
  )
}

// ── Stamp ─────────────────────────────────────────────────────────────────────
function Stamp({ text }: { text: string }) {
  return (
    <View style={stampStyles.wrap}>
      <View style={stampStyles.inner}>
        <Text style={stampStyles.text}>{text}</Text>
      </View>
    </View>
  )
}

const stampStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 16,
    right: 16,
    transform: [{ rotate: '-12deg' }],
  },
  inner: {
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 11,
    color: C.gold,
    letterSpacing: 2,
  },
})

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, value, fullWidth = false }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <View style={[fieldStyles.wrap, fullWidth && fieldStyles.fullWidth]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={fieldStyles.value} numberOfLines={2}>{value}</Text>
    </View>
  )
}

const fieldStyles = StyleSheet.create({
  wrap: { width: '50%', paddingHorizontal: 12, paddingVertical: 8 },
  fullWidth: { width: '100%' },
  label: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 9,
    color: C.brown,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  value: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 13,
    color: C.dark,
    lineHeight: 18,
  },
})

// ── Diamond ornament ──────────────────────────────────────────────────────────
function Diamond() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ color: C.gold, fontSize: 12 }}>◆ · · · ◆ · · · ◆</Text>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReceiptScreen() {
  const { transactionId, type } = useLocalSearchParams<{ transactionId: string; type: 'borrow' | 'return' }>()
  const { member } = useAuthStore()
  const receiptRef = useRef<ViewShot>(null)

  const [tx, setTx] = useState<Transaction | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!transactionId) return
    let bookId = ''
    get(dbRef(database, `transactions/${transactionId}`))
      .then((snap) => {
        if (!snap.exists()) return
        const data = { id: transactionId, ...snap.val() } as Transaction
        bookId = data.bookId
        setTx(data)
        return get(dbRef(database, `books/${data.bookId}`))
      })
      .then((bookSnap) => {
        if (bookSnap?.exists()) {
          setBook({ id: bookId, ...bookSnap.val() } as Book)
        }
      })
      .catch(() => {})
  }, [transactionId])

  if (!tx || !book) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    )
  }

  const stampText = type === 'borrow' ? 'DIPINJAM' : 'DIKEMBALIKAN'
  const userName = member?.name ?? 'Peminjam'

  const handleShare = async () => {
    if (!receiptRef.current) return
    setSharing(true)
    try {
      const uri = await captureRef(receiptRef, { format: 'png', quality: 1 })
      await Sharing.shareAsync(uri)
    } catch {
      // User cancelled or share failed — silently ignore
    } finally {
      setSharing(false)
    }
  }

  const handleDone = () => {
    router.replace('/(tabs)')
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ViewShot captures zones 1–4 */}
        <ViewShot ref={receiptRef} options={{ format: 'png', quality: 1 }}>

          {/* Zone 1 — Header */}
          <View style={styles.header}>
            <Corner position="tl" />
            <Corner position="tr" />
            <Corner position="bl" />
            <Corner position="br" />
            <Text style={styles.eyebrow}>{LIBRARY_NAME.toUpperCase()}</Text>
            <Text style={styles.headerTitle}>Tanda Terima Peminjaman</Text>
            <Text style={styles.headerSub}>— Receipt of Loan —</Text>
          </View>

          {/* Zone 2 — Body */}
          <View style={styles.body}>
            <Diamond />
            <Stamp text={stampText} />

            {/* Full-width: borrower name */}
            <View style={styles.fieldGrid}>
              <FieldRow label="Nama Peminjam" value={userName} fullWidth />

              <FieldRow label="Judul Buku" value={tx.bookTitle} />
              <FieldRow label="No. Rak" value={book.rackLocation} />

              <FieldRow
                label="Tanggal Pinjam"
                value={tx.borrowDate ? formatDate(tx.borrowDate) : '—'}
              />
              <FieldRow
                label="Kembali Sebelum"
                value={tx.dueDate ? formatDate(tx.dueDate) : '—'}
              />

              <FieldRow label="Denda / Hari" value={formatCurrency(FINE_PER_DAY)} />
              <FieldRow label="No. Transaksi" value={tx.id} />
            </View>

            <Diamond />
          </View>

          {/* Zone 3 — Perforated Divider */}
          <View style={styles.perforated}>
            <PerforatedDivider />
          </View>

          {/* Zone 4 — Stub */}
          <View style={styles.stub}>
            <View style={styles.stubLeft}>
              <Text style={styles.stubLabel}>STUB · SIMPAN</Text>
              <Text style={styles.stubValue}>{tx.id}</Text>
            </View>
            <View style={styles.stubRight}>
              <Text style={styles.stubLabel}>KEMBALI SEBELUM</Text>
              <Text style={styles.stubValue}>
                {tx.dueDate ? formatDate(tx.dueDate) : '—'}
              </Text>
            </View>
          </View>

        </ViewShot>

        {/* Button row — outside ViewShot */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing
              ? <ActivityIndicator color={C.dark} size="small" />
              : <Text style={styles.shareBtnText}>Bagikan</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Selesai</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dark },

  // Zone 1 — Header
  header: {
    backgroundColor: C.dark,
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  eyebrow: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 9,
    color: C.gold,
    letterSpacing: 3,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 8,
  },
  headerSub: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 12,
    color: C.gold,
    letterSpacing: 1,
  },

  // Zone 2 — Body
  body: {
    backgroundColor: C.paper,
    paddingHorizontal: 4,
    paddingBottom: 4,
    position: 'relative',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // Zone 3 — Perforated
  perforated: {
    backgroundColor: C.paper,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
    overflow: 'visible',
  },

  // Zone 4 — Stub
  stub: {
    backgroundColor: C.dark,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stubLeft: { flex: 1 },
  stubRight: { flex: 1, alignItems: 'flex-end' },
  stubLabel: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 8,
    color: C.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  stubValue: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 12,
    color: '#fff',
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  shareBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.dark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 15,
    color: C.dark,
    letterSpacing: 1,
  },
  doneBtn: {
    flex: 1,
    backgroundColor: C.dark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: 'SpecialElite_400Regular',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 1,
  },
})
