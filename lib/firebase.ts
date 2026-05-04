import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import AsyncStorage from '@react-native-async-storage/async-storage'

// With package exports disabled in metro.config.js, Metro uses the legacy
// `react-native` field from @firebase/auth/package.json → dist/rn/index.js,
// which exports getReactNativePersistence. Not present in the web TS types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

let auth: ReturnType<typeof getAuth>
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  })
} catch {
  // initializeAuth throws if called twice (e.g. Fast Refresh).
  // getAuth works here because auth was already registered on the first call.
  auth = getAuth(app)
}

const database = getDatabase(app)

export { auth, database }
export default app
