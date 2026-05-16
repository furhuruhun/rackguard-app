import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, database } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Member } from '@/types'
import { ActivityIndicator, View } from 'react-native'
import { useFonts } from 'expo-font'
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite'

function AuthGuard({ children, fontsLoaded }: { children: React.ReactNode; fontsLoaded: boolean | null }) {
  const router = useRouter()
  const segments = useSegments()
  const { firebaseUser, initialized, setFirebaseUser, setMember, setInitialized } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      if (user) {
        // Find matching member in database by email
        try {
          const snap = await get(ref(database, 'users'))
          if (snap.exists()) {
            const data = snap.val() as Record<string, Omit<Member, 'id'>>
            const entry = Object.entries(data).find(
              ([, m]) => m.email === user.email
            )
            if (entry) {
              const [id, memberData] = entry
              setMember({ id, ...memberData }, id)
            } else {
              // No matching member — create a minimal profile from Auth
              setMember(
                {
                  id: user.uid,
                  name: user.displayName ?? user.email?.split('@')[0] ?? 'Pengguna',
                  email: user.email ?? '',
                  status: 'active',
                  memberSince: new Date().toISOString().split('T')[0],
                  totalBorrowed: 0,
                  currentBorrowed: 0,
                  totalFines: 0,
                },
                user.uid
              )
            }
          }
        } catch {
          // Ignore DB error — user still authenticated
        }
      } else {
        setMember(null, null)
      }

      setInitialized(true)
    })
    return () => unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialized) return
    const seg0 = segments[0] as string
    const onAuthPage = seg0 === 'login' || seg0 === 'register'

    if (!firebaseUser && !onAuthPage) {
      router.replace('/login')
    } else if (firebaseUser && onAuthPage) {
      router.replace('/(tabs)')
    }
  }, [firebaseUser, initialized, segments]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialized || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1F2E' }}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold, SpecialElite_400Regular })

  return (
    <AuthGuard fontsLoaded={fontsLoaded}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="duration" />
        <Stack.Screen name="receipt" />
        <Stack.Screen
          name="book/[id]"
          options={{
            headerShown: true,
            title: 'Detail Buku',
            headerBackTitle: 'Kembali',
            presentation: 'card',
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#1A1F2E',
            headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          }}
        />
      </Stack>
    </AuthGuard>
  )
}
