import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Head>
        <title>BitSaver Pro - Instagram, TikTok ve X Video İndirici</title>
        <meta name="description" content=" Instagram, TikTok, X (Twitter) popüler platformlardan en yüksek kalitede video indirin. Hızlı, güvenli ve ücretsiz video downloader." />
        <meta name="keywords" content="video indirici, youtube video indir, instagram downloader, tiktok video indir, x video indir, bitsaver pro" />
      </Head>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#890d16' } }} />
    </>
  );
}