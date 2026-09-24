import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Animated, Easing, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [url, setUrl] = useState('');
  const [activePlatform, setActivePlatform] = useState('instagram'); // instagram, youtube, tiktok
  
  // Arka plan animasyonu için değer
  const scrollX = useRef(new Animated.Value(0)).current;

  // Arka plandaki logoların sonsuz akması için animasyon döngüsü
  useEffect(() => {
    Animated.loop(
      Animated.timing(scrollX, {
        toValue: -1000, // Ne kadar uzağa kayacağı
        duration: 25000, // Kayma hızı (25 saniye)
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Panodan link yapıştırma fonksiyonu
  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    } else {
      Alert.alert("Hata", "Panoda yapıştırılacak bir şey yok.");
    }
  };

  const handleDownload = () => {
    Alert.alert("Bilgi", `Arka plan (Backend) bağlandığında ${activePlatform.toUpperCase()} videosu inecek!`);
  };

  return (
    <View style={styles.container}>
      
      {/* 1. HAREKETLİ ARKA PLAN (Kayan Logolar) */}
      <View style={styles.backgroundWrapper}>
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {/* Döngüsel hissiyat için logoları çoğalttık */}
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <FontAwesome5 name="instagram" size={80} color="rgba(255,255,255,0.03)" style={styles.bgIcon} />
              <FontAwesome5 name="youtube" size={80} color="rgba(255,255,255,0.03)" style={styles.bgIcon} />
              <FontAwesome5 name="tiktok" size={80} color="rgba(255,255,255,0.03)" style={styles.bgIcon} />
            </View>
          ))}
        </Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        
        {/* BAŞLIK */}
        <Text style={styles.title}>VideoSaver <Text style={styles.proBadge}>PRO</Text></Text>

        {/* 2. PLATFORM SEÇİCİ (Üst Kısım) */}
        <View style={styles.platformSelector}>
          <TouchableOpacity 
            style={[styles.platformBtn, activePlatform === 'instagram' && styles.activeInstagram]}
            onPress={() => setActivePlatform('instagram')}
          >
            <FontAwesome5 name="instagram" size={28} color={activePlatform === 'instagram' ? '#FFF' : '#64748B'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.platformBtn, activePlatform === 'youtube' && styles.activeYoutube]}
            onPress={() => setActivePlatform('youtube')}
          >
            <FontAwesome5 name="youtube" size={28} color={activePlatform === 'youtube' ? '#FFF' : '#64748B'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.platformBtn, activePlatform === 'tiktok' && styles.activeTiktok]}
            onPress={() => setActivePlatform('tiktok')}
          >
            <FontAwesome5 name="tiktok" size={28} color={activePlatform === 'tiktok' ? '#FFF' : '#64748B'} />
          </TouchableOpacity>
        </View>

        {/* 3. INPUT VE YAPIŞTIRMA İKONU */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={`${activePlatform.toUpperCase()} linkini buraya girin...`}
            placeholderTextColor="#64748B"
            value={url}
            onChangeText={setUrl}
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
            <Ionicons name="clipboard-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ANA İNDİR BUTONU */}
        <TouchableOpacity 
          style={[
            styles.downloadBtn, 
            activePlatform === 'instagram' && { backgroundColor: '#E1306C' },
            activePlatform === 'youtube' && { backgroundColor: '#FF0000' },
            activePlatform === 'tiktok' && { backgroundColor: '#00F2FE' },
          ]} 
          onPress={handleDownload}
        >
          <Ionicons name="cloud-download-outline" size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.downloadBtnText}>Videoyu Bul ve İndir</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19', // Çok premium koyu lacivert/siyah
    justifyContent: 'center',
  },
 backgroundWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  movingBackground: {
    flexDirection: 'row',
    width: 3000,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bgIcon: {
    marginHorizontal: 40,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 1, // Animasyonun üstünde durması için
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 40,
  },
  proBadge: {
    fontSize: 16,
    color: '#00F2FE',
    fontWeight: 'bold',
  },
  platformSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 8,
    marginBottom: 30,
    width: '100%',
    justifyContent: 'space-between',
  },
  platformBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  activeInstagram: { backgroundColor: '#E1306C', shadowColor: '#E1306C', elevation: 10, shadowOpacity: 0.4, shadowRadius: 8 },
  activeYoutube: { backgroundColor: '#FF0000', shadowColor: '#FF0000', elevation: 10, shadowOpacity: 0.4, shadowRadius: 8 },
  activeTiktok: { backgroundColor: '#25F4EE', shadowColor: '#25F4EE', elevation: 10, shadowOpacity: 0.4, shadowRadius: 8 },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    color: '#F8FAFC',
    fontSize: 16,
  },
  pasteBtn: {
    padding: 10,
  },
  downloadBtn: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});