import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { ref as dbRef, get } from 'firebase/database'
import { database } from '@/lib/firebase'
import type { Book } from '@/types'
import { ArrowLeft, BookOpen, Calendar } from 'lucide-react-native'

const ITEM_H = 48
const VISIBLE_ITEMS = 5
const HALF_ITEMS = 2
const PRESETS = [7, 14, 21]
const DEFAULT_DAYS = 7

export default function DurationScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>()
  const [book, setBook] = useState<Book | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [selectedDays, setSelectedDays] = useState(DEFAULT_DAYS)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!bookId) return
    get(dbRef(database, `books/${bookId}`))
      .then((snap) => {
        if (snap.exists()) setBook({ id: bookId, ...snap.val() } as Book)
        setLoadingBook(false)
      })
      .catch(() => setLoadingBook(false))
  }, [bookId])

  const items = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), [])

  const snapToDay = (day: number, animated = true) => {
    scrollRef.current?.scrollTo({ y: (day - 1) * ITEM_H, animated })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTimeout(() => snapToDay(DEFAULT_DAYS, false), 60)
  }, [])

  const handleChip = (days: number) => {
    setSelectedDays(days)
    snapToDay(days)
  }

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const idx = Math.max(
      0,
      Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1),
    )
    setSelectedDays(items[idx])
  }

  const dueDate = new Date(Date.now() + selectedDays * 86400000)
  const dueDateFormatted = dueDate.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const dueDateISO = dueDate.toISOString().split('T')[0]
  const activePreset = PRESETS.includes(selectedDays) ? selectedDays : null

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#374151" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pilih Durasi Peminjaman</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Book Card */}
        <View style={styles.bookCard}>
          <View style={styles.bookCover}>
            {loadingBook
              ? <View style={styles.skeletonIcon} />
              : <BookOpen color="#6366f1" size={24} />}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {loadingBook ? (
              <>
                <View style={[styles.skeleton, { width: '80%', height: 14 }]} />
                <View style={[styles.skeleton, { width: '50%', height: 11 }]} />
                <View style={[styles.skeleton, { width: '38%', height: 11 }]} />
              </>
            ) : (
              <>
                <Text style={styles.bookTitle} numberOfLines={2}>{book?.title ?? '-'}</Text>
                <Text style={styles.bookAuthor}>{book?.author ?? '-'}</Text>
                <Text style={styles.bookRack}>Rak {book?.rackLocation ?? '-'}</Text>
              </>
            )}
          </View>
        </View>

        {/* Preset Chips */}
        <Text style={styles.sectionLabel}>Durasi Peminjaman</Text>
        <View style={styles.chipRow}>
          {PRESETS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, activePreset === d && styles.chipActive]}
              onPress={() => handleChip(d)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, activePreset === d && styles.chipTextActive]}>
                {d} Hari
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scroll Picker */}
        <View style={styles.pickerRow}>
          <View style={styles.pickerWrap}>
            <View style={styles.pickerSelector} pointerEvents="none" />
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              contentContainerStyle={{ paddingVertical: ITEM_H * HALF_ITEMS }}
            >
              {items.map((d) => (
                <View key={d} style={styles.pickerItem}>
                  <Text style={[styles.pickerItemText, d === selectedDays && styles.pickerItemActive]}>
                    {d}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <Text style={styles.pickerUnit}>hari</Text>
        </View>

        {/* Due Date */}
        <View style={styles.dueDateCard}>
          <Calendar color="#3B82F6" size={16} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dueDateLabel}>Jatuh Tempo</Text>
            <Text style={styles.dueDateValue}>{dueDateFormatted}</Text>
          </View>
        </View>

        <Text style={styles.fineHint}>Denda Rp 1.000/hari jika terlambat dikembalikan</Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaBtn, loadingBook && styles.ctaBtnDisabled]}
          disabled={loadingBook}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/payment',
              params: { bookId, selectedDays: String(selectedDays), dueDate: dueDateISO },
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>Lanjut ke Pembayaran</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  content: { padding: 20, paddingBottom: 40 },

  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 28,
  },
  bookCover: {
    width: 48,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  skeleton: {
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  bookTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bookAuthor: { fontSize: 12, color: '#6b7280' },
  bookRack: { fontSize: 11, color: '#9ca3af' },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },

  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  pickerWrap: {
    height: ITEM_H * VISIBLE_ITEMS,
    width: 72,
    overflow: 'hidden',
  },
  pickerSelector: {
    position: 'absolute',
    top: ITEM_H * HALF_ITEMS,
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#BFDBFE',
  },
  pickerItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: 16, color: '#D1D5DB', fontWeight: '400' },
  pickerItemActive: { fontSize: 24, color: '#1D4ED8', fontWeight: '800' },
  pickerUnit: { fontSize: 20, fontWeight: '600', color: '#374151' },

  dueDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  dueDateLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  dueDateValue: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },

  fineHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },

  ctaBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    paddingBottom: 32,
  },
  ctaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
