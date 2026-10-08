import { StyleSheet, Text, View, ScrollView } from 'react-native';
import Head from 'expo-router/head';

export default function PrivacyPolicy() {
  return (
    <ScrollView style={styles.container}>
      <Head>
        <title>Gizlilik Politikası - BitSaver Pro</title>
      </Head>
      <View style={styles.content}>
        <Text style={styles.title}>Gizlilik Politikası</Text>
        <Text style={styles.date}>Son güncellenme tarihi: Ekim 2026</Text>
        
        <Text style={styles.paragraph}>
          BitSaver Pro ("Uygulama") kullanıcılarının gizliliğine ve veri güvenliğine büyük önem verir. Bu gizlilik politikası, uygulamamızı ve web sitemizi kullandığınızda hangi bilgilerin işlendiğini açıklar.
        </Text>

        <Text style={styles.heading}>1. Toplanan Veriler</Text>
        <Text style={styles.paragraph}>
          BitSaver Pro, video indirme işlemlerini doğrudan cihazınızda veya güvenli altyapılar üzerinden gerçekleştirir. Kişisel verilerinizi sunucularımızda kalıcı olarak depolamaz. Hizmet kalitesini artırmak amacıyla Google Analytics ve Google AdSense gibi standart üçüncü taraf analiz/reklam araçları anonim veriler toplayabilir.
        </Text>

        <Text style={styles.heading}>2. Reklamlar ve Çerezler</Text>
        <Text style={styles.paragraph}>
          Uygulamamızda ve web sitemizde Google AdSense aracılığıyla reklamlar gösterilmektedir. Google, kullanıcıların web sitenize veya diğer sitelere yaptığı önceki ziyaretlere dayalı olarak reklam sunmak için çerezleri kullanır.
        </Text>

        <Text style={styles.heading}>3. Çocukların Gizliliği</Text>
        <Text style={styles.paragraph}>
          Uygulamamız 13 yaş altındaki çocukları bilerek hedeflemez ve onlardan bilerek kişisel bilgi toplamaz.
        </Text>

        <Text style={styles.heading}>4. İletişim</Text>
        <Text style={styles.paragraph}>
          Gizlilik politikamızla ilgili her türlü soru ve öneriniz için bizimle iletişime geçebilirsiniz.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0518', padding: 20 },
  content: { maxWidth: 800, alignSelf: 'center', width: '100%', paddingBottom: 60, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  date: { fontSize: 14, color: '#aaa', marginBottom: 25 },
  heading: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 25, marginBottom: 10 },
  paragraph: { fontSize: 15, color: '#ccc', lineHeight: 24, marginBottom: 10 },
});