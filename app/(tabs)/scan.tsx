import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { ScanLine, CheckCircle, XCircle, WifiOff } from 'lucide-react-native'

type ScanState = 'idle' | 'scanning' | 'success' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  nfc_unavailable: 'NFC tidak tersedia atau tidak aktif di perangkat ini.',
  tag_unknown: 'Tag NFC tidak dikenali. Pastikan menempel di rak yang benar.',
  access_denied: 'Akses ditolak. Selesaikan tunggakan denda terlebih dahulu.',
}

export default function ScanScreen() {
  const { member } = useAuthStore()
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [errorKey, setErrorKey] = useState<string>('')
  const [countdown, setCountdown] = useState(30)
  const [unlockedShelf, setUnlockedShelf] = useState('')
  const pulseAnim = useRef(new Animated.Value(1)).current
  const successScale = useRef(new Animated.Value(0)).current

  // Pulse animation while idle/scanning
  useEffect(() => {
    if (scanState === 'idle' || scanState === 'scanning') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    }
  }, [scanState, pulseAnim])

  // Countdown when success
  useEffect(() => {
    if (scanState !== 'success') return
    setCountdown(30)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          setScanState('idle')
          return 30
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [scanState])

  // Success animation
  useEffect(() => {
    if (scanState === 'success') {
      Animated.spring(successScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }).start()
    } else {
      successScale.setValue(0)
    }
  }, [scanState, successScale])

  const handleScan = () => {
    if (member?.status === 'suspended') {
      setErrorKey('access_denied')
      setScanState('error')
      return
    }
    if (member?.totalFines && member.totalFines > 20000) {
      setErrorKey('access_denied')
      setScanState('error')
      return
    }

    setScanState('scanning')
    // Simulate NFC scan — in a real dev-client build this would call react-native-nfc-manager
    setTimeout(() => {
      setUnlockedShelf('RACK-A-1')
      setScanState('success')
    }, 2000)
  }

  const reset = () => {
    setScanState('idle')
    setErrorKey('')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Scan & Buka Rak</Text>
          <Text style={styles.subtitle}>Tempelkan NFC untuk membuka rak buku</Text>
        </View>

        {/* Main visual area */}
        <View style={styles.mainArea}>
          {scanState === 'idle' && (
            <>
              <Animated.View style={[styles.nfcRing, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.nfcInner}>
                  <ScanLine color="#3B82F6" size={52} />
                </View>
              </Animated.View>
              <TouchableOpacity style={styles.scanBtn} onPress={handleScan} activeOpacity={0.85}>
                <ScanLine color="#fff" size={20} />
                <Text style={styles.scanBtnText}>Mulai Scan NFC</Text>
              </TouchableOpacity>
            </>
          )}

          {scanState === 'scanning' && (
            <>
              <Animated.View style={[styles.nfcRing, styles.nfcScanning, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.nfcInner, styles.nfcInnerScanning]}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              </Animated.View>
              <Text style={styles.scanningText}>Mendeteksi tag NFC…</Text>
              <Text style={styles.scanningHint}>Tempel HP ke tag pada rak</Text>
            </>
          )}

          {scanState === 'success' && (
            <>
              <Animated.View style={[styles.successRing, { transform: [{ scale: successScale }] }]}>
                <CheckCircle color="#10B981" size={72} />
              </Animated.View>
              <Text style={styles.successTitle}>🔓 Rak Terbuka!</Text>
              <Text style={styles.successMsg}>
                {unlockedShelf} berhasil dibuka. Silakan ambil atau kembalikan buku Anda.
              </Text>

              {/* Badge */}
              <View style={styles.shelfBadge}>
                <Text style={styles.shelfBadgeText}>{unlockedShelf} · Unlocked</Text>
              </View>

              {/* Countdown */}
              <View style={styles.countdownWrap}>
                <Text style={styles.countdownLabel}>Menutup otomatis dalam</Text>
                <Text style={styles.countdown}>{countdown}s</Text>
              </View>

              <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
                <Text style={styles.scanAgainText}>Scan lagi</Text>
              </TouchableOpacity>
            </>
          )}

          {scanState === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <XCircle color="#EF4444" size={64} />
              </View>
              <Text style={styles.errorTitle}>Scan Gagal</Text>
              <Text style={styles.errorMsg}>{ERROR_MESSAGES[errorKey] ?? 'Terjadi kesalahan.'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryText}>Coba Lagi</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* How to use */}
        <View style={styles.howTo}>
          <Text style={styles.howToTitle}>Cara Penggunaan</Text>
          {[
            'Pilih buku dari Katalog yang ingin dipinjam',
            'Tekan tombol "Mulai Scan NFC" di atas',
            'Tempelkan HP ke tag NFC pada rak buku',
            'Rak akan terbuka — ambil atau kembalikan buku',
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* NFC note */}
        <View style={styles.noteBox}>
          <WifiOff color="#9ca3af" size={16} />
          <Text style={styles.noteText}>
            NFC fisik memerlukan Expo Dev Client. Saat ini menggunakan simulasi untuk demo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingBottom: 32 },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  mainArea: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, minHeight: 280 },
  nfcRing: {
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  nfcScanning: { backgroundColor: '#1d4ed8' },
  nfcInner: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcInnerScanning: { backgroundColor: 'rgba(255,255,255,0.15)' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 15,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scanningText: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  scanningHint: { fontSize: 13, color: '#6b7280' },
  successRing: {
    width: 130, height: 130,
    borderRadius: 65,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successMsg: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  shelfBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
    marginBottom: 20,
  },
  shelfBadgeText: { color: '#065f46', fontWeight: '700', fontSize: 13 },
  countdownWrap: { alignItems: 'center', marginBottom: 20 },
  countdownLabel: { fontSize: 12, color: '#9ca3af' },
  countdown: { fontSize: 32, fontWeight: '800', color: '#3B82F6' },
  scanAgainBtn: { paddingVertical: 10 },
  scanAgainText: { color: '#3B82F6', fontWeight: '600', fontSize: 14 },
  errorIcon: { marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  retryBtn: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  howTo: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 14,
  },
  howToTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteText: { flex: 1, fontSize: 11, color: '#9ca3af', lineHeight: 16 },
})
