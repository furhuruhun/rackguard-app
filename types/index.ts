export interface Member {
  id: string
  name: string
  email: string
  avatar?: string
  status: 'active' | 'warned' | 'suspended'
  memberSince: string
  totalBorrowed: number
  currentBorrowed: number
  totalFines: number
}

export interface Book {
  id: string
  title: string
  author: string
  isbn: string
  category: string
  rackLocation: string
  rfidTag: string
  status: 'available' | 'borrowed' | 'overdue'
  coverUrl?: string
  description?: string
}

export interface Transaction {
  id: string
  type: 'borrow' | 'return'
  bookId: string
  bookTitle: string
  memberId: string
  memberName: string
  borrowDate: string
  dueDate: string
  returnDate: string | null
  fine: number
  status: 'active' | 'completed' | 'overdue'
}

export interface Shelf {
  id: string
  name: string
  location: string
  capacity: { current: number; max: number }
  lockStatus: 'locked' | 'unlocked'
  connectivity: 'online' | 'offline'
  temperature?: number
  lastUpdate: number
}

export interface Notification {
  id: string
  userId: string
  type: 'reminder' | 'overdue' | 'fine' | 'system'
  title: string
  message: string
  read: boolean
  createdAt: number
}
