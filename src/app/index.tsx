
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';

import AdBanner from '../components/AdBanner';
import { createRewardedDownloadAd } from '../components/RewardedDownloadAd';

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://video-downloader-cvtw.onrender.com'
).replace(/\/$/, '');

const INFO_TIMEOUT_MS = 70000;

const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
const RC_ENTITLEMENT = 'pro_access';

type Platform_ = 'instagram' | 'x' | 'tiktok';

const PLATFORM_LABELS: Record<Platform_, string> = {
  instagram: 'Instagram',
  x: 'X (Twitter)',
  tiktok: 'TikTok',
};

const extractUrl = (text: string): string => {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[).,;]+$/, '') : text.trim();
};

const detectPlatform = (
  text: string,
  fallback: Platform_,
): Platform_ => {
  const value = text.toLowerCase();

  if (
    value.includes('instagram.com') ||
    value.includes('instagr.am')
  ) {
    return 'instagram';
  }

  if (
    value.includes('twitter.com') ||
    value.includes('x.com') ||
    value.includes('t.co/')
  ) {
    return 'x';
  }

  if (value.includes('tiktok.com')) {
    return 'tiktok';
  }

  return fallback;
};

const readError = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const json = await response.json();

    if (typeof json?.detail === 'string') {
      return json.detail;
    }
  } catch {}

  return fallback;
};

export default function App() {
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [activePlatform, setActivePlatform] =
    useState<Platform_>('instagram');

  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAdFree, setIsAdFree] = useState(false);
  const [currentOffering, setCurrentOffering] = useState<any>(null);

  const executeDownloadRef = useRef<() => void>(() => {});
  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  const rewardedAdRef = useRef<any>(null);

  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    thumbnail: string;
  } | null>(null);

  const [infoError, setInfoError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // RevenueCat: yalnızca mobil uygulamada çalışır.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const setupRevenueCat = async () => {
      const apiKey =
        Platform.OS === 'android' ? RC_ANDROID_KEY : RC_IOS_KEY;

      if (!apiKey || apiKey.startsWith('test_')) return;

      try {
        const Purchases = require('react-native-purchases').default;

        Purchases.configure({ apiKey });

        const customerInfo = await Purchases.getCustomerInfo();

        if (customerInfo.entitlements.active[RC_ENTITLEMENT]) {
          setIsAdFree(true);
        }

        const offerings = await Purchases.getOfferings();

        if (offerings.current) {
          setCurrentOffering(offerings.current);
        }
      } catch (error) {
        console.log('RevenueCat hatası:', error);
      }
    };

    setupRevenueCat();
  }, []);

  const getPurchases = () => {
    if (Platform.OS === 'web') return null;

    try {
      return require('react-native-purchases').default;
    } catch {
      return null;
    }
  };

  const buyAdFreeVersion = async () => {
    const Purchases = getPurchases();

    const pkg =
      currentOffering?.monthly ??
      currentOffering?.availablePackages?.[0];

    if (!Purchases || !pkg) {
      Alert.alert(
        'Paketler Yüklenemedi',
        'Lütfen daha sonra tekrar deneyin.',
      );
      return;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (customerInfo.entitlements.active[RC_ENTITLEMENT]) {
        setIsAdFree(true);
        Alert.alert(
          'Teşekkürler!',
          'Reklamsız deneyimin tadını çıkar.',
        );
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert('Hata', 'Abonelik işlemi tamamlanamadı.');
      }
    }
  };

  const restorePurchases = async () => {
    const Purchases = getPurchases();
    if (!Purchases) return;

    try {
      const customerInfo = await Purchases.restorePurchases();

      if (customerInfo.entitlements.active[RC_ENTITLEMENT]) {
        setIsAdFree(true);
        Alert.alert('Başarılı', 'Aboneliğiniz geri yüklendi!');
      } else {
        Alert.alert(
          'Bilgi',
          'Aktif bir aboneliğiniz bulunamadı.',
        );
      }
    } catch {
      Alert.alert(
        'Hata',
        'Geri yükleme işlemi başarısız oldu.',
      );
    }
  };

  // Ödüllü reklam yalnızca mobil platformda yüklenir.
  useEffect(() => {
    if (Platform.OS === 'web' || isAdFree) {
      rewardedAdRef.current = null;
      setRewardedLoaded(false);
      return;
    }

    let ad: any = null;

    try {
      ad = createRewardedDownloadAd({
        onLoaded: () => setRewardedLoaded(true),

        onEarned: () => {
          executeDownloadRef.current();
        },

        onClosed: () => {
          setRewardedLoaded(false);
        },

        onError: () => {
          setRewardedLoaded(false);
        },
      });

      rewardedAdRef.current = ad;
    } catch (error) {
      console.log('Ödüllü reklam başlatılamadı:', error);
    }

    return () => {
      if (ad?.cleanup) ad.cleanup();
      rewardedAdRef.current = null;
      setRewardedLoaded(false);
    };
  }, [isAdFree]);

  const handleTabPress = (targetPlatform: Platform_) => {
    if (url.trim().length > 0) {
      const linkPlatform = detectPlatform(url, activePlatform);

      if (targetPlatform !== linkPlatform) {
        Alert.alert(
          'İşlem Engellendi',
          `Bu link bir ${PLATFORM_LABELS[linkPlatform]} linkidir.`,
        );
        return;
      }
    }

    setActivePlatform(targetPlatform);
  };

  const fetchInfo = async (
    link: string,
    platform: Platform_,
    reqId: number,
  ) => {
    setIsLoadingInfo(true);
    setInfoError(null);

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      INFO_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `${API_BASE}/info-${platform}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link }),
          signal: controller.signal,
        },
      );

      if (reqId !== requestIdRef.current) return;

      if (response.ok) {
        setVideoInfo(await response.json());
      } else {
        setInfoError(
          await readError(response, 'Video bilgisi alınamadı.'),
        );
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setInfoError('Sunucuya ulaşılamadı.');
    } finally {
      clearTimeout(timer);

      if (reqId === requestIdRef.current) {
        setIsLoadingInfo(false);
      }
    }
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    setVideoInfo(null);
    setInfoError(null);
    setDownloadError(null);
    setDownloadSuccess(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    requestIdRef.current += 1;
    const reqId = requestIdRef.current;

    if (!/https?:\/\/\S{6,}/i.test(text)) {
      setIsLoadingInfo(false);
      return;
    }

    const link = extractUrl(text);
    const detected = detectPlatform(link, activePlatform);

    if (detected !== activePlatform) {
      setActivePlatform(detected);
    }

    debounceRef.current = setTimeout(
      () => fetchInfo(link, detected, reqId),
      600,
    );
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) handleUrlChange(text);
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    requestIdRef.current += 1;
    setUrl('');
    setVideoInfo(null);
    setInfoError(null);
    setDownloadError(null);
    setDownloadSuccess(false);
    setIsLoadingInfo(false);
  };

  const triggerDownloadProcess = () => {
    if (
      Platform.OS !== 'web' &&
      !isAdFree &&
      rewardedAdRef.current &&
      rewardedLoaded
    ) {
      try {
        rewardedAdRef.current.show();
        return;
      } catch (error) {
        console.log('Reklam gösterilemedi:', error);
      }
    }

    // Web'de reklam yoktur; indirme doğrudan başlar.
    // Reklam yüklenmemişse mobilde de indirme engellenmez.
    executeDownload();
  };

  const executeDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const link = extractUrl(url);
      const platform = detectPlatform(link, activePlatform);
      const filename = `${platform}_video_${Date.now()}.mp4`;

      if (Platform.OS === 'web') {
        const response = await fetch(
          `${API_BASE}/download-${platform}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: link }),
          },
        );

        if (!response.ok) {
          throw new Error(
            await readError(response, 'İndirme başarısız.'),
          );
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = downloadUrl;
        anchor.download = filename;

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        window.URL.revokeObjectURL(downloadUrl);

        setDownloadSuccess(true);
        return;
      }

      const MediaLibrary: typeof import('expo-media-library') =
        require('expo-media-library');

      const permission =
        await MediaLibrary.requestPermissionsAsync(true);

      if (!permission.granted) {
        throw new Error(
          'Galeriye kaydetmek için izin vermelisiniz.',
        );
      }

      const endpoint =
        `${API_BASE}/download-${platform}` +
        `?url=${encodeURIComponent(link)}`;

      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const result = await FileSystem
        .createDownloadResumable(endpoint, fileUri)
        .downloadAsync();

      if (!result || result.status !== 200) {
        let message = 'Video indirilemedi.';

        if (result) {
          try {
            const json = JSON.parse(
              await FileSystem.readAsStringAsync(result.uri),
            );

            if (typeof json?.detail === 'string') {
              message = json.detail;
            }
          } catch {}

          await FileSystem.deleteAsync(result.uri, {
            idempotent: true,
          });
        }

        throw new Error(message);
      }

      await MediaLibrary.saveToLibraryAsync(result.uri);

      await FileSystem.deleteAsync(result.uri, {
        idempotent: true,
      });

      Alert.alert(
        'Başarılı',
        'Video başarıyla galeriye kaydedildi! 📱',
      );

      setDownloadSuccess(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'İndirme başarısız.';

      setDownloadError(message);

      if (Platform.OS !== 'web') {
        Alert.alert('Hata', message);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  executeDownloadRef.current = executeDownload;

  const platformLabel = PLATFORM_LABELS[activePlatform];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Image
              source={require('../assets/images/pixel-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              BitSaver <Text style={styles.proBadge}>PRO</Text>
            </Text>
          </View>

          <Text style={styles.subtitle}>
            [ RETRO BIT-DOWNLOAD SYSTEM v2.0 ]
          </Text>

          {Platform.OS !== 'web' &&
            !isAdFree &&
            !!currentOffering && (
              <View style={styles.upgradeContainer}>
                <TouchableOpacity
                  style={styles.proUpgradeBtn}
                  onPress={buyAdFreeVersion}
                >
                  <Ionicons
                    name="star"
                    size={16}
                    color="#FBBF24"
                    style={{ marginRight: 6 }}
                  />

                  <Text style={styles.proUpgradeText}>
                    REKLAMLARI KALDIR [ PRO ]
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={restorePurchases}>
                  <Text style={styles.restoreText}>
                    Satın Alımları Geri Yükle
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          <View style={styles.platformSelector}>
            <TouchableOpacity
              style={[
                styles.platformBtn,
                activePlatform === 'instagram' &&
                  styles.activeInstagram,
              ]}
              onPress={() => handleTabPress('instagram')}
            >
              <FontAwesome5
                name="instagram"
                size={24}
                color={
                  activePlatform === 'instagram'
                    ? '#FFF'
                    : '#A78BFA'
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.platformBtn,
                activePlatform === 'x' && styles.activeX,
              ]}
              onPress={() => handleTabPress('x')}
            >
              <Text
                style={[
                  styles.xLogoText,
                  {
                    color:
                      activePlatform === 'x' ? '#FFF' : '#A78BFA',
                  },
                ]}
              >
                𝕏
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.platformBtn,
                activePlatform === 'tiktok' && styles.activeTiktok,
              ]}
              onPress={() => handleTabPress('tiktok')}
            >
              <FontAwesome5
                name="tiktok"
                size={24}
                color={
                  activePlatform === 'tiktok' ? '#FFF' : '#25F4EE'
                }
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            {url.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClear}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color="#EF4444"
                />
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

            <TouchableOpacity
              style={styles.pasteBtn}
              onPress={handlePaste}
              disabled={isDownloading}
            >
              <Ionicons
                name="clipboard-outline"
                size={22}
                color="#EC4899"
              />
            </TouchableOpacity>
          </View>

          {isLoadingInfo && (
            <View style={styles.loadingInfoContainer}>
              <ActivityIndicator color="#EC4899" size="small" />
              <Text style={styles.loadingInfoText}>
                [ BIT SCANNING... ]
              </Text>
            </View>
          )}

          {infoError && !isLoadingInfo && (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle"
                size={20}
                color="#EF4444"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.errorText}>{infoError}</Text>
            </View>
          )}

          {url.length > 5 && !isLoadingInfo && !infoError && (
            <View style={styles.previewCard}>
              {videoInfo?.thumbnail ? (
                <Image
                  source={{ uri: videoInfo.thumbnail }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.fallbackThumbnail}>
                  <FontAwesome5
                    name={activePlatform}
                    size={36}
                    color="#EC4899"
                  />
                  <Text style={styles.fallbackText}>
                    [ {platformLabel} DATA ]
                  </Text>
                </View>
              )}

              <View style={styles.titleContainer}>
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color="#10B981"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoInfo?.title ||
                    `${platformLabel} Verisi Hazır`}
                </Text>
              </View>
            </View>
          )}

          {url.length > 5 && (
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                activePlatform === 'instagram' &&
                  styles.btnInstagram,
                activePlatform === 'x' && styles.btnX,
                activePlatform === 'tiktok' && styles.btnTiktok,
                isDownloading && { opacity: 0.7 },
              ]}
              onPress={triggerDownloadProcess}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.downloadBtnText}>
                    İNDİRİLİYOR...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="cloud-download-outline"
                    size={22}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.downloadBtnText}>
                    VİDEOYU İNDİR [RETRO]
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {downloadError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{downloadError}</Text>
            </View>
          )}

          {downloadSuccess && (
            <View style={styles.successCard}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#10B981"
              />
              <Text style={styles.successText}>
                İndirme işlemi tamamlandı.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => router.push('/about')}>
          <Text style={styles.footerLink}>Hakkında</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/privacy')}>
          <Text style={styles.footerLink}>Gizlilik</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/terms')}>
          <Text style={styles.footerLink}>Kullanım Şartları</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/contact')}>
          <Text style={styles.footerLink}>İletişim</Text>
        </TouchableOpacity>
      </View>

      {/* Banner reklam yalnızca Android/iOS'ta bulunur. */}
      {Platform.OS !== 'web' && !isAdFree && <AdBanner />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0518',
  },

  content: {
    flex: 1,
    zIndex: 1,
    marginBottom: 0,
  },

  scrollArea: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  logoImage: {
    width: 48,
    height: 48,
    marginRight: 12,
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  proBadge: {
    fontSize: 16,
    color: '#25F4EE',
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#A78BFA',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  upgradeContainer: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },

  proUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1033',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FBBF24',
    marginBottom: 10,
    shadowColor: '#FBBF24',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  proUpgradeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  restoreText: {
    color: '#8B5CF6',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },

  platformSelector: {
    flexDirection: 'row',
    backgroundColor: '#170E33',
    borderRadius: 6,
    padding: 6,
    marginBottom: 24,
    width: '100%',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#4C1D95',
  },

  platformBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 4,
  },

  xLogoText: {
    fontSize: 24,
    fontWeight: '900',
  },

  activeInstagram: {
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#C4B5FD',
  },

  activeX: {
    backgroundColor: '#31104D',
    borderWidth: 2,
    borderColor: '#A78BFA',
  },

  activeTiktok: {
    backgroundColor: '#EC4899',
    borderWidth: 2,
    borderColor: '#F472B6',
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#170E33',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4C1D95',
    marginBottom: 12,
    paddingHorizontal: 16,
    width: '100%',
  },

  clearBtn: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    paddingVertical: 16,
    color: '#F8FAFC',
    fontSize: 15,
  },

  pasteBtn: {
    padding: 10,
  },

  loadingInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  loadingInfoText: {
    color: '#EC4899',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
  },

  errorCard: {
    width: '100%',
    backgroundColor: '#2A121A',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#EF4444',
    padding: 12,
    marginBottom: 20,
  },

  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
  },

  successCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10251F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 12,
    marginTop: 16,
  },

  successText: {
    color: '#A7F3D0',
    fontSize: 12,
  },

  previewCard: {
    width: '100%',
    backgroundColor: '#170E33',
    borderRadius: 8,
    padding: 14,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    marginBottom: 20,
    alignItems: 'center',
  },

  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 4,
    marginBottom: 12,
  },

  fallbackThumbnail: {
    width: '100%',
    height: 100,
    borderRadius: 4,
    marginBottom: 12,
    backgroundColor: '#110826',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fallbackText: {
    color: '#A78BFA',
    fontSize: 11,
    marginTop: 6,
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  videoTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  downloadBtn: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F472B6',
  },

  btnInstagram: {
    backgroundColor: '#7C3AED',
  },

  btnX: {
    backgroundColor: '#1F1033',
  },

  btnTiktok: {
    backgroundColor: '#DB2777',
  },

  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },

  footerLink: {
    color: '#A78BFA',
    fontSize: 12,
  },
});
