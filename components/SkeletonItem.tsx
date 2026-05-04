import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, ViewStyle } from 'react-native'

export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [opacity])

  return <Animated.View style={[styles.base, { opacity }, style]} />
}

export function BookItemSkeleton() {
  return (
    <View style={styles.bookItem}>
      <Skeleton style={styles.cover} />
      <View style={styles.info}>
        <Skeleton style={styles.line1} />
        <Skeleton style={styles.line2} />
        <Skeleton style={styles.line3} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#e5e7eb', borderRadius: 6 },
  bookItem: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cover: { width: 52, height: 70, borderRadius: 6 },
  info: { flex: 1, gap: 8, paddingTop: 4 },
  line1: { height: 14, width: '70%', borderRadius: 4 },
  line2: { height: 12, width: '50%', borderRadius: 4 },
  line3: { height: 22, width: 80, borderRadius: 99 },
})
