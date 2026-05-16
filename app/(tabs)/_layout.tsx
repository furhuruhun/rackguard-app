import { Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Home, BookOpen, QrCode, Clock, User } from 'lucide-react-native'

const TAB_CONFIG = [
  { name: 'index',   label: 'Beranda', Icon: Home },
  { name: 'catalog', label: 'Katalog', Icon: BookOpen },
  { name: 'payment', label: 'Bayar',   Icon: QrCode, center: true },
  { name: 'history', label: 'Riwayat', Icon: Clock },
  { name: 'profile', label: 'Profil',  Icon: User },
]

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets()
  return (
    <View style={[styles.tabBar, { paddingBottom: bottom + 8 }]}>
      {state.routes.filter((route) => route.name !== 'scan').map((route, index) => {
        const isFocused = state.routes[state.index]?.key === route.key
        const cfg = TAB_CONFIG[index]
        const isCenter = cfg?.center === true

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        if (isCenter) {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.centerWrap}
              activeOpacity={0.85}
            >
              <View style={[styles.centerBtn, isFocused && styles.centerBtnActive]}>
                <QrCode color="#fff" size={26} />
              </View>
              <Text style={[styles.centerLabel, isFocused && { color: '#3B82F6' }]}>
                Scan
              </Text>
            </TouchableOpacity>
          )
        }

        const color = isFocused ? '#3B82F6' : '#9CA3AF'
        const Icon = cfg?.Icon ?? Home

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {isFocused && (
              <LinearGradient
                colors={['rgba(59,130,246,0.13)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
            )}
            {isFocused && <View style={styles.indicator} pointerEvents="none" />}
            <Icon color={color} size={22} />
            <Text style={[styles.tabLabel, { color }]}>{cfg?.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index"   options={{ title: 'Beranda' }} />
      <Tabs.Screen name="catalog" options={{ title: 'Katalog' }} />
      <Tabs.Screen name="payment" options={{ title: 'Bayar / Aksi' }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="scan"    options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingBottom: 0,
    paddingTop: 0,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    gap: 3,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#3B82F6',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1F2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#1A1F2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  centerBtnActive: {
    backgroundColor: '#3B82F6',
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 3,
  },
})
