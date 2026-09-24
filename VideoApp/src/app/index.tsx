import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string } | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // const API_BASE = 'http://127.0.0.1:8000'; // BUNU SİL VEYA YORUMA AL
const API_BASE = 'https://video-downloader-cvtw.onrender.com'; // CANLI RENDER ADRESİN

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setUrl(text);
    } catch (error) {
      Alert.alert("Hata", "Panodan kopyalanamadı.");
    }
  };

  const handleFetchInfo = async () => {
    if (!url) return Alert.alert("Hata", "Lütfen bir link girin.");
    
    setIsLoadingInfo(true);
    setVideoInfo(null);
    
    try {
      const response = await fetch(`${API_BASE}/get-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Video bulunamadı.");
      
      setVideoInfo({ title: data.title, thumbnail: data.thumbnail });
    } catch (error: any) {
      Alert.alert("Hata", error.message);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    setIsDownloading(true);

    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`${API_BASE}/download-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        });
        
        if (!response.ok) throw new Error("İndirme başarısız.");
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `video_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        const dir = (FileSystem as any).documentDirectory || 'file:///var/mobile/';
        const fileUri = `${dir}video_${Date.now()}.mp4`;

        const downloadOptions: any = {
          httpMethod: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        };

        const downloadResumable = FileSystem.createDownloadResumable(
          `${API_BASE}/download-video`,
          fileUri,
          downloadOptions
        );

        const result = await downloadResumable.downloadAsync();
        
        // --- İŞTE HAYAT KURTARAN YENİ KONTROL ---
        // Sunucudan başarılı video gelmediyse, inen sahte bozuk dosyayı sil ve hata ver
        if (result && result.status !== 200) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new Error("Instagram videoyu vermedi veya link hatalı.");
        }
        // -----------------------------------------

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
      <View style={styles.card}>
        <Text style={styles.title}>Video İndirici</Text>
        <Text style={styles.subtitle}>Bağlantıyı yapıştır, önizlemeyi gör ve tek tıkla en yüksek kalitede indir.</Text>

        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Video bağlantısını yapıştır..." 
            placeholderTextColor="#94a3b8"
            value={url}
            onChangeText={setUrl}
          />
          <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
            <Text style={styles.pasteButtonText}>Yapıştır</Text>
          </TouchableOpacity>
        </View>

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

        {videoInfo && (
          <View style={styles.previewContainer}>
            <View style={styles.videoInfoBox}>
              {videoInfo.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} />
              ) : null}
              <Text style={styles.videoTitle} numberOfLines={2}>{videoInfo.title}</Text>
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
                <Text style={styles.buttonText}>En Yüksek Kalitede İndir 🚀</Text>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090d16', padding: 20 },
  card: { width: '100%', maxWidth: 500, backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
  inputContainer: { position: 'relative', marginBottom: 15 },
  input: { backgroundColor: '#0f172a', color: '#fff', padding: 15, paddingRight: 80, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  pasteButton: { position: 'absolute', right: 5, top: 5, bottom: 5, backgroundColor: '#334155', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 8 },
  pasteButtonText: { color: '#fff', fontWeight: 'bold' },
  button: { backgroundColor: '#6366f1', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  previewContainer: { marginTop: 10 },
  videoInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 10, borderRadius: 10, marginBottom: 15 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 10, backgroundColor: '#334155' },
  videoTitle: { flex: 1, color: '#fff', fontSize: 14 },
  resetBtn: { marginTop: 15, alignItems: 'center' },
  resetText: { color: '#94a3b8', textDecorationLine: 'underline' }
});