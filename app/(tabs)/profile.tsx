import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  Modal, TextInput, ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import { ref as dbRef, get, update, onValue } from 'firebase/database'
import { auth, database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import AvatarInitials from '@/components/AvatarInitials'
import StatusBadge from '@/components/StatusBadge'
import { formatCurrency, formatMonthYear, formatDate } from '@/lib/utils'
import type { Transaction, Notification } from '@/types'
import {
  User, History, HelpCircle, LogOut, ChevronRight, Bell,
  ArrowLeft, ChevronDown, ChevronUp, Mail, Phone, BookOpen,
} from 'lucide-react-native'

type ActiveModal = 'edit' | 'fines' | 'notifications' | 'help' | null

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara meminjam buku?',
    a: 'Cari buku di Katalog, tap judulnya, lalu tekan "Pinjam Sekarang". Ikuti alur konfirmasi pembayaran untuk membuka kunci rak.',
  },
  {
    q: 'Berapa lama masa peminjaman?',
    a: 'Masa peminjaman default adalah 14 hari. Anda bisa mengubah durasinya saat konfirmasi peminjaman (1–30 hari).',
  },
  {
    q: 'Bagaimana cara mengembalikan buku?',
    a: 'Buka tab Bayar/Aksi, pilih "Kembalikan Buku", pilih transaksi aktif, lalu tekan "Konfirmasi Pengembalian".',
  },
  {
    q: 'Berapa denda keterlambatan?',
    a: 'Denda Rp 1.000 per hari keterlambatan, dihitung dari tanggal jatuh tempo.',
  },
  {
    q: 'Apa yang terjadi jika akun saya suspended?',
    a: 'Akun ditangguhkan jika denda melebihi Rp 20.000. Selesaikan denda terlebih dahulu untuk dapat meminjam kembali.',
  },
]

