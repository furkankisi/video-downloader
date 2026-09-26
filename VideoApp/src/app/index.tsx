import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, ScrollView
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Sunucu adresi: Vercel/Expo ortam değişkeni EXPO_PUBLIC_API_BASE ile değiştirilebilir (kod değiştirmeden)
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || "https://video-downloader-cvtw.onrender.com").replace(/\/$/, "");
const INFO_TIMEOUT_MS = 70000;

type Platform_ = 'instagram' | 'x' | 'tiktok';

const PLATFORM_LABELS: Record<Platform_, string> = {
  instagram: 'Instagram',
  x: 'X (Twitter)',
  tiktok: 'TikTok',
};

const extractUrl = (text: string): string => {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;]+$/, '') : text.trim();
};

const detectPlatform = (text: string, fallback: Platform_): Platform_ => {
  const t = text.toLowerCase();
  if (t.includes('instagram.com') || t.includes('instagr.am')) return 'instagram';
  if (t.includes('twitter.com') || t.includes('x.com') || t.includes('t.co/')) return 'x';
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
  const [activePlatform, setActivePlatform] = useState<Platform_>('instagram');
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
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

  const handleTabPress = (targetPlatform: Platform_) => {
    if (url.trim().length > 0) {
      const linkPlatform = detectPlatform(url, activePlatform);
      if (targetPlatform !== linkPlatform) {
        Alert.alert(
          "İşlem Engellendi",
          `Yapıştırdığınız link bir ${PLATFORM_LABELS[linkPlatform]} linkidir. Lütfen önce linki temizleyin!`
        );
        return;
      }
    }
    setActivePlatform(targetPlatform);
  };

  const fetchInfo = async (link: string, platform: Platform_, reqId: number) => {
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
      if (reqId !== requestIdRef.current) return;
      if (response.ok) {
        setVideoInfo(await response.json());
      } else {
        setInfoError(await readError(response, 'Video bilgisi alınamadı.'));
      }
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      setInfoError(e?.name === 'AbortError'
        ? 'Sunucu yanıt vermedi (uyanıyor olabilir), birkaç saniye sonra tekrar deneyin.'
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
    setDownloadError(null);
    setDownloadSuccess(false);
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
      Alert.alert("Panoda Bir Şey Yok", "Önce linki kopyalamanız gerekiyor.");
    }
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current += 1;
    setUrl('');
    setVideoInfo(null);
    setInfoError(null);
    setDownloadError(null);
    setDownloadSuccess(false);
    setIsLoadingInfo(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const link = extractUrl(url);
      const platform = detectPlatform(link, activePlatform);
      const endpoint = `${API_BASE}/download-${platform}`;

      if (Platform.OS === 'web') {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link }),
        });
        if (!res.ok) {
          throw new Error(await readError(res, "İndirme başarısız oldu."));
        }
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${platform}_video_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        setDownloadSuccess(true);
        return;
      }

      // Mobil: sunucuya POST ile indirip diske kaydet
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || 'file:///var/mobile/';
      const fileUri = `${dir}${platform}_video_${Date.now()}.mp4`;

      const downloadResumable = FileSystem.createDownloadResumable(
        endpoint,
        fileUri,
        {
          httpMethod: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link }),
        } as any,
      );
      const result = await downloadResumable.downloadAsync();

      if (!result) throw new Error("İndirme iptal edildi.");

      if (result.status !== 200) {
        // Sunucu hata durumunda küçük bir JSON döner; gerçek sebebi dosyadan oku
        let msg = "Video indirilemedi.";
        try {
          const body = await FileSystem.readAsStringAsync(result.uri);
          const j = JSON.parse(body);
          if (typeof j?.detail === 'string') msg = j.detail;
        } catch {}
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error(msg);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
      } else {
        Alert.alert("Başarılı", "Video indirildi.");
      }
      setDownloadSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "İndirme başarısız oldu.";
      // Alert.alert web'de sessizce hiçbir şey yapmaz; hatayı ekranda kartla göster
      setDownloadError(errorMessage);
      if (Platform.OS !== 'web') Alert.alert("İndirilemedi", errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const platformLabel = PLATFORM_LABELS[activePlatform];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>

          <Text style={styles.title}>VideoSaver <Text style={styles.proBadge}>PRO</Text></Text>
          <Text style={styles.subtitle}>Instagram, X ve TikTok videolarını saniyeler içinde indir</Text>

          {/* Platform Seçici (Instagram - X - TikTok) */}
          <View style={styles.platformSelector}>
            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'instagram' && styles.activeInstagram]}
              onPress={() => handleTabPress('instagram')}
            >
              <FontAwesome5 name="instagram" size={26} color={activePlatform === 'instagram' ? '#FFF' : '#64748B'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'x' && styles.activeX]}
              onPress={() => handleTabPress('x')}
            >
              <Text style={[styles.xLogoText, { color: activePlatform === 'x' ? '#FFF' : '#64748B' }]}>𝕏</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'tiktok' && styles.activeTiktok]}
              onPress={() => handleTabPress('tiktok')}
            >
              <FontAwesome5 name="tiktok" size={26} color={activePlatform === 'tiktok' ? '#111' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Input ve Temizle / Yapıştır Butonları */}
          <View style={styles.inputWrapper}>
            {url.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.input}
              placeholder={`${platformLabel} linkini yapıştırın...`}
              placeholderTextColor="#64748B"
              value={url}
              onChangeText={handleUrlChange}
              editable={!isDownloading}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} disabled={isDownloading}>
              <Ionicons name="clipboard-outline" size={24} color="#00F2FE" />
            </TouchableOpacity>
          </View>

          {url.length === 0 && (
            <Text style={styles.hintText}>
              Yalnızca herkese açık gönderiler indirilebilir. Paylaşım metnini olduğu gibi de yapıştırabilirsiniz.
            </Text>
          )}

          {isLoadingInfo && (
            <View style={styles.loadingInfoContainer}>
              <ActivityIndicator color="#00F2FE" size="small" />
              <Text style={styles.loadingInfoText}>{platformLabel} gönderisi taranıyor...</Text>
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
                  {activePlatform === 'x' ? (
                    <Text style={[styles.xLogoText, { color: '#00F2FE', fontSize: 36 }]}>𝕏</Text>
                  ) : (
                    <FontAwesome5 name={activePlatform} size={40} color="#00F2FE" />
                  )}
                  <Text style={styles.fallbackText}>{platformLabel} Videosu</Text>
                </View>
              )}
              <View style={styles.titleContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoInfo?.title || `${platformLabel} Bağlantısı Hazır`}
                </Text>
              </View>
            </View>
          )}

          {/* İndir Butonu */}
          {url.length > 5 && (
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                activePlatform === 'instagram' && styles.btnInstagram,
                activePlatform === 'x' && styles.btnX,
                activePlatform === 'tiktok' && styles.btnTiktok,
                isDownloading && { opacity: 0.7 }
              ]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.downloadBtnText}>İndiriliyor...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={24} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.downloadBtnText}>Videoyu İndir</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {downloadError && !isDownloading && (
            <View style={[styles.errorCard, { marginTop: 16 }]}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{downloadError}</Text>
            </View>
          )}

          {downloadSuccess && !isDownloading && !downloadError && (
            <View style={[styles.successCard, { marginTop: 16 }]}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={styles.successText}>Video indirildi.</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Alt Animasyon Şeridi */}
      <View style={styles.bottomAnimationContainer} pointerEvents="none">
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <FontAwesome5 name="instagram" size={45} color="#FFFFFF" style={styles.neonInsta} />
              <Text style={[styles.neonXText, styles.neonX]}>𝕏</Text>
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
  neonXText: { fontSize: 42, fontWeight: '900', marginHorizontal: 35, color: '#FFFFFF' },
  neonX: { textShadowColor: '#FFFFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  neonTiktok: { marginHorizontal: 35, textShadowColor: '#FF0050', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },

  content: { flex: 1, zIndex: 1, marginBottom: 70 },
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, textAlign: 'center', textShadowColor: '#00F2FE', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  proBadge: { fontSize: 16, color: '#00F2FE', fontWeight: 'bold' },
  subtitle: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 26 },
  platformSelector: { flexDirection: 'row', backgroundColor: '#0F101A', borderRadius: 20, padding: 8, marginBottom: 25, width: '100%', justifyContent: 'space-between', borderWidth: 1, borderColor: '#1E2238' },
  platformBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  xLogoText: { fontSize: 26, fontWeight: '900' },

  activeInstagram: { backgroundColor: '#E1306C', borderWidth: 1.5, borderColor: '#FF70A6', shadowColor: '#E1306C', elevation: 12, shadowOpacity: 0.8, shadowRadius: 10 },
  activeX: { backgroundColor: '#14171A', borderWidth: 1.5, borderColor: '#657786', shadowColor: '#FFFFFF', elevation: 12, shadowOpacity: 0.8, shadowRadius: 10 },
  activeTiktok: { backgroundColor: '#FF0050', borderWidth: 1.5, borderColor: '#FF758C', shadowColor: '#FF0050', elevation: 12, shadowOpacity: 0.8, shadowRadius: 12 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F101A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2F4C', marginBottom: 10, paddingHorizontal: 16, width: '100%', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  clearBtn: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 18, color: '#F8FAFC', fontSize: 16 },
  pasteBtn: { padding: 10 },
  hintText: { color: '#475569', fontSize: 12, textAlign: 'center', marginBottom: 20, paddingHorizontal: 8 },
  errorCard: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#1F0F14', borderRadius: 14, borderWidth: 1, borderColor: '#EF4444', padding: 12, marginBottom: 20 },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },
  successCard: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#0F1F16', borderRadius: 14, borderWidth: 1, borderColor: '#10B981', padding: 12 },
  successText: { color: '#6EE7B7', fontSize: 13, flex: 1 },
  loadingInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingInfoText: { color: '#00F2FE', marginLeft: 8, fontSize: 14, fontWeight: '600' },

  previewCard: { width: '100%', backgroundColor: '#0F101A', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#00F2FE', marginBottom: 20, alignItems: 'center', shadowColor: '#00F2FE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  thumbnail: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#1E2238' },
  fallbackThumbnail: { width: '100%', height: 100, borderRadius: 12, marginBottom: 12, backgroundColor: '#161B2E', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#94A3B8', fontSize: 12, marginTop: 6, fontWeight: '600' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 4 },
  videoTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', flex: 1 },

  downloadBtn: { flexDirection: 'row', width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  btnInstagram: { backgroundColor: '#E1306C', shadowColor: '#E1306C' },
  btnX: { backgroundColor: '#14171A', shadowColor: '#FFFFFF', borderWidth: 1, borderColor: '#657786' },
  btnTiktok: { backgroundColor: '#FF0050', shadowColor: '#FF0050' },
  downloadBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }
});