import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ref, onValue } from 'firebase/database'
import { database } from '@/lib/firebase'
import { Book } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { BookItemSkeleton } from '@/components/SkeletonItem'
import { Search, SlidersHorizontal, BookOpen, X } from 'lucide-react-native'

const STATUSES = ['Semua', 'Tersedia', 'Dipinjam']
const STATUS_MAP: Record<string, Book['status'] | null> = {
  Semua: null,
  Tersedia: 'available',
  Dipinjam: 'borrowed',
}

export default function CatalogScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = onValue(
      ref(database, 'books'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.val() as Record<string, Omit<Book, 'id'>>
          setBooks(Object.entries(d).map(([id, v]) => ({ id, ...v })))
        } else {
          setBooks([])
        }
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsubscribe()
  }, [])

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQuery(text), 300)
  }, [])

  const filtered = books.filter((b) => {
    const q = debouncedQuery.toLowerCase()
    const matchQuery =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn?.toLowerCase().includes(q)
    const statusVal = STATUS_MAP[statusFilter]
    const matchStatus = !statusVal || b.status === statusVal
    return matchQuery && matchStatus
  })

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Katalog Buku</Text>
        <Text style={styles.subtitle}>{books.length} buku tersedia</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search color="#9ca3af" size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari judul atau penulis..."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setDebouncedQuery('') }}>
            <X color="#9ca3af" size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.resultCount}>{filtered.length} hasil</Text>
      </View>

      {/* Book list */}
      {loading ? (
        <View>
          {[1, 2, 3, 4, 5].map((i) => <BookItemSkeleton key={i} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <BookOpen color="#d1d5db" size={48} />
          <Text style={styles.emptyTitle}>Tidak ada buku</Text>
          <Text style={styles.emptyText}>
            {debouncedQuery ? 'Coba kata kunci lain' : 'Belum ada buku di katalog'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={({ item: book }) => (
            <TouchableOpacity
              style={styles.bookItem}
              onPress={() => router.push(`/book/${book.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.bookCover}>
                <BookOpen color="#6366f1" size={22} />
              </View>
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                <Text style={styles.bookAuthor}>{book.author}</Text>
                <View style={styles.bookMeta}>
                  <Text style={styles.bookRack}>{book.rackLocation}</Text>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.bookCat}>{book.category}</Text>
                </View>
              </View>
              <StatusBadge status={book.status} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  chipText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  resultCount: { marginLeft: 'auto', fontSize: 12, color: '#9ca3af' },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bookCover: {
    width: 52, height: 66,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  bookAuthor: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookRack: { fontSize: 11, color: '#9ca3af' },
  dot: { color: '#d1d5db', fontSize: 10 },
  bookCat: { fontSize: 11, color: '#9ca3af' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
})