export default function ProfileScreen() {
  const { member, memberId, setMember, reset } = useAuthStore()

  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // Edit profil
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Riwayat denda
  const [fineHistory, setFineHistory] = useState<Transaction[]>([])
  const [fineLoading, setFineLoading] = useState(false)

  // Notifikasi
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = notifications.filter((n) => !n.read).length

  // FAQ open index
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    if (activeModal === 'edit') {
      setEditName(member?.name ?? '')
    } else if (activeModal === 'fines') {
      loadFineHistory()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal])

  // Real-time notifications listener
  useEffect(() => {
    if (!memberId) return
    return onValue(dbRef(database, `notifications/${memberId}`), (snap) => {
      if (!snap.exists()) { setNotifications([]); return }
      const all = snap.val() as Record<string, Omit<Notification, 'id'>>
      setNotifications(
        Object.entries(all)
          .map(([id, v]) => ({ id, ...v } as Notification))
          .sort((a, b) => b.createdAt - a.createdAt)
      )
    })
  }, [memberId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark all as read when notifications modal opens
  useEffect(() => {
    if (activeModal !== 'notifications' || !memberId || notifications.length === 0) return
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return
    const updates: Record<string, boolean> = {}
    unread.forEach((n) => { updates[`notifications/${memberId}/${n.id}/read`] = true })
    update(dbRef(database), updates).catch(() => {})
  }, [activeModal]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadFineHistory = () => {
    if (!memberId) return
    setFineLoading(true)
    get(dbRef(database, 'transactions'))
      .then((snap) => {
        if (!snap.exists()) { setFineHistory([]); setFineLoading(false); return }
        const all = snap.val() as Record<string, Omit<Transaction, 'id'>>
        const fines = Object.entries(all)
          .map(([id, val]) => ({ id, ...val } as Transaction))
          .filter((tx) => tx.memberId === memberId && tx.fine > 0)
          .sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime())
        setFineHistory(fines)
        setFineLoading(false)
      })
      .catch(() => setFineLoading(false))
  }

  const markNotifRead = (notifId: string) => {
    if (!memberId) return
    update(dbRef(database), { [`notifications/${memberId}/${notifId}/read`]: true }).catch(() => {})
  }

  const handleSaveProfile = async () => {
    if (!memberId || !editName.trim()) return
    setEditSaving(true)
    try {
      await update(dbRef(database, `members/${memberId}`), { name: editName.trim() })
      setMember({ ...member!, name: editName.trim() }, memberId)
      setActiveModal(null)
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyimpan perubahan.')
    } finally {
      setEditSaving(false)
    }
  }

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
      ],
    )
  }

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
          {member?.id && <Text style={styles.memberId}>ID: {member.id}</Text>}
        </View>

        {/* Stats */}
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

        {/* Fine alert */}
        {(member?.totalFines ?? 0) > 0 && (
          <View style={styles.fineCard}>
            <View>
              <Text style={styles.fineLabel}>Total Denda</Text>
              <Text style={styles.fineValue}>{formatCurrency(member?.totalFines ?? 0)}</Text>
            </View>
            <TouchableOpacity style={styles.payBtn} onPress={() => setActiveModal('fines')}>
              <Text style={styles.payBtnText}>Lihat Detail</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {([
            { icon: User,       label: 'Edit Profil',   sub: 'Ubah nama dan info akun',   modal: 'edit' as ActiveModal,          badge: 0 },
            { icon: History,    label: 'Riwayat Denda', sub: 'Lihat histori pembayaran',   modal: 'fines' as ActiveModal,         badge: 0 },
            { icon: Bell,       label: 'Notifikasi',    sub: 'Lihat notifikasi masuk',     modal: 'notifications' as ActiveModal, badge: unreadCount },
            { icon: HelpCircle, label: 'Bantuan',       sub: 'FAQ dan kontak support',     modal: 'help' as ActiveModal,          badge: 0 },
          ] as const).map(({ icon: Icon, label, sub, modal, badge }) => (
            <TouchableOpacity
              key={label}
              style={styles.menuItem}
              onPress={() => setActiveModal(modal)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Icon color="#374151" size={20} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{label}</Text>
                <Text style={styles.menuSub}>{sub}</Text>
              </View>
              {badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
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

      {/* ═══════════════════════════════════════════════════════
          Edit Profil
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'edit'} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBack}>
              <ArrowLeft color="#374151" size={22} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profil</Text>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.avatarCenter}>
              <AvatarInitials name={editName || member?.name || 'U'} size={80} />
            </View>

            <Text style={styles.fieldLabel}>Nama Lengkap</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Masukkan nama lengkap"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.textInputDisabled}>
              <Text style={styles.textInputDisabledText}>{member?.email ?? '-'}</Text>
            </View>
            <Text style={styles.fieldHint}>Email tidak dapat diubah.</Text>

            <TouchableOpacity
              style={[styles.saveBtn, (!editName.trim() || editSaving) && styles.saveBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={!editName.trim() || editSaving}
              activeOpacity={0.85}
            >
              {editSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          Riwayat Denda
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'fines'} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBack}>
              <ArrowLeft color="#374151" size={22} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Riwayat Denda</Text>
            <View style={{ width: 34 }} />
          </View>

          {fineLoading ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator color="#3B82F6" size="large" />
            </View>
          ) : fineHistory.length === 0 ? (
            <View style={styles.modalCenter}>
              <History color="#d1d5db" size={52} />
              <Text style={styles.emptyTitle}>Belum Ada Riwayat Denda</Text>
              <Text style={styles.emptyText}>Selalu kembalikan buku tepat waktu!</Text>
            </View>
          ) : (
            <FlatList
              data={fineHistory}
              keyExtractor={(tx) => tx.id}
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={
                <View style={styles.fineSummary}>
                  <Text style={styles.fineSummaryLabel}>Total Denda Terkumpul</Text>
                  <Text style={styles.fineSummaryValue}>
                    {formatCurrency(fineHistory.reduce((s, tx) => s + tx.fine, 0))}
                  </Text>
                </View>
              }
              renderItem={({ item: tx }) => (
                <View style={styles.fineItem}>
                  <View style={styles.fineItemIcon}>
                    <BookOpen color="#ef4444" size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fineItemTitle} numberOfLines={2}>{tx.bookTitle}</Text>
                    <Text style={styles.fineItemMeta}>
                      Pinjam: {formatDate(tx.borrowDate)} · Jatuh tempo: {formatDate(tx.dueDate)}
                    </Text>
                    {tx.returnDate ? (
                      <Text style={styles.fineItemMeta}>Kembali: {formatDate(tx.returnDate)}</Text>
                    ) : (
                      <Text style={[styles.fineItemMeta, { color: '#f59e0b' }]}>Belum dikembalikan</Text>
                    )}
                  </View>
                  <Text style={styles.fineItemAmount}>{formatCurrency(tx.fine)}</Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          Notifikasi
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'notifications'} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBack}>
              <ArrowLeft color="#374151" size={22} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notifikasi</Text>
            <View style={{ width: 34 }} />
          </View>

          {notifications.length === 0 ? (
            <View style={styles.modalCenter}>
              <Bell color="#d1d5db" size={52} />
              <Text style={styles.emptyTitle}>Tidak Ada Notifikasi</Text>
              <Text style={styles.emptyText}>Semua notifikasi akan muncul di sini.</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item: notif }) => (
                <TouchableOpacity
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                  onPress={() => markNotifRead(notif.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.notifDot, !notif.read && styles.notifDotUnread]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifMsg}>{notif.message}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          Bantuan
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'help'} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBack}>
              <ArrowLeft color="#374151" size={22} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Bantuan</Text>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <Text style={styles.helpSectionTitle}>Pertanyaan Umum</Text>
            {FAQ_ITEMS.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.faqItem}
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  {openFaq === i
                    ? <ChevronUp color="#6b7280" size={16} />
                    : <ChevronDown color="#6b7280" size={16} />
                  }
                </View>
                {openFaq === i && <Text style={styles.faqAnswer}>{item.a}</Text>}
              </TouchableOpacity>
            ))}

            <Text style={[styles.helpSectionTitle, { marginTop: 28 }]}>Hubungi Kami</Text>
            <View style={styles.contactCard}>
              <View style={styles.contactRow}>
                <Mail color="#3B82F6" size={18} />
                <Text style={styles.contactText}>support@rackguard.id</Text>
              </View>
              <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
                <Phone color="#10B981" size={18} />
                <Text style={styles.contactText}>+62 812-3456-7890</Text>
              </View>
            </View>

            <Text style={styles.appVersion}>RackGuard v1.0.0</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  // ── Main screen ──
  profileCard: {
    alignItems: 'center',
    paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 14 },
  email: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  statusRow: { marginTop: 10 },
  memberId: { fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 6 },

  statsGrid: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 20,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#f3f4f6' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 16 },

  fineCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#fef2f2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#fecaca',
  },
  fineLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 3 },
  fineValue: { fontSize: 20, fontWeight: '800', color: '#ef4444' },
  payBtn: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  menuSection: {
    backgroundColor: '#fff', marginTop: 16,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  menuBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginRight: 6,
  },
  menuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },

  // ── Shared modal ──
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  modalBack: { padding: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  // ── Edit profil ──
  avatarCenter: { alignItems: 'center', marginBottom: 28 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', marginBottom: 16,
  },
  textInputDisabled: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  textInputDisabledText: { fontSize: 15, color: '#9ca3af' },
  fieldHint: { fontSize: 11, color: '#9ca3af', marginBottom: 28 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 15,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  saveBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Riwayat denda ──
  fineSummary: {
    backgroundColor: '#fef2f2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 16, alignItems: 'center',
  },
  fineSummaryLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  fineSummaryValue: { fontSize: 24, fontWeight: '800', color: '#ef4444' },
  fineItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
  },
  fineItemIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  fineItemTitle: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 3 },
  fineItemMeta: { fontSize: 11, color: '#9ca3af', lineHeight: 17 },
  fineItemAmount: { fontSize: 14, fontWeight: '800', color: '#ef4444', flexShrink: 0 },

  // ── Notifikasi ──
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  notifItemUnread: { backgroundColor: '#eff6ff' },
  notifDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db', marginTop: 5, flexShrink: 0,
  },
  notifDotUnread: { backgroundColor: '#3B82F6' },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  notifMsg: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9ca3af' },

  // ── Bantuan ──
  helpSectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  faqItem: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, gap: 12,
  },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  faqAnswer: {
    fontSize: 13, color: '#6b7280', lineHeight: 20,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  contactCard: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  contactText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  appVersion: { textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 32 },
})
