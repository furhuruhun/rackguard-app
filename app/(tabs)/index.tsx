import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ref, onValue } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Book, Transaction, Notification } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import AvatarInitials from '@/components/AvatarInitials'
import { daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { Search, Bell, BookOpen } from 'lucide-react-native'

const CATEGORIES = ['Semua', 'Software', 'Algoritma', 'Database', 'Jaringan', 'Lainnya']

export default function HomeScreen() {
  const { member, memberId } = useAuthStore()
  const [books, setBooks] = useState<Book[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('Semua')

  useEffect(() => {
    const unsubs: Array<() => void> = []

    unsubs.push(
      onValue(ref(database, 'books'), (snap) => {
        if (snap.exists()) {
          const d = snap.val() as Record<string, Omit<Book, 'id'>>
          setBooks(Object.entries(d).map(([id, v]) => ({ id, ...v })))
        } else {
          setBooks([])
        }
        setLoading(false)
      }, () => setLoading(false))
    )

    if (memberId) {
      unsubs.push(
        onValue(ref(database, 'transactions'), (snap) => {
          if (snap.exists()) {
            const d = snap.val() as Record<string, Omit<Transaction, 'id'>>
            const all = Object.entries(d).map(([id, v]) => ({ id, ...v }))
            setTransactions(all.filter((t) => t.memberId === memberId))
          }
        })
      )
      unsubs.push(
        onValue(ref(database, `notifications/${memberId}`), (snap) => {
          if (snap.exists()) {
            const d = snap.val() as Record<string, Omit<Notification, 'id' | 'userId'>>
            setNotifications(
              Object.entries(d).map(([id, v]) => ({ id, userId: memberId, ...v }))
            )
          }
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [memberId])

  const activeTransactions = transactions.filter((t) => t.status === 'active')
  const overdueTransactions = transactions.filter((t) => t.status === 'overdue')
  const unreadCount = notifications.filter((n) => !n.read).length

  const nearestDue = activeTransactions.reduce<number | null>((min, t) => {
    const days = daysUntil(t.dueDate)
    return min === null ? days : Math.min(min, days)
  }, null)

  const totalFine = (member?.totalFines ?? 0) +
    overdueTransactions.reduce((s, t) => s + (t.fine ?? 0), 0)

  const activeBooksInTransactions = activeTransactions
    .map((t) => books.find((b) => b.id === t.bookId))
    .filter(Boolean) as Book[]

  const filteredBooks = books.filter((b) => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    const matchCat = selectedCat === 'Semua' || b.category === selectedCat
    return matchSearch && matchCat
  }).slice(0, 6)

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Selamat Datang,</Text>
            <Text style={styles.name}>{member?.name ?? 'Pengguna'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => {}}>
            <Bell color="#374151" size={22} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <AvatarInitials name={member?.name ?? 'U'} size={40} />
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/catalog')}
          activeOpacity={0.8}
        >
          <Search color="#9ca3af" size={18} />
          <Text style={styles.searchPlaceholder}>Cari buku apa nih?</Text>
        </TouchableOpacity>

        {/* Active borrow card */}
        <View style={styles.borrowCard}>
          <View style={styles.borrowCardRow}>
            <View style={styles.borrowStat}>
              <Text style={styles.borrowStatValue}>
                {activeTransactions.length + overdueTransactions.length}
              </Text>
              <Text style={styles.borrowStatLabel}>Buku{'\n'}Dipinjam</Text>
            </View>
            <View style={styles.borrowDivider} />
            <View style={styles.borrowStat}>
              <Text style={styles.borrowStatValue}>
                {nearestDue !== null ? `${nearestDue}` : '-'}
              </Text>
              <Text style={styles.borrowStatLabel}>
                {nearestDue !== null ? 'Hari\nTersisa' : 'Tidak\nAda'}
              </Text>
            </View>
            <View style={styles.borrowDivider} />
            <View style={styles.borrowStat}>
              <Text style={[styles.borrowStatValue, totalFine > 0 && { color: '#fbbf24' }]}>
                {totalFine > 0 ? formatCurrency(totalFine) : 'Rp 0'}
              </Text>
              <Text style={styles.borrowStatLabel}>Total{'\n'}Denda</Text>
            </View>
          </View>
          {member?.status === 'warned' && (
            <View style={styles.warnStrip}>
              <Text style={styles.warnText}>⚠ Akun dalam status peringatan</Text>
            </View>
          )}
          {member?.status === 'suspended' && (
            <View style={[styles.warnStrip, { backgroundColor: '#fca5a5' }]}>
              <Text style={[styles.warnText, { color: '#7f1d1d' }]}>
                🚫 Akun ditangguhkan — hubungi Admin
              </Text>
            </View>
          )}
        </View>

        {/* Sedang Dibaca */}
        {activeBooksInTransactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sedang Dibaca</Text>
            {activeBooksInTransactions.map((book) => {
              const tx = activeTransactions.find((t) => t.bookId === book.id)!
              const days = daysUntil(tx.dueDate)
              return (
                <TouchableOpacity
                  key={book.id}
                  style={styles.readingItem}
                  onPress={() => router.push(`/book/${book.id}`)}
                >
                  <View style={styles.bookIcon}>
                    <BookOpen color="#3B82F6" size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readingTitle} numberOfLines={1}>{book.title}</Text>
                    <Text style={styles.readingAuthor}>{book.author}</Text>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.max(0, Math.min(100, 100 - (days / 14) * 100))}%`,
                            backgroundColor: days < 0 ? '#ef4444' : days <= 3 ? '#f59e0b' : '#3b82f6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={[styles.daysLeft, { color: days < 0 ? '#ef4444' : days <= 3 ? '#f59e0b' : '#6b7280' }]}>
                    {days < 0 ? `${Math.abs(days)}h lewat` : `${days}h lagi`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Kategori */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
                  onPress={() => setSelectedCat(cat)}
                >
                  <Text style={[styles.catText, selectedCat === cat && styles.catTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Book list */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Koleksi Buku</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/catalog')}>
              <Text style={styles.seeAll}>Lihat semua</Text>
            </TouchableOpacity>
          </View>
          {filteredBooks.length === 0 ? (
            <Text style={styles.empty}>Tidak ada buku ditemukan</Text>
          ) : (
            filteredBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookItem}
                onPress={() => router.push(`/book/${book.id}`)}
              >
                <View style={styles.bookCover}>
                  <BookOpen color="#6366f1" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={styles.bookAuthor}>{book.author}</Text>
                  <Text style={styles.bookRack}>{book.rackLocation}</Text>
                </View>
                <StatusBadge status={book.status} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  greeting: { fontSize: 13, color: '#9ca3af' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  notifBtn: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 0, right: 0,
    backgroundColor: '#ef4444',
    width: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchPlaceholder: { color: '#9ca3af', fontSize: 14 },
  borrowCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#1A1F2E',
    marginBottom: 20,
    overflow: 'hidden',
  },
  borrowCardRow: {
    flexDirection: 'row',
    padding: 20,
    gap: 0,
  },
  borrowStat: { flex: 1, alignItems: 'center' },
  borrowStatValue: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  borrowStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 16 },
  borrowDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
  warnStrip: {
    backgroundColor: '#fde68a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  warnText: { fontSize: 12, fontWeight: '600', color: '#78350f' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 13, color: '#3B82F6', fontWeight: '600' },
  readingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  readingAuthor: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  progressBarTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 },
  progressBarFill: { height: 4, borderRadius: 2 },
  daysLeft: { fontSize: 11, fontWeight: '600' },
  catRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  catChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  catText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '600' },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookCover: {
    width: 44, height: 44,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  bookAuthor: { fontSize: 12, color: '#6b7280' },
  bookRack: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  empty: { color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
})
