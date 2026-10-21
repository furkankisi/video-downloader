import { LegalPage } from '@/components/legal-page';

export default function About() {
  return (
    <LegalPage
      title="Hakkında"
      description="BitSaver Pro nedir, nasıl çalışır ve nasıl sorumlu kullanılır."
      sections={[
        { heading: 'BitSaver Pro nedir?', body: ['BitSaver Pro, Instagram, TikTok ve X (Twitter) üzerindeki herkese açık video bağlantılarını yapıştırarak videoyu cihazınıza kaydetmenizi sağlayan ücretsiz bir araçtır.'] },
        { heading: 'Nasıl kullanılır?', body: [
          '1. Videonun bağlantısını platformdan kopyalayın.',
          '2. Bağlantıyı uygulamadaki alana yapıştırın; video başlığı ve önizlemesi otomatik görünür.',
          '3. "İndir" düğmesine dokunun. Mobilde video galerinize, web\'de tarayıcınızın indirilenler klasörüne kaydedilir.',
        ] },
        { heading: 'Sorumlu kullanım', body: ['Yalnızca kendinize ait olan veya indirme izniniz bulunan içerikleri indirin. İndirilen içeriklerin telif hakları ilgili hak sahiplerine aittir; izinsiz paylaşım, yeniden yükleme veya ticari kullanım yasaktır. Özel hesaplardaki içerikler indirilemez.'] },
        { heading: 'Bağlantı', body: ['BitSaver Pro; Instagram, TikTok veya X ile bağlantılı, onlar tarafından onaylanmış ya da desteklenen bir hizmet değildir. Tüm marka adları ilgili sahiplerine aittir.'] },
      ]}
    />
  );
}
