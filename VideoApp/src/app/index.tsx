import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';

export default function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('1080');
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const API_BASE = 'https://video-downloader-cvtw.onrender.com';

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      } else {
        Alert.alert("Bilgi", "Pano boş.");
      }
    } catch (error) {
      Alert.alert("Hata", "Panodan yazı okunamadı.");
    }
  };

  // 1. Adım: Videonun bilgilerini (resim ve başlık) getir
  const handleFetchInfo = async () => {
    if (!url) {
      Alert.alert("Eksik Link", "Lütfen bir video linki yapıştırın.");
      return;
    }

    setIsLoadingInfo(true);
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE}/get-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Video bilgileri alınamadı.");
      }

      setVideoInfo({
        title: data.title,
        thumbnail: data.thumbnail
      });

    } catch (error: any) {
      Alert.alert("Hata", error.message);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // 2. Adım: Seçilen kaliteyle videoyu indir
  const handleDownload = async () => {
    if (!url) return;

    setIsDownloading(true);

    try {
      const response = await fetch(`${API_BASE}/download-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, quality: selectedQuality }),
      });

      if (!response.ok) {
        throw new Error("Video indirilemedi.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `video_${selectedQuality}p_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      window.URL.revokeObjectURL(downloadUrl);
      Alert.alert("Başarılı! 🎉", "Video yüksek kalitede indirildi.");

    } catch (error: any) {
      Alert.alert("İşlem Başarısız", error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.ellipseTop} />
      <View style={styles.ellipseBottom} />

      <View style={styles.card}>
        <View style={styles.platformsContainer}>
          <View style={styles.platformBadge}><Text style={styles.platformText}>📸 Instagram</Text></View>
          <Text style={styles.arrowText}>➔</Text>
          <View style={styles.platformBadge}><Text style={styles.platformText}>🎵 TikTok</Text></View>
          <Text style={styles.arrowText}>➔</Text>
          <View style={styles.platformBadge}><Text style={styles.platformText}>▶️ YouTube</Text></View>
        </View>

        <Text style={styles.title}>Video İndirici</Text>
        <Text style={styles.subtitle}>Bağlantıyı yapıştır, önizlemeyi gör ve dilediğin kalitede indir.</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Video bağlantısını buraya yapıştırın..."
            placeholderTextColor="#64748b"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
            <Text style={styles.pasteButtonText}>📋 Yapıştır</Text>
          </TouchableOpacity>
        </View>

        {/* Videoyu Getir Butonu */}
        {!videoInfo && (
          <TouchableOpacity 
            style={[styles.button, isLoadingInfo && styles.buttonDisabled]} 
            onPress={handleFetchInfo}
            disabled={isLoadingInfo}
          >
            {isLoadingInfo ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Bilgiler Alınıyor...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Videoyu Getir 🔍</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Video Bilgileri ve Kalite Seçimi (Geldikten Sonra Görünür) */}
        {videoInfo && (
          <View style={styles.previewContainer}>
            <View style={styles.videoInfoBox}>
              <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} />
              <Text style={styles.videoTitle} numberOfLines={2}>{videoInfo.title}</Text>
            </View>

            <Text style={styles.qualityLabel}>Kalite Seçin:</Text>
            <View style={styles.qualityRow}>
              {['1080', '720', '480', 'best'].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, selectedQuality === q && styles.qualityBtnActive]}
                  onPress={() => setSelectedQuality(q)}
                >
                  <Text style={[styles.qualityText, selectedQuality === q && styles.qualityTextActive]}>
                    {q === 'best' ? 'En İyi' : `${q}p`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.button, isDownloading && styles.buttonDisabled]} 
              onPress={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>İndiriliyor...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Seçilen Kalitede İndir 🚀</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.resetBtn} 
              onPress={() => { setVideoInfo(null); setUrl(''); }}
            >
              <Text style={styles.resetText}>Başka Video İndir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090d16', padding: 20, overflow: 'hidden', position: 'relative' },
  ellipseTop: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: '#6366f1', opacity: 0.25, filter: 'blur(80px)' } as any,
  ellipseBottom: { position: 'absolute', bottom: -100, right: -100, width: 450, height: 450, borderRadius: 225, backgroundColor: '#ec4899', opacity: 0.2, filter: 'blur(90px)' } as any,
  card: { width: '100%', maxWidth: 500, backgroundColor: 'rgba(30, 41, 59, 0.75)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', padding: 35, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 15, backdropFilter: 'blur(16px)' } as any,
  platformsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
  platformBadge: { backgroundColor: 'rgba(15, 23, 42, 0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  platformText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  arrowText: { color: '#6366f1', fontSize: 14, fontWeight: 'bold' },
  title: { fontSize: 26, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#94a3b8', lineHeight: 18, marginBottom: 20, textAlign: 'center' },
  inputContainer: { position: 'relative', marginBottom: 15 },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 16, paddingRight: 95, borderRadius: 14, borderWidth: 1.5, borderColor: '#334155', color: '#fff', fontSize: 15 },
  pasteButton: { position: 'absolute', right: 8, top: 8, bottom: 8, backgroundColor: '#334155', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10 },
  pasteButtonText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: '#6366f1', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, marginTop: 5 },
  buttonDisabled: { backgroundColor: '#4338ca', opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  previewContainer: { marginTop: 10 },
  videoInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  thumbnail: { width: 75, height: 75, borderRadius: 8, backgroundColor: '#334155', marginRight: 12 },
  videoTitle: { flex: 1, color: '#f8fafc', fontSize: 14, fontWeight: '600', lineHeight: 18 },
  qualityLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  qualityRow: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  qualityBtn: { flex: 1, paddingVertical: 10, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  qualityBtnActive: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  qualityText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  qualityTextActive: { color: '#fff' },
  resetBtn: { marginTop: 12, alignItems: 'center' },
  resetText: { color: '#94a3b8', fontSize: 12, textDecorationLine: 'underline' }
});