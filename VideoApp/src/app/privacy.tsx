import { LegalPage } from '@/components/legal-page';

export default function Privacy() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      description="BitSaver Pro gizlilik politikası: hangi veriler işlenir, reklamlar ve abonelikler nasıl çalışır."
      sections={[
        { heading: '1. Genel', body: ['BitSaver Pro ("Uygulama"), kullanıcının girdiği bağlantıdaki videoyu cihazına indirmesine yardımcı olan bir araçtır. Hesap oluşturmanız gerekmez ve ad, e-posta gibi kişisel bilgilerinizi sizden talep etmeyiz.'] },
        { heading: '2. İşlenen veriler', body: [
          'Girdiğiniz video bağlantısı, indirme isteğini gerçekleştirmek için sunucumuza gönderilir ve işlem bittikten sonra geçici dosyalar silinir. Bağlantılarınızı kalıcı olarak saklamayız.',
          'Sunucu, teknik işleyiş için standart günlük kayıtları (IP adresi, zaman damgası, hata bilgisi) tutabilir.',
        ] },
        { heading: '3. Reklamlar', body: [
          'Mobil uygulamada Google AdMob, web sitesinde Google AdSense ile reklam gösterilir. Google ve ortakları, reklam sunmak ve ölçmek için çerezler, reklam kimlikleri ve benzeri teknolojiler kullanabilir. Avrupa Ekonomik Alanı, Birleşik Krallık ve ilgili diğer bölgelerde reklamlar için onayınız istenir ve tercihinizi dilediğiniz zaman değiştirebilirsiniz.',
          'Google\'ın verileri nasıl kullandığını https://policies.google.com/technologies/partner-sites adresinden öğrenebilir, kişiselleştirilmiş reklamları https://adssettings.google.com adresinden kapatabilirsiniz.',
        ] },
        { heading: '4. Abonelikler', body: ['Reklamsız kullanım için isteğe bağlı abonelik sunulabilir. Satın alma işlemleri Google Play / App Store tarafından yürütülür; abonelik durumunu doğrulamak için RevenueCat hizmeti kullanılır. Ödeme bilgileriniz bize ulaşmaz.'] },
        { heading: '5. Analiz', body: ['Web sitesinde kullanım istatistikleri için Google Analytics kullanılır. Bu veriler anonim ve toplu şekilde değerlendirilir.'] },
        { heading: '6. Galeri izni', body: ['İndirilen videoyu galerinize kaydetmek için yalnızca "ekleme" izni istenir. Galerinizdeki diğer içerikleri okumayız.'] },
        { heading: '7. Çocuklar', body: ['Uygulama 13 yaşından küçük çocuklara yönelik değildir ve onlardan bilerek veri toplamaz.'] },
        { heading: '8. İletişim ve haklarınız', body: ['Verilerinizle ilgili talepleriniz için furkankisi0@gmail.com adresine yazabilirsiniz.'] },
      ]}
    />
  );
}
