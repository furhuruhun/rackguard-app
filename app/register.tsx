import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { useRouter } from 'expo-router'
import { auth, database } from '@/lib/firebase'
import { getInitials, translateFirebaseError } from '@/lib/utils'
import { BookOpen, Eye, EyeOff } from 'lucide-react-native'

export default function RegisterScreen() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError('')

    if (!nickname.trim()) { setError('Nama panggilan wajib diisi.'); return }
    if (nickname.trim().length < 2) { setError('Nama panggilan minimal 2 karakter.'); return }
    if (!email.trim()) { setError('Email wajib diisi.'); return }
    if (!email.trim().endsWith('@std.stei.itb.ac.id')) {
      setError('Gunakan email institusi dengan domain @std.stei.itb.ac.id.')
      return
    }
    if (!password) { setError('Password wajib diisi.'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return }
    if (password !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const uid = userCredential.user.uid
      const today = new Date().toISOString().split('T')[0]

      await set(ref(database, `users/${uid}`), {
        name: nickname.trim(),
        email: email.trim(),
        avatar: getInitials(nickname.trim()),
        currentBorrowed: 0,
        memberSince: today,
        status: 'active',
        totalBorrowed: 0,
        totalFines: 0,
      })

      Alert.alert(
        'Pendaftaran Berhasil',
        `Selamat datang, ${nickname.trim()}! Akun Anda telah dibuat.`,
        [{ text: 'OK' }]
      )
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(translateFirebaseError(code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <BookOpen color="#fff" size={28} />
          </View>
          <Text style={styles.brand}>RackGuard</Text>
          <Text style={styles.brandSub}>PEMINJAM APP</Text>
          <Text style={styles.tagline}>Buat akun baru untuk mulai meminjam.</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.title}>Daftar</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Nama Panggilan</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="contoh: Farhan"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            autoComplete="name"
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Email Institusi</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nama@std.stei.itb.ac.id"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 karakter"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPw}
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((v) => !v)}>
              {showPw
                ? <EyeOff color="#9ca3af" size={18} />
                : <Eye color="#9ca3af" size={18} />
              }
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Konfirmasi Password</Text>
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Ulangi password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showConfirmPw}
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPw((v) => !v)}>
              {showConfirmPw
                ? <EyeOff color="#9ca3af" size={18} />
                : <Eye color="#9ca3af" size={18} />
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>Daftar</Text>
            }
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
              <Text style={styles.loginLink}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} RackGuard</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1A1F2E',
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brand: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tagline: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 10,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
    marginBottom: 4,
  },
  pwWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    paddingRight: 4,
    marginBottom: 4,
  },
  eyeBtn: {
    padding: 10,
  },
  registerBtn: {
    backgroundColor: '#1A1F2E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  registerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1F2E',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 24,
  },
})
