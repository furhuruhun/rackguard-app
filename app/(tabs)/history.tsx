import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ref, onValue } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Transaction } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, Clock, X, Info } from 'lucide-react-native'

export default function HistoryScreen() {
  const { memberId } = useAuthStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Transaction | null>(null)

  useEffect(() => {
    if (!memberId) { setLoading(false); return }
    const unsubscribe = onValue(
      ref(database, 'transactions'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.val() as Record<string, Omit<Transaction, 'id'>>
          const all = Object.entries(d)
            .map(([id, v]) => ({ id, ...v }))
            .filter((t) => t.memberId === memberId)
            .sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime())
          setTransactions(all)
        } else {
          setTransactions([])
        }
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsubscribe()
  }, [memberId])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color="#3B82F6" size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat Peminjaman</Text>
        <Text style={styles.subtitle}>{transactions.length} transaksi</Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Clock color="#d1d5db" size={48} />
          <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
          <Text style={styles.emptyText}>Mulai pinjam buku dari Katalog</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item: tx }) => (
            <TouchableOpacity
              style={styles.txItem}
              onPress={() => setSelected(tx)}
              activeOpacity={0.75}
            >
              <View style={[styles.typeIcon, tx.type === 'borrow' ? styles.typeIconBorrow : styles.typeIconReturn]}>
                {tx.type === 'borrow'
                  ? <ArrowUpRight color="#3B82F6" size={18} />
                  : <ArrowDownLeft color="#10B981" size={18} />
                }
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle} numberOfLines={1}>{tx.bookTitle}</Text>
                <Text style={styles.txId}>{tx.id}</Text>
                <Text style={styles.txDate}>{formatDate(tx.borrowDate)}</Text>
              </View>
              <View style={styles.txRight}>
                <StatusBadge status={tx.status} />
                {tx.fine > 0 && (
                  <Text style={styles.fineText}>{formatCurrency(tx.fine)}</Text>
                )}
              </View>
              <Info color="#d1d5db" size={16} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detail Transaksi</Text>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <X color="#374151" size={22} />
            </TouchableOpacity>
          </View>
          {selected && (
            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 0 }}>
              {[
                { label: 'ID Transaksi', value: selected.id, mono: true },
                { label: 'Jenis', value: selected.type === 'borrow' ? 'Pinjam' : 'Kembali' },
                { label: 'Buku', value: selected.bookTitle, bold: true },
                { label: 'Peminjam', value: selected.memberName },
                { label: 'Tanggal Pinjam', value: formatDate(selected.borrowDate) },
                { label: 'Jatuh Tempo', value: formatDate(selected.dueDate) },
                {
                  label: 'Tanggal Kembali',
                  value: selected.returnDate ? formatDate(selected.returnDate) : '-',
                },
                {
                  label: 'Denda',
                  value: selected.fine > 0 ? formatCurrency(selected.fine) : '-',
                  red: selected.fine > 0,
                },
              ].map(({ label, value, mono, bold, red }) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={[
                    styles.detailValue,
                    mono && styles.detailMono,
                    bold && { fontWeight: '700' },
                    red && { color: '#ef4444', fontWeight: '700' },
                  ]} numberOfLines={2}>
                    {value}
                  </Text>
                </View>
              ))}
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Status</Text>
                <StatusBadge status={selected.status} />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  typeIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBorrow: { backgroundColor: '#eff6ff' },
  typeIconReturn: { backgroundColor: '#ecfdf5' },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  txId: { fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' },
  txDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  fineText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  modalBody: { flex: 1 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    gap: 12,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', flex: 0 },
  detailValue: { fontSize: 14, color: '#111827', textAlign: 'right', flex: 1 },
  detailMono: { fontFamily: 'monospace', fontSize: 13 },
})
