const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web build alırken react-native-google-mobile-ads modülünü tamamen yok say
if (process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_PLATFORM === 'web') {
  // Web için özel alias veya resolution ekleyebiliriz
}

config.resolver.sourceExts = process.env.Platform === 'web' 
  ? config.resolver.sourceExts.filter(ext => ext !== 'native.tsx') 
  : config.resolver.sourceExts;

module.exports = config;