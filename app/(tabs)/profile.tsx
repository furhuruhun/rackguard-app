import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import AvatarInitials from '@/components/AvatarInitials'
import StatusBadge from '@/components/StatusBadge'
import { formatCurrency, formatMonthYear } from '@/lib/utils'
import { User, History, HelpCircle, LogOut, ChevronRight, Bell } from 'lucide-react-native'

const MENU_ITEMS = [
  { icon: User,    label: 'Edit Profil',     sub: 'Ubah nama dan info akun' },
  { icon: History, label: 'Riwayat Denda',   sub: 'Lihat histori pembayaran' },
  { icon: Bell,    label: 'Notifikasi',      sub: 'Atur preferensi notifikasi' },
  { icon: HelpCircle, label: 'Bantuan',      sub: 'FAQ dan kontak support' },
]

export default function ProfileScreen() {
  const { member, reset } = useAuthStore()

  const handleLogout = () => {
    Alert.alert(
      'Keluar',
      'Apakah Anda yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Keluar',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth)
            reset()
          },
        },
      ]
    )
  }

  const statusColor = {
    active: '#10B981',
    warned: '#F59E0B',
    suspended: '#EF4444',
  }[member?.status ?? 'active']

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <AvatarInitials name={member?.name ?? 'U'} size={72} />
          <Text style={styles.name}>{member?.name ?? 'Pengguna'}</Text>
          <Text style={styles.email}>{member?.email ?? '-'}</Text>
          <View style={styles.statusRow}>
            <StatusBadge status={member?.status ?? 'active'} />
          </View>
          {member?.id && (
            <Text style={styles.memberId}>ID: {member.id}</Text>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{member?.totalBorrowed ?? 0}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Dipinjam</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{member?.currentBorrowed ?? 0}</Text>
            <Text style={styles.statLabel}>Aktif{'\n'}Sekarang</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Anggota{'\n'}Sejak</Text>
            <Text style={[styles.statValue, { fontSize: 13 }]}>
              {member?.memberSince ? formatMonthYear(member.memberSince) : '-'}
            </Text>
          </View>
        </View>

        {/* Fine card if any */}
        {(member?.totalFines ?? 0) > 0 && (
          <View style={styles.fineCard}>
            <View>
              <Text style={styles.fineLabel}>Total Denda</Text>
              <Text style={styles.fineValue}>{formatCurrency(member?.totalFines ?? 0)}</Text>
            </View>
            <TouchableOpacity style={styles.payBtn}>
              <Text style={styles.payBtnText}>Lihat Detail</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map(({ icon: Icon, label, sub }) => (
            <TouchableOpacity key={label} style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Icon color="#374151" size={20} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{label}</Text>
                <Text style={styles.menuSub}>{sub}</Text>
              </View>
              <ChevronRight color="#d1d5db" size={18} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut color="#EF4444" size={20} />
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  profileCard: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 14 },
  email: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  statusRow: { marginTop: 10 },
  memberId: { fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 6 },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 20,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#f3f4f6' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 16 },
  fineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  fineLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 3 },
  fineValue: { fontSize: 20, fontWeight: '800', color: '#ef4444' },
  payBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  menuSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  menuIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})
