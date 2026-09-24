import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, ScrollView
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_BASE = "https://video-downloader-cvtw.onrender.com"; 

export default function App() {
  const [url, setUrl] = useState('');
  const [activePlatform, setActivePlatform] = useState('instagram'); 
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false); 
  
  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('best'); 

  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      scrollX.setValue(0);
      Animated.timing(scrollX, {
        toValue: -1200, 
        duration: 30000, 
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => startAnimation());
    };
    startAnimation();
  }, []);

  const isYoutubeShort = url.includes('/shorts/') || url.includes('youtube.com/shorts');

  const handleTabPress = (targetPlatform: string) => {
    if (url.trim().length > 0) {
      let linkPlatform = activePlatform;
      if (url.includes('instagram.com')) linkPlatform = 'instagram';
      else if (url.includes('youtube.com') || url.includes('youtu.be')) linkPlatform = 'youtube';
      else if (url.includes('tiktok.com')) linkPlatform = 'tiktok';

      if (targetPlatform !== linkPlatform) {
        Alert.alert(
          "İşlem Engellendi", 
          `Yapıştırdığınız link bir ${linkPlatform.toUpperCase()} linkidir. Lütfen önce linki temizleyin!`
        );
        return;
      }
    }
    setActivePlatform(targetPlatform);
  };

  const handleUrlChange = async (text: string) => {
    setUrl(text);
    setVideoInfo(null); 

    if (!text.includes('http')) return;

    let detected = activePlatform;
    if (text.includes('instagram.com')) detected = 'instagram';
    else if (text.includes('youtube.com') || text.includes('youtu.be')) detected = 'youtube';
    else if (text.includes('tiktok.com')) detected = 'tiktok';

    if (detected !== activePlatform) {
      setActivePlatform(detected);
    }

    setIsLoadingInfo(true);
    try {
      const response = await fetch(`${API_BASE}/info-${detected}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text }),
      });
      const data = await response.json();
      if (response.ok) {
        setVideoInfo(data);
      }
    } catch (e) {
      console.log("Önizleme alınamadı", e);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      handleUrlChange(text);
    } else {
      Alert.alert("Hata", "Panoda yapıştırılacak bir şey yok.");
    }
  };

  const handleClear = () => {
    setUrl('');
    setVideoInfo(null);
  };

  const handleDownload = async () => {
    if (!url) {
      Alert.alert("Uyarı", "Lütfen önce bir video linki yapıştırın.");
      return;
    }

    setIsDownloading(true);

    try {
      const endpoint = `${API_BASE}/download-${activePlatform}`;
      const payload: any = { url: url };
      if (activePlatform === 'youtube' && !isYoutubeShort) {
        payload.quality = selectedQuality;
      }

      if (Platform.OS === 'web') {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
          body: JSON.stringify(payload),
        };

        const downloadResumable = FileSystem.createDownloadResumable(endpoint, fileUri, downloadOptions);
        const result = await downloadResumable.downloadAsync();
        
        if (result && result.status !== 200) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new Error("Video indirilemedi veya dosya bozuk.");
        }

        if (result && result.uri) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }
        }
      }
    } catch (error: any) {
      Alert.alert("Hata", error.message || "Video indirilirken bir sorun oluştu.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.title}>VideoSaver <Text style={styles.proBadge}>PRO</Text></Text>

          {/* Platform Seçici */}
          <View style={styles.platformSelector}>
            <TouchableOpacity 
              style={[styles.platformBtn, activePlatform === 'instagram' && styles.activeInstagram]}
              onPress={() => handleTabPress('instagram')}
            >
              <FontAwesome5 name="instagram" size={26} color={activePlatform === 'instagram' ? '#FFF' : '#64748B'} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.platformBtn, activePlatform === 'youtube' && styles.activeYoutube]}
              onPress={() => handleTabPress('youtube')}
            >
              <FontAwesome5 name="youtube" size={26} color={activePlatform === 'youtube' ? '#FFF' : '#64748B'} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.platformBtn, activePlatform === 'tiktok' && styles.activeTiktok]}
              onPress={() => handleTabPress('tiktok')}
            >
              <FontAwesome5 name="tiktok" size={26} color={activePlatform === 'tiktok' ? '#111' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Input ve X / Yapıştır Butonları */}
          <View style={styles.inputWrapper}>
            {url.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.input}
              placeholder={`${activePlatform.toUpperCase()} linkini yapıştırın...`}
              placeholderTextColor="#64748B"
              value={url}
              onChangeText={handleUrlChange}
              editable={!isDownloading}
            />
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} disabled={isDownloading}>
              <Ionicons name="clipboard-outline" size={24} color="#00F2FE" />
            </TouchableOpacity>
          </View>

          {isLoadingInfo && (
            <View style={styles.loadingInfoContainer}>
              <ActivityIndicator color="#00F2FE" size="small" />
              <Text style={styles.loadingInfoText}>Video taranıyor...</Text>
            </View>
          )}

          {/* Sabit Boyutlu Şık Önizleme Kartı */}
          {videoInfo && !isLoadingInfo && (
            <View style={styles.previewCard}>
              {videoInfo.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : null}
              <View style={styles.titleContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.videoTitle} numberOfLines={2}>{videoInfo.title}</Text>
              </View>
            </View>
          )}

          {/* YouTube Kalite Seçici */}
          {activePlatform === 'youtube' && !isYoutubeShort && videoInfo && (
            <View style={styles.qualityContainer}>
              <Text style={styles.qualityLabel}>Kalite Seç:</Text>
              {['best', '720p', '360p'].map((q) => (
                <TouchableOpacity 
                  key={q} 
                  style={[styles.qualityBtn, selectedQuality === q && styles.activeQualityBtn]}
                  onPress={() => setSelectedQuality(q)}
                >
                  <Text style={[styles.qualityText, selectedQuality === q && {color: '#FFF', fontWeight: 'bold'}]}>{q.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* İndir Butonu */}
          {videoInfo && (
            <TouchableOpacity 
              style={[
                styles.downloadBtn, 
                activePlatform === 'instagram' && styles.btnInstagram,
                activePlatform === 'youtube' && styles.btnYoutube,
                activePlatform === 'tiktok' && styles.btnTiktok,
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
                  <Text style={styles.downloadBtnText}>Videoyu İndir</Text>
                </>
              )}
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ARKA PLAN ANİMASYONU TAMAMEN EN ALTTA (Önünde hiçbir şey yok) */}
      <View style={styles.bottomAnimationContainer} pointerEvents="none">
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <FontAwesome5 name="instagram" size={60} color="rgba(0, 242, 254, 0.2)" style={styles.bgIcon} />
              <FontAwesome5 name="youtube" size={60} color="rgba(255, 0, 80, 0.2)" style={styles.bgIcon} />
              <FontAwesome5 name="tiktok" size={60} color="rgba(255, 255, 255, 0.2)" style={styles.bgIcon} />
            </View>
          ))}
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030307' },
  
  // Animasyon artık tam dipte, hiçbir şeyi engellemiyor ve net görünüyor
  bottomAnimationContainer: { position: 'absolute', bottom: 20, left: 0, right: 0, height: 70, justifyContent: 'center', overflow: 'hidden' },
  movingBackground: { flexDirection: 'row', width: 4000 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  bgIcon: { marginHorizontal: 35 },

  content: { flex: 1, zIndex: 1, marginBottom: 80 }, // İçerik animasyonun üstünde kalır
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, marginBottom: 30, textAlign: 'center', textShadowColor: '#00F2FE', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  proBadge: { fontSize: 16, color: '#00F2FE', fontWeight: 'bold' },
  platformSelector: { flexDirection: 'row', backgroundColor: '#0F101A', borderRadius: 20, padding: 8, marginBottom: 25, width: '100%', justifyContent: 'space-between', borderWidth: 1, borderColor: '#1E2238' },
  platformBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
  
  activeInstagram: { backgroundColor: '#E1306C', borderWidth: 1.5, borderColor: '#FF70A6', shadowColor: '#E1306C', elevation: 12, shadowOpacity: 0.7, shadowRadius: 10 },
  activeYoutube: { backgroundColor: '#FF0000', borderWidth: 1.5, borderColor: '#FF6666', shadowColor: '#FF0000', elevation: 12, shadowOpacity: 0.7, shadowRadius: 10 },
  activeTiktok: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FF0050', shadowColor: '#FF0050', elevation: 12, shadowOpacity: 0.8, shadowRadius: 12 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F101A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2F4C', marginBottom: 20, paddingHorizontal: 16, width: '100%', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  clearBtn: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 18, color: '#F8FAFC', fontSize: 16 },
  pasteBtn: { padding: 10 },
  loadingInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingInfoText: { color: '#00F2FE', marginLeft: 8, fontSize: 14, fontWeight: '600' },
  
  // Küçük ve Sabit Thumbnail (Tüm ekrana yayılma sorunu bitti)
  previewCard: { width: '100%', backgroundColor: '#0F101A', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#00F2FE', marginBottom: 20, alignItems: 'center', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  thumbnail: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#1E2238' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 4 },
  videoTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', flex: 1 },
  
  qualityContainer: { flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#0F101A', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2A2F4C' },
  qualityLabel: { color: '#94A3B8', fontWeight: 'bold', fontSize: 14 },
  qualityBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1E2238' },
  activeQualityBtn: { backgroundColor: '#FF0000', shadowColor: '#FF0000', shadowOpacity: 0.5, shadowRadius: 6, elevation: 5 },
  qualityText: { color: '#94A3B8', fontSize: 12 },
  
  downloadBtn: { flexDirection: 'row', width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  btnInstagram: { backgroundColor: '#E1306C', shadowColor: '#E1306C' },
  btnYoutube: { backgroundColor: '#FF0000', shadowColor: '#FF0000' },
  btnTiktok: { backgroundColor: '#FF0050', shadowColor: '#FF0050' },
  downloadBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }
});