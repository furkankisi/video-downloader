import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_BASE = "https://video-downloader-cvtw.onrender.com"; 

export default function App() {
  const [url, setUrl] = useState('');
  const [activePlatform, setActivePlatform] = useState('instagram'); 
  const [isDownloading, setIsDownloading] = useState(false); 
  
  const scrollX = useRef(new Animated.Value(0)).current;

  // SONSUZ VE KESİNTİSİZ ANİMASYON DÖNGÜSÜ
  useEffect(() => {
    const startAnimation = () => {
      scrollX.setValue(0);
      Animated.timing(scrollX, {
        toValue: -1200, // Logoların kayma mesafesi
        duration: 30000, // 30 saniye sürsün (Yavaş ve premium)
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => startAnimation()); // Bitince kendini tekrar başlat!
    };
    startAnimation();
  }, []);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    } else {
      Alert.alert("Hata", "Panoda yapıştırılacak bir şey yok.");
    }
  };

  const handleDownload = async () => {
    if (!url) {
      Alert.alert("Uyarı", "Lütfen önce bir video linki yapıştırın.");
      return;
    }

    setIsDownloading(true);

    try {
      // DİNAMİK YÖNLENDİRME: Hangi platform seçiliyse onun dosyasına gider!
      const endpoint = `${API_BASE}/download-${activePlatform}`;

      if (Platform.OS === 'web') {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        });
        
        if (!response.ok) throw new Error("İndirme başarısız.");
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${activePlatform}_video_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        const dir = (FileSystem as any).documentDirectory || 'file:///var/mobile/';
        const fileUri = `${dir}${activePlatform}_video_${Date.now()}.mp4`;

        const downloadOptions: any = {
          httpMethod: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        };

        const downloadResumable = FileSystem.createDownloadResumable(endpoint, fileUri, downloadOptions);
        const result = await downloadResumable.downloadAsync();
        
        if (result && result.status !== 200) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new Error(`${activePlatform.toUpperCase()} videosu indirilemedi. Linki kontrol edin.`);
        }

        if (result && result.uri) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Hata", error.message || "Video indirilirken bir sorun oluştu.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* HAREKETLİ ARKA PLAN (Daha görünür ve ortalandı) */}
      <View style={styles.backgroundWrapper}>
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <FontAwesome5 name="instagram" size={90} color="rgba(255,255,255,0.06)" style={styles.bgIcon} />
              <FontAwesome5 name="youtube" size={90} color="rgba(255,255,255,0.06)" style={styles.bgIcon} />
              <FontAwesome5 name="tiktok" size={90} color="rgba(255,255,255,0.06)" style={styles.bgIcon} />
            </View>
          ))}
        </Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        
        <Text style={styles.title}>VideoSaver <Text style={styles.proBadge}>PRO</Text></Text>

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

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={`${activePlatform.toUpperCase()} linkini yapıştırın...`}
            placeholderTextColor="#64748B"
            value={url}
            onChangeText={setUrl}
            editable={!isDownloading}
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} disabled={isDownloading}>
            <Ionicons name="clipboard-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[
            styles.downloadBtn, 
            activePlatform === 'instagram' && { backgroundColor: '#E1306C' },
            activePlatform === 'youtube' && { backgroundColor: '#FF0000' },
            activePlatform === 'tiktok' && { backgroundColor: '#00F2FE' },
            isDownloading && { opacity: 0.7 }
          ]} 
          onPress={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={24} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.downloadBtnText}>Videoyu Bul ve İndir</Text>
            </>
          )}
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19', 
    justifyContent: 'center',
  },
  backgroundWrapper: {
    position: 'absolute',
    top: '15%', // BİR TIK AŞAĞI ALINDI VE ORTALANDI
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  movingBackground: {
    flexDirection: 'row',
    width: 4000,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bgIcon: {
    marginHorizontal: 45,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 1, 
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