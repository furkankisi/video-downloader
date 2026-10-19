import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Animated, Easing, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, ScrollView, Modal
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
// REVENUECAT EKLENDİ
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

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

  // ABONELİK DURUMLARI (REVENUECAT)
  const [isAdFree, setIsAdFree] = useState(false);
  const [currentOffering, setCurrentOffering] = useState<any>(null);

  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardCountdown, setRewardCountdown] = useState(5);
  const [rewardReady, setRewardReady] = useState(false);

  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  const rewardedAdRef = useRef<any>(null);

  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const scrollX = useRef(new Animated.Value(0)).current;

  // REVENUECAT BAŞLATMA
  useEffect(() => {
    setupRevenueCat();
  }, []);

  const setupRevenueCat = async () => {
    try {
      if (Platform.OS === 'web') return; // Web'de RevenueCat çalışmaz

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      
      // DİKKAT: BURAYA KENDİ REVENUECAT API KEYLERİNİ GİRECEKSİN!
      if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: "test_pXiDHTDUcMaHQtpATQGhrMrIwAr" }); 
      } else if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: "test_pXiDHTDUcMaHQtpATQGhrMrIwAr" });
      }

      // Aktif aboneliği kontrol et
      const customerInfo = await Purchases.getCustomerInfo();
      // 'pro_access', RevenueCat panelinde oluşturduğumuz Entitlement ID olacak
      if (typeof customerInfo.entitlements.active.pro_access !== "undefined") {
        setIsAdFree(true);
      }

      // Paketleri getir
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        setCurrentOffering(offerings.current);
      }
    } catch (e) {
      console.log("RevenueCat hatası:", e);
    }
  };

  // ABONE OLMA FONKSİYONU
  const buyAdFreeVersion = async () => {
    if (!currentOffering) {
      Alert.alert("Paketler Yükleniyor", "Lütfen birkaç saniye bekleyip tekrar deneyin.");
      return;
    }

    try {
      // Aylık paketi satın al (3 Gün Bedava olacak şekilde Play Console'da ayarlı)
      const { customerInfo } = await Purchases.purchasePackage(currentOffering.monthly);
      
      if (typeof customerInfo.entitlements.active.pro_access !== "undefined") {
        setIsAdFree(true);
        Alert.alert("Aramıza Hoş Geldin!", "İlk 3 gün tamamen ücretsiz. Reklamsız deneyimin tadını çıkar!");
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Hata", "Abonelik işlemi tamamlanamadı.");
      }
    }
  };

  // SATIN ALIMLARI GERİ YÜKLE (Kullanıcı uygulamayı silip yüklerse vs.)
  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (typeof customerInfo.entitlements.active.pro_access !== "undefined") {
        setIsAdFree(true);
        Alert.alert("Başarılı", "Aboneliğiniz başarıyla geri yüklendi!");
      } else {
        Alert.alert("Bilgi", "Aktif bir aboneliğiniz bulunamadı.");
      }
    } catch (e) {
      Alert.alert("Hata", "Geri yükleme işlemi başarısız oldu.");
    }
  };

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

  useEffect(() => {
    if (Platform.OS === 'web' && !isAdFree) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    }
  }, [isAdFree]);

  useEffect(() => {
    if (Platform.OS !== 'web' && !isAdFree) {
      try {
        const { RewardedAd, RewardedAdEventType, TestIds } = require('react-native-google-mobile-ads');
        const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-8754966775877680/2878129487';

        const rewarded = RewardedAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        rewardedAdRef.current = rewarded;
        const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setRewardedLoaded(true));
        const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => executeDownload());
        rewarded.load();

        return () => {
          unsubscribeLoaded();
          unsubscribeEarned();
        };
      } catch (e) {}
    }
  }, [isAdFree]);

  useEffect(() => {
    let timer: any;
    if (showRewardModal && rewardCountdown > 0) {
      timer = setTimeout(() => setRewardCountdown(prev => prev - 1), 1000);
    } else if (showRewardModal && rewardCountdown === 0) {
      setRewardReady(true);
    }
    return () => clearTimeout(timer);
  }, [showRewardModal, rewardCountdown]);

  const handleTabPress = (targetPlatform: Platform_) => {
    if (url.trim().length > 0) {
      const linkPlatform = detectPlatform(url, activePlatform);
      if (targetPlatform !== linkPlatform) {
        Alert.alert("İşlem Engellendi", `Bu link bir ${PLATFORM_LABELS[linkPlatform]} linkidir.`);
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
      setInfoError('Sunucuya ulaşılamadı.');
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
    if (text) handleUrlChange(text);
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

  const triggerDownloadProcess = () => {
    if (isAdFree) {
      executeDownload();
      return;
    }
    if (Platform.OS !== 'web' && rewardedAdRef.current && rewardedLoaded) {
      try {
        rewardedAdRef.current.show();
        return;
      } catch (e) {}
    }
    setRewardCountdown(5);
    setRewardReady(false);
    setShowRewardModal(true);
  };

  const executeDownload = async () => {
    setShowRewardModal(false);
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
        if (!res.ok) throw new Error("İndirme başarısız.");
        const blob = await res.blob();
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

      // GALERİYE KAYDETME (MediaLibrary)
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error("Galeriye kaydetmek için izin vermelisiniz.");
      }

      const endpoint = `${API_BASE}/download-${platform}?url=${encodeURIComponent(link)}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResumable = FileSystem.createDownloadResumable(endpoint, fileUri);
      const result = await downloadResumable.downloadAsync();

      if (!result || result.status !== 200) throw new Error("Video indirilemedi.");

      const asset = await MediaLibrary.createAssetAsync(result.uri);
      await MediaLibrary.createAlbumAsync("BitSaverPro", asset, false);

      Alert.alert("Başarılı", "Video başarıyla galeriye kaydedildi! 📱");
      setDownloadSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "İndirme başarısız.";
      setDownloadError(errorMessage);
      if (Platform.OS !== 'web') Alert.alert("Hata", errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const platformLabel = PLATFORM_LABELS[activePlatform];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
          
          {/* REKLAM ALANLARI */}
          {!isAdFree && (
            Platform.OS === 'web' ? (
              <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
                {/* @ts-ignore */}
                <ins
                  className="adsbygoogle"
                  style={{ display: 'block', width: '100%' }}
                  data-ad-client="ca-pub-8754966775877680"
                  data-ad-slot="4753170122"
                  data-ad-format="auto"
                  data-full-width-responsive="true"
                />
              </View>
            ) : (
              <View style={{ marginBottom: 20, alignItems: 'center', width: '100%' }}>
                {(() => {
                  try {
                    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
                    return (
                      <BannerAd
                        unitId="ca-app-pub-8754966775877680/7883219165"
                        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                      />
                    );
                  } catch (e) {
                    return null;
                  }
                })()}
              </View>
            )
          )}

          <View style={styles.headerContainer}>
            <Image source={require('../assets/images/pixel-logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>BitSaver <Text style={styles.proBadge}>PRO</Text></Text>
          </View>
          <Text style={styles.subtitle}>[ RETRO BIT-DOWNLOAD SYSTEM v2.0 ]</Text>

          {/* ABONELİK (PRO) ALANI */}
          {!isAdFree && (
            <View style={{ alignItems: 'center', marginBottom: 24, width: '100%' }}>
              <TouchableOpacity style={styles.proUpgradeBtn} onPress={buyAdFreeVersion}>
                <Ionicons name="star" size={16} color="#FBBF24" style={{ marginRight: 6 }} />
                <Text style={styles.proUpgradeText}>REKLAMLARI KALDIR [ İLK 3 GÜN ÜCRETSİZ ]</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={restorePurchases}>
                <Text style={styles.restoreText}>Satın Alımları Geri Yükle</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.platformSelector}>
            <TouchableOpacity style={[styles.platformBtn, activePlatform === 'instagram' && styles.activeInstagram]} onPress={() => handleTabPress('instagram')}>
              <FontAwesome5 name="instagram" size={24} color={activePlatform === 'instagram' ? '#FFF' : '#A78BFA'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.platformBtn, activePlatform === 'x' && styles.activeX]} onPress={() => handleTabPress('x')}>
              <Text style={[styles.xLogoText, { color: activePlatform === 'x' ? '#FFF' : '#A78BFA' }]}>𝕏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.platformBtn, activePlatform === 'tiktok' && styles.activeTiktok]} onPress={() => handleTabPress('tiktok')}>
              <FontAwesome5 name="tiktok" size={24} color={activePlatform === 'tiktok' ? '#FFF' : '#25F4EE'} />
            </TouchableOpacity>
          </View>

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

          {url.length > 5 && !isLoadingInfo && !infoError && (
            <View style={styles.previewCard}>
              {videoInfo?.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.fallbackThumbnail}>
                  <FontAwesome5 name={activePlatform} size={36} color="#EC4899" />
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

          {url.length > 5 && (
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                activePlatform === 'instagram' && styles.btnInstagram,
                activePlatform === 'x' && styles.btnX,
                activePlatform === 'tiktok' && styles.btnTiktok,
                isDownloading && { opacity: 0.7 }
              ]}
              onPress={triggerDownloadProcess}
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
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showRewardModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>[ ÖDÜLLÜ İNDİRME AKTİF ]</Text>
            <Text style={styles.modalSubtitle}>
              {rewardReady ? "Ödülünüz hazır!" : `Reklam yükleniyor, lütfen ${rewardCountdown} saniye bekleyin...`}
            </Text>
            <TouchableOpacity style={[styles.modalBtn, !rewardReady && { backgroundColor: '#4B5563' }]} disabled={!rewardReady} onPress={executeDownload}>
              <Text style={styles.modalBtnText}>{rewardReady ? "İNDİR" : `BEKLENİYOR (${rewardCountdown}s)`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0518' },
  content: { flex: 1, zIndex: 1, marginBottom: 20 },
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoImage: { width: 48, height: 48, marginRight: 12 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  proBadge: { fontSize: 16, color: '#25F4EE', fontWeight: 'bold' },
  subtitle: { color: '#A78BFA', fontSize: 11, textAlign: 'center', marginBottom: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  proUpgradeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1033', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: '#FBBF24', marginBottom: 10, shadowColor: '#FBBF24', shadowOpacity: 0.4, shadowRadius: 10 },
  proUpgradeText: { color: '#FBBF24', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  restoreText: { color: '#8B5CF6', fontSize: 12, textDecorationLine: 'underline', fontWeight: 'bold' },

  platformSelector: { flexDirection: 'row', backgroundColor: '#170E33', borderRadius: 6, padding: 6, marginBottom: 24, width: '100%', justifyContent: 'space-between', borderWidth: 2, borderColor: '#4C1D95' },
  platformBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 4 },
  xLogoText: { fontSize: 24, fontWeight: '900' },
  activeInstagram: { backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#C4B5FD' },
  activeX: { backgroundColor: '#31104D', borderWidth: 2, borderColor: '#A78BFA' },
  activeTiktok: { backgroundColor: '#EC4899', borderWidth: 2, borderColor: '#F472B6' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#170E33', borderRadius: 8, borderWidth: 2, borderColor: '#4C1D95', marginBottom: 12, paddingHorizontal: 16, width: '100%' },
  clearBtn: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 16, color: '#F8FAFC', fontSize: 15 },
  pasteBtn: { padding: 10 },
  loadingInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingInfoText: { color: '#EC4899', marginLeft: 8, fontSize: 13, fontWeight: '700' },
  errorCard: { width: '100%', backgroundColor: '#2A121A', borderRadius: 6, borderWidth: 2, borderColor: '#EF4444', padding: 12, marginBottom: 20 },
  errorText: { color: '#FCA5A5', fontSize: 12 },
  previewCard: { width: '100%', backgroundColor: '#170E33', borderRadius: 8, padding: 14, borderWidth: 2, borderColor: '#8B5CF6', marginBottom: 20, alignItems: 'center' },
  thumbnail: { width: '100%', height: 140, borderRadius: 4, marginBottom: 12 },
  fallbackThumbnail: { width: '100%', height: 100, borderRadius: 4, marginBottom: 12, backgroundColor: '#110826', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#A78BFA', fontSize: 11, marginTop: 6 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  videoTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', flex: 1 },
  downloadBtn: { flexDirection: 'row', width: '100%', paddingVertical: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F472B6' },
  btnInstagram: { backgroundColor: '#7C3AED' },
  btnX: { backgroundColor: '#1F1033' },
  btnTiktok: { backgroundColor: '#DB2777' },
  downloadBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 5, 24, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 360, backgroundColor: '#170E33', borderRadius: 12, borderWidth: 2, borderColor: '#EC4899', padding: 24, alignItems: 'center' },
  modalTitle: { color: '#25F4EE', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  modalSubtitle: { color: '#A78BFA', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  modalBtn: { width: '100%', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#34D399' },
  modalBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }
});