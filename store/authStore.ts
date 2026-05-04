import { create } from 'zustand'
import { User as FirebaseUser } from 'firebase/auth'
import { Member } from '@/types'

interface AuthStore {
  firebaseUser: FirebaseUser | null
  member: Member | null
  memberId: string | null
  initialized: boolean
  setFirebaseUser: (user: FirebaseUser | null) => void
  setMember: (member: Member | null, id: string | null) => void
  setInitialized: (v: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  firebaseUser: null,
  member: null,
  memberId: null,
  initialized: false,
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setMember: (member, id) => set({ member, memberId: id }),
  setInitialized: (v) => set({ initialized: v }),
  reset: () => set({ firebaseUser: null, member: null, memberId: null }),
}))
