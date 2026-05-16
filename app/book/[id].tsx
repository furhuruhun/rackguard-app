import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { ref, get } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Book } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { BookOpen, MapPin, Tag, Hash, CreditCard } from 'lucide-react-native'

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { member } = useAuthStore()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    get(ref(database, `books/${id}`)).then((snap) => {
      if (snap.exists()) {
        setBook({ id: id as string, ...snap.val() } as Book)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const canBorrow =
    book?.status === 'available' &&
    member?.status !== 'suspended' &&
    (member?.totalFines ?? 0) <= 20000

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    )
  }

  if (!book) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Buku tidak ditemukan</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover area */}
        <View style={styles.coverArea}>
          <View style={styles.coverPlaceholder}>
            <BookOpen color="#6366f1" size={52} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.bookAuthor}>{book.author}</Text>
          <View style={styles.statusRow}>
            <StatusBadge status={book.status} />
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          {[
            { icon: Tag,    label: 'Kategori',     value: book.category },
            { icon: Hash,   label: 'ISBN',          value: book.isbn || '-' },
            { icon: MapPin, label: 'Lokasi Rak',    value: book.rackLocation },
            { icon: Tag,    label: 'Tag RFID',      value: book.rfidTag },
          ].map(({ icon: Icon, label, value }) => (
            <View key={label} style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Icon color="#9ca3af" size={16} />
              </View>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        {book.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descTitle}>Deskripsi</Text>
            <Text style={styles.descText}>{book.description}</Text>
          </View>
        ) : null}

        {/* Status notice if borrowed */}
        {book.status === 'borrowed' && (
          <View style={styles.noticeBorrowed}>
            <Text style={styles.noticeText}>
              Buku ini sedang dipinjam. Cek kembali nanti atau pilih buku lain dari katalog.
            </Text>
          </View>
        )}
        {book.status === 'overdue' && (
          <View style={[styles.noticeBorrowed, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
            <Text style={[styles.noticeText, { color: '#991b1b' }]}>
              Buku ini sedang terlambat dikembalikan.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom CTA */}
      {book.status === 'available' && (
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.borrowBtn, !canBorrow && styles.borrowBtnDisabled]}
            disabled={!canBorrow}
            onPress={() =>
              router.push({ pathname: '/duration', params: { bookId: book.id } })
            }
            activeOpacity={0.85}
          >
            <CreditCard color="#fff" size={20} />
            <Text style={styles.borrowBtnText}>
              {canBorrow ? 'Pinjam Sekarang' : 'Tidak Dapat Meminjam'}
            </Text>
          </TouchableOpacity>
          {!canBorrow && member?.status === 'suspended' && (
            <Text style={styles.ctaHint}>Akun Anda ditangguhkan.</Text>
          )}
          {!canBorrow && (member?.totalFines ?? 0) > 20000 && (
            <Text style={styles.ctaHint}>Selesaikan denda terlebih dahulu.</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#6b7280', fontSize: 15 },
  coverArea: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  coverPlaceholder: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bookTitle: { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 30 },
  bookAuthor: { fontSize: 15, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  statusRow: { flexDirection: 'row' },
  detailsCard: {
    backgroundColor: '#fff',
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  detailIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  detailLabel: { flex: 1, fontSize: 14, color: '#6b7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right', maxWidth: '55%' },
  descSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  descTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  descText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  noticeBorrowed: {
    margin: 16,
    padding: 14,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noticeText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    paddingBottom: 32,
    gap: 6,
  },
  borrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  borrowBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  borrowBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaHint: { textAlign: 'center', fontSize: 12, color: '#9ca3af' },
})
