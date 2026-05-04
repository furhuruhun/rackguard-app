import { Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Home, BookOpen, ScanLine, Clock, User } from 'lucide-react-native'

const TAB_CONFIG = [
  { name: 'index',   label: 'Beranda', Icon: Home },
  { name: 'catalog', label: 'Katalog', Icon: BookOpen },
  { name: 'scan',    label: 'Scan',    Icon: ScanLine, center: true },
  { name: 'history', label: 'Riwayat', Icon: Clock },
  { name: 'profile', label: 'Profil',  Icon: User },
]

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index
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
                <ScanLine color="#fff" size={26} />
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
      <Tabs.Screen name="scan"    options={{ title: 'Scan' }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
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
    gap: 3,
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
