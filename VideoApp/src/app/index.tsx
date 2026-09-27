import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, ScrollView
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
      const filename = `${platform}_video_${Date.now()}.mp4`;

      if (Platform.OS === 'web') {
        const res = await fetch(`${API_BASE}/download-${platform}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link }),
        });
        if (!res.ok) {
          throw new Error(await readError(res, "İndirme başarısız oldu."));
        }
        const blob = await res.blob();

        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share && nav?.canShare) {
          try {
            const file = new File([blob], filename, { type: 'video/mp4' });
            if (nav.canShare({ files: [file] })) {
              await nav.share({ files: [file], title: filename });
              setDownloadSuccess(true);
              return;
            }
          } catch (shareErr) {
            console.log('navigator.share kullanılamadı:', shareErr);
          }
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        setDownloadSuccess(true);
        return;
      }

      const endpoint = `${API_BASE}/download-${platform}?url=${encodeURIComponent(link)}`;
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || 'file:///var/mobile/';
      const fileUri = `${dir}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(endpoint, fileUri);
      const result = await downloadResumable.downloadAsync();

      if (!result) throw new Error("İndirme iptal edildi.");

      if (result.status !== 200) {
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
        Alert.alert("Başarılı", "Video indirildi: " + result.uri);
      }
      setDownloadSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "İndirme başarısız oldu.";
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

          {/* Voxel / Piksel Retro Logo ve Başlık */}
          <View style={styles.headerContainer}>
            <Image 
              source={require('../assets/pixel-logo.png')}
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <Text style={styles.title}>BitSaver <Text style={styles.proBadge}>PRO</Text></Text>
          </View>
          <Text style={styles.subtitle}>[ RETRO BIT-DOWNLOAD SYSTEM v2.0 ]</Text>

          {/* Platform Seçici (Pixel / Voxel Tarzı) */}
          <View style={styles.platformSelector}>
            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'instagram' && styles.activeInstagram]}
              onPress={() => handleTabPress('instagram')}
            >
              <FontAwesome5 name="instagram" size={24} color={activePlatform === 'instagram' ? '#FFF' : '#A78BFA'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'x' && styles.activeX]}
              onPress={() => handleTabPress('x')}
            >
              <Text style={[styles.xLogoText, { color: activePlatform === 'x' ? '#FFF' : '#A78BFA' }]}>𝕏</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.platformBtn, activePlatform === 'tiktok' && styles.activeTiktok]}
              onPress={() => handleTabPress('tiktok')}
            >
              <FontAwesome5 name="tiktok" size={24} color={activePlatform === 'tiktok' ? '#FFF' : '#A78BFA'} />
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
              placeholder={`${platformLabel} linkini giriniz...`}
              placeholderTextColor="#6B7280"
              value={url}
              onChangeText={handleUrlChange}
              editable={!isDownloading}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} disabled={isDownloading}>
              <Ionicons name="clipboard-outline" size={22} color="#EC4899" />
            </TouchableOpacity>
          </View>

          {url.length === 0 && (
            <Text style={styles.hintText}>
              &gt; Herkese açık video ve gönderi linklerini yapıştırabilirsiniz.
            </Text>
          )}

          {isLoadingInfo && (
            <View style={styles.loadingInfoContainer}>
              <ActivityIndicator color="#EC4899" size="small" />
              <Text style={styles.loadingInfoText}>[ BIT SCANNING... ]</Text>
            </View>
          )}

          {infoError && !isLoadingInfo && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{infoError}</Text>
            </View>
          )}

          {/* Önizleme Kartı */}
          {url.length > 5 && !isLoadingInfo && !infoError && (
            <View style={styles.previewCard}>
              {videoInfo?.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.fallbackThumbnail}>
                  {activePlatform === 'x' ? (
                    <Text style={[styles.xLogoText, { color: '#EC4899', fontSize: 32 }]}>𝕏</Text>
                  ) : (
                    <FontAwesome5 name={activePlatform} size={36} color="#EC4899" />
                  )}
                  <Text style={styles.fallbackText}>[ {platformLabel} DATA ]</Text>
                </View>
              )}
              <View style={styles.titleContainer}>
                <Ionicons name="checkmark-done-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoInfo?.title || `${platformLabel} Verisi Hazır`}
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
                  <Text style={styles.downloadBtnText}>İNDİRİLİYOR...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={22} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.downloadBtnText}>VİDEOYU İNDİR [RETRO]</Text>
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
              <Text style={styles.successText}>[ BAŞARILI ] Video indirildi.</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Alt Voxel/Bit Animasyon Şeridi */}
      <View style={styles.bottomAnimationContainer} pointerEvents="none">
        <Animated.View style={[styles.movingBackground, { transform: [{ translateX: scrollX }] }]}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.logoRow}>
              <Image source={require('./assets/pixel-logo.png')} style={styles.movingIcon} resizeMode="contain" />
              <FontAwesome5 name="instagram" size={28} color="#A78BFA" style={{ marginHorizontal: 25 }} />
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#EC4899', marginHorizontal: 25 }}>𝕏</Text>
              <FontAwesome5 name="tiktok" size={28} color="#25F4EE" style={{ marginHorizontal: 25 }} />
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0518' },
  bottomAnimationContainer: { position: 'absolute', bottom: 10, left: 0, right: 0, height: 50, justifyContent: 'center', overflow: 'hidden', borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#3B0764', backgroundColor: '#110826' },
  movingBackground: { flexDirection: 'row', width: 4000 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  movingIcon: { width: 32, height: 32, marginHorizontal: 25 },

  content: { flex: 1, zIndex: 1, marginBottom: 65 },
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoImage: { width: 48, height: 48, marginRight: 12 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2, textShadowColor: '#EC4899', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  proBadge: { fontSize: 16, color: '#25F4EE', fontWeight: 'bold' },
  subtitle: { color: '#A78BFA', fontSize: 11, textAlign: 'center', marginBottom: 26, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },

  platformSelector: { flexDirection: 'row', backgroundColor: '#170E33', borderRadius: 6, padding: 6, marginBottom: 24, width: '100%', justifyContent: 'space-between', borderWidth: 2, borderColor: '#4C1D95' },
  platformBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 4 },
  xLogoText: { fontSize: 24, fontWeight: '900' },

  activeInstagram: { backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#C4B5FD', shadowColor: '#8B5CF6', elevation: 8 },
  activeX: { backgroundColor: '#31104D', borderWidth: 2, borderColor: '#A78BFA', shadowColor: '#A78BFA', elevation: 8 },
  activeTiktok: { backgroundColor: '#EC4899', borderWidth: 2, borderColor: '#F472B6', shadowColor: '#EC4899', elevation: 8 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#170E33', borderRadius: 8, borderWidth: 2, borderColor: '#4C1D95', marginBottom: 12, paddingHorizontal: 16, width: '100%', shadowColor: '#EC4899', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.3, shadowRadius: 0, elevation: 4 },
  clearBtn: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 16, color: '#F8FAFC', fontSize: 15 },
  pasteBtn: { padding: 10 },
  hintText: { color: '#8B5CF6', fontSize: 11, textAlign: 'center', marginBottom: 20, paddingHorizontal: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  errorCard: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#2A121A', borderRadius: 6, borderWidth: 2, borderColor: '#EF4444', padding: 12, marginBottom: 20 },
  errorText: { color: '#FCA5A5', fontSize: 12, flex: 1 },
  successCard: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#0F2A1E', borderRadius: 6, borderWidth: 2, borderColor: '#10B981', padding: 12 },
  successText: { color: '#6EE7B7', fontSize: 12, flex: 1 },
  loadingInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingInfoText: { color: '#EC4899', marginLeft: 8, fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  previewCard: { width: '100%', backgroundColor: '#170E33', borderRadius: 8, padding: 14, borderWidth: 2, borderColor: '#8B5CF6', marginBottom: 20, alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.4, shadowRadius: 0, elevation: 6 },
  thumbnail: { width: '100%', height: 140, borderRadius: 4, marginBottom: 12, backgroundColor: '#110826' },
  fallbackThumbnail: { width: '100%', height: 100, borderRadius: 4, marginBottom: 12, backgroundColor: '#110826', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3B0764' },
  fallbackText: { color: '#A78BFA', fontSize: 11, marginTop: 6, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 4 },
  videoTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', flex: 1 },

  downloadBtn: { flexDirection: 'row', width: '100%', paddingVertical: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F472B6', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.6, shadowRadius: 0, elevation: 8 },
  btnInstagram: { backgroundColor: '#7C3AED', shadowColor: '#7C3AED' },
  btnX: { backgroundColor: '#1F1033', shadowColor: '#EC4899' },
  btnTiktok: { backgroundColor: '#DB2777', shadowColor: '#DB2777' },
  downloadBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});