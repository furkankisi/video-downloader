import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Head>
        <title>BitSaver Pro - Instagram, TikTok ve X Video İndirici</title>
        <meta name="description" content="Instagram, TikTok, X (Twitter) popüler platformlardan en yüksek kalitede video indirin. Hızlı, güvenli ve ücretsiz video downloader." />
        <meta name="keywords" content="video indirici, instagram downloader, tiktok video indir, x video indir, bitsaver pro" />
        
        {/* Google AdSense Kodu */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8754966775877680" crossOrigin="anonymous"></script>

        {/* Google Analytics (GA4) Kodu */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-4MZS9TCEG5"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-4MZS9TCEG5');
            `,
          }}
        />
      </Head>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#890d16' } }} />
    </>
  );
}