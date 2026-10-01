import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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