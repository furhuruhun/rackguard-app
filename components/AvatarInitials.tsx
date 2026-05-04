import { View, Text, StyleSheet } from 'react-native'
import { getInitials, getAvatarColor } from '@/lib/utils'

interface Props {
  name: string
  size?: number
}

export default function AvatarInitials({ name, size = 48 }: Props) {
  const bg = getAvatarColor(name)
  const initials = getInitials(name)
  const fontSize = size * 0.36

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
})
