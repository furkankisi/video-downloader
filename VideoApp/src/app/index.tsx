import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, ScrollView
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
// SDK 54+ : createDownloadResumable/documentDirectory artık sadece legacy pakette (yeni pakette çağrılınca hata fırlatır)
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_BASE = "https://video-downloader-cvtw.onrender.com";

// Render ücretsiz plan uyurken ilk istek 30-60 sn sürebilir
const INFO_TIMEOUT_MS = 70000;

// "Şu videoya bak https://vm.tiktok.com/xyz/ #fyp" gibi paylaşım metninden sadece linki al
const extractUrl = (text: string): string => {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;]+$/, '') : text.trim();
};

const detectPlatform = (text: string, fallback: string): string => {
  const t = text.toLowerCase();
  if (t.includes('instagram.com') || t.includes('instagr.am')) return 'instagram';
  if (t.includes('youtube.com') || t.includes('youtu.be')) return 'youtube';
  if (t.includes('tiktok.com')) return 'tiktok';
  return fallback;
};

const readError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const j = await response.json();
    if (typeof j?.detail === 'string') return j.detail;
  } catch {}
  return fallback;
};

export default function App() {
  const [url, setUrl] = useState('');
  const [activePlatform, setActivePlatform] = useState('instagram'); 
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false); 
  
  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('best'); 
  const [infoError, setInfoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

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
      const linkPlatform = detectPlatform(url, activePlatform);

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

  const fetchInfo = async (link: string, platform: string, reqId: number) => {
    setIsLoadingInfo(true);
    setInfoError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INFO_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/info-${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
        signal: controller.signal,
      });
      if (reqId !== requestIdRef.current) return; // daha yeni bir istek var, bunu yok say
      if (response.ok) {
        setVideoInfo(await response.json());
      } else {
        setInfoError(await readError(response, 'Video bilgisi alınamadı.'));
      }
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      setInfoError(e?.name === 'AbortError'
        ? 'Sunucu yanıt vermedi (uyanıyor olabilir), tekrar deneyin.'
        : 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    } finally {
      clearTimeout(timer);
      if (reqId === requestIdRef.current) setIsLoadingInfo(false);
    }
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    setVideoInfo(null);
    setInfoError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current += 1;
    const reqId = requestIdRef.current;

    if (!/https?:\/\/\S{6,}/i.test(text)) {
      setIsLoadingInfo(false);
      return;
    }

    const link = extractUrl(text);
    const detected = detectPlatform(link, activePlatform);
    if (detected !== activePlatform) setActivePlatform(detected);

    // Her tuş vuruşunda değil, yazmayı bıraktıktan 600 ms sonra istek at
    debounceRef.current = setTimeout(() => fetchInfo(link, detected, reqId), 600);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current += 1;
    setUrl('');
    setVideoInfo(null);
    setInfoError(null);
    setIsLoadingInfo(false);
  };

 // Frontend tarafında download fonksiyonun içine eklenecek mantık:
