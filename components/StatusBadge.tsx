import { View, Text, StyleSheet } from 'react-native'

type StatusType =
  | 'available' | 'borrowed' | 'overdue'
  | 'active' | 'warned' | 'suspended' | 'completed'
  | 'borrow' | 'return'

const CONFIG: Record<StatusType, { label: string; bg: string; text: string }> = {
  available:  { label: 'Tersedia',     bg: '#d1fae5', text: '#065f46' },
  borrowed:   { label: 'Dipinjam',     bg: '#fef3c7', text: '#92400e' },
  overdue:    { label: 'Terlambat',    bg: '#fee2e2', text: '#991b1b' },
  active:     { label: 'Aktif',        bg: '#dbeafe', text: '#1e40af' },
  warned:     { label: 'Peringatan',   bg: '#fef3c7', text: '#92400e' },
  suspended:  { label: 'Ditangguhkan', bg: '#fee2e2', text: '#991b1b' },
  completed:  { label: 'Selesai',      bg: '#d1fae5', text: '#065f46' },
  borrow:     { label: 'Pinjam',       bg: '#dbeafe', text: '#1e40af' },
  return:     { label: 'Kembali',      bg: '#d1fae5', text: '#065f46' },
}

export default function StatusBadge({ status }: { status: StatusType }) {
  const cfg = CONFIG[status] ?? { label: status, bg: '#f3f4f6', text: '#374151' }
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
})
