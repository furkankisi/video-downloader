import { LegalPage } from '@/components/legal-page';

export default function Contact() {
  return (
    <LegalPage
      title="İletişim"
      description="BitSaver Pro ile iletişime geçin."
      sections={[
        { heading: 'Bize ulaşın', body: ['Soru, geri bildirim, gizlilik talebi veya telif hakkı bildirimi için: furkankisi0@gmail.com', 'Mesajlara genellikle birkaç iş günü içinde yanıt veririz.'] },
      ]}
    />
  );
}