const handleDownload = async () => {
  try {
    setIsDownloading(true);
    // 1. Sunucudan engelsiz direkt linki iste
    const res = await fetch(`${API_BASE}/download-youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    const data = await res.json();
    
    if (!res.ok || !data.direct_url) throw new Error("Link alınamadı.");

    // 2. Videoyu telefonun kendi IP'si ile (ban yemeden) doğrudan indir
    const dir = (FileSystem as any).documentDirectory || 'file:///var/mobile/';
    const fileUri = `${dir}youtube_video_${Date.now()}.mp4`;

    const downloadResumable = FileSystem.createDownloadResumable(
      data.direct_url, 
      fileUri
    );
    
    const result = await downloadResumable.downloadAsync();
    if (result && result.uri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      }
    }
  } catch (err: any) {
    Alert.alert("Hata", "İndirme başarısız oldu.");
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

          {infoError && !isLoadingInfo && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{infoError}</Text>
            </View>
          )}

          {/* Önizleme Kartı (Thumbnail yoksa şık bir ikon gösterir) */}
          {url.length > 5 && !isLoadingInfo && !infoError && (
            <View style={styles.previewCard}>
              {videoInfo?.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.fallbackThumbnail}>
                  <FontAwesome5 name={activePlatform} size={40} color="#00F2FE" />
                  <Text style={styles.fallbackText}>{activePlatform.toUpperCase()} Videosu</Text>
                </View>
              )}
              <View style={styles.titleContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoInfo?.title || `${activePlatform.toUpperCase()} Bağlantısı Hazır`}
                </Text>
              </View>
            </View>
          )}

          {/* YouTube Kalite Seçici */}
          {activePlatform === 'youtube' && !isYoutubeShort && url.length > 5 && (
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

          {/* İndir Butonu (Link girildiği an aktif olur) */}
          {url.length > 5 && (
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

      {/* EN ALTTA GERÇEK LOGOLU VE DIŞI NEON PARLAYAN ANİMASYON ŞERİDİ */}
      <View style={styles.bottomAnimationContainer} pointerEvents="none">
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <FontAwesome5 name="instagram" size={45} color="#FFFFFF" style={styles.neonInsta} />
              <FontAwesome5 name="youtube" size={45} color="#FFFFFF" style={styles.neonYoutube} />
              <FontAwesome5 name="tiktok" size={45} color="#FFFFFF" style={styles.neonTiktok} />
            </View>
          ))}
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030307' },
  
  bottomAnimationContainer: { position: 'absolute', bottom: 10, left: 0, right: 0, height: 60, justifyContent: 'center', overflow: 'hidden' },
  movingBackground: { flexDirection: 'row', width: 4000 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  
  neonInsta: { marginHorizontal: 35, textShadowColor: '#E1306C', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  neonYoutube: { marginHorizontal: 35, textShadowColor: '#FF0000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  neonTiktok: { marginHorizontal: 35, textShadowColor: '#FF0050', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },

  content: { flex: 1, zIndex: 1, marginBottom: 70 }, 
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, marginBottom: 30, textAlign: 'center', textShadowColor: '#00F2FE', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  proBadge: { fontSize: 16, color: '#00F2FE', fontWeight: 'bold' },
  platformSelector: { flexDirection: 'row', backgroundColor: '#0F101A', borderRadius: 20, padding: 8, marginBottom: 25, width: '100%', justifyContent: 'space-between', borderWidth: 1, borderColor: '#1E2238' },
  platformBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
  
  activeInstagram: { backgroundColor: '#E1306C', borderWidth: 1.5, borderColor: '#FF70A6', shadowColor: '#E1306C', elevation: 12, shadowOpacity: 0.8, shadowRadius: 10 },
  activeYoutube: { backgroundColor: '#FF0000', borderWidth: 1.5, borderColor: '#FF6666', shadowColor: '#FF0000', elevation: 12, shadowOpacity: 0.8, shadowRadius: 10 },
  activeTiktok: { backgroundColor: '#FF0050', borderWidth: 1.5, borderColor: '#FF758C', shadowColor: '#FF0050', elevation: 12, shadowOpacity: 0.8, shadowRadius: 12 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F101A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2F4C', marginBottom: 20, paddingHorizontal: 16, width: '100%', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  clearBtn: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 18, color: '#F8FAFC', fontSize: 16 },
  pasteBtn: { padding: 10 },
  errorCard: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#1F0F14', borderRadius: 14, borderWidth: 1, borderColor: '#EF4444', padding: 12, marginBottom: 20 },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },
  loadingInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingInfoText: { color: '#00F2FE', marginLeft: 8, fontSize: 14, fontWeight: '600' },
  
  previewCard: { width: '100%', backgroundColor: '#0F101A', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#00F2FE', marginBottom: 20, alignItems: 'center', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  thumbnail: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#1E2238' },
  fallbackThumbnail: { width: '100%', height: 100, borderRadius: 12, marginBottom: 12, backgroundColor: '#161B2E', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#94A3B8', fontSize: 12, marginTop: 6, fontWeight: '600' },
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