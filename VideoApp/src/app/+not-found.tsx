import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFound() {
  return (
    <View style={styles.c}>
      <Text style={styles.t}>Sayfa bulunamadı</Text>
      <Link href="/" style={styles.l}>Ana sayfaya dön</Link>
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0A0518', alignItems: 'center', justifyContent: 'center', gap: 12 },
  t: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  l: { color: '#A78BFA', fontSize: 15 },
});
