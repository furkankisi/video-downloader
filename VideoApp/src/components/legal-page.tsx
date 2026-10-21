import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export type Section = { heading: string; body: string[] };

export function LegalPage({ title, description, sections }: { title: string; description: string; sections: Section[] }) {
  return (
    <ScrollView style={styles.container}>
      <Head>
        <title>{`${title} - BitSaver Pro`}</title>
        <meta name="description" content={description} />
      </Head>
      <View style={styles.content}>
        <Link href="/" style={styles.back}>← Ana sayfa</Link>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>Son güncelleme: Ekim 2026</Text>
        {sections.map((sec) => (
          <View key={sec.heading}>
            <Text style={styles.heading}>{sec.heading}</Text>
            {sec.body.map((t, i) => (
              <Text key={i} style={styles.paragraph}>{t}</Text>
            ))}
          </View>
        ))}
        <View style={styles.links}>
          <Link href="/about" style={styles.link}>Hakkında</Link>
          <Link href="/privacy" style={styles.link}>Gizlilik</Link>
          <Link href="/terms" style={styles.link}>Kullanım Şartları</Link>
          <Link href="/contact" style={styles.link}>İletişim</Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0518', padding: 20 },
  content: { maxWidth: 800, alignSelf: 'center', width: '100%', paddingBottom: 60, paddingTop: 20 },
  back: { color: '#A78BFA', fontSize: 14, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  date: { fontSize: 14, color: '#aaa', marginBottom: 25 },
  heading: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 25, marginBottom: 10 },
  paragraph: { fontSize: 15, color: '#ccc', lineHeight: 24, marginBottom: 10 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 40 },
  link: { color: '#A78BFA', fontSize: 13 },
});
