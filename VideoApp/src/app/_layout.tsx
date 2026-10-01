import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  // Google Analytics (GA4) Web Entegrasyonu
  useEffect(() => {
    if (Platform.OS === 'web') {
      const measurementId = 'G-4MZS9TCEG5';

      if (measurementId && !document.getElementById('ga-script')) {
        // 1. Google Analytics ana script'i
        const script1 = document.createElement('script');
        script1.id = 'ga-script';
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script1);

        // 2. Yapılandırma script'i
        const script2 = document.createElement('script');
        script2.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `;
        document.head.appendChild(script2);
      }
    }
  }, []);

  return (
    <>
      <Head>
        <title>BitSaver Pro - YouTube, Instagram, TikTok ve X Video İndirici</title>
        <meta name="description" content="YouTube, Instagram, TikTok, X (Twitter) ve diğer popüler platformlardan en yüksek kalitede video indirin. Hızlı, güvenli ve ücretsiz video downloader." />
        <meta name="keywords" content="video indirici, youtube video indir, instagram downloader, tiktok video indir, x video indir, bitsaver pro" />
        
        {/* Google AdSense Kodu */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8754966775877680" crossOrigin="anonymous"></script>
      </Head>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#890d16' } }} />
    </>
  );
}