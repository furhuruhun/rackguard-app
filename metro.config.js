const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Disable package exports resolution so Metro falls back to the legacy
// `react-native` field in package.json. This lets packages like @firebase/auth
// correctly resolve to their React Native bundles (e.g. dist/rn/index.js)
// instead of the default browser ESM bundle which lacks getReactNativePersistence.
config.resolver.unstable_enablePackageExports = false

module.exports = config
