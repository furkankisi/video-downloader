import { LegalPage } from '@/components/legal-page';

export default function Terms() {
  return (
    <LegalPage
      title="Kullanım Şartları"
      description="BitSaver Pro kullanım şartları ve telif hakkı politikası."
      sections={[
        { heading: '1. Kabul', body: ['BitSaver Pro\'yu kullanarak bu şartları kabul etmiş olursunuz.'] },
        { heading: '2. İzin verilen kullanım', body: ['Hizmeti yalnızca kişisel kullanım için, kendinize ait veya indirme izniniz olan içerikler için kullanabilirsiniz. Başkalarının telifli içeriklerini izinsiz çoğaltmak, dağıtmak veya ticari amaçla kullanmak yasaktır; bundan doğan tüm sorumluluk kullanıcıya aittir.'] },
        { heading: '3. Yasak kullanım', body: ['Hizmeti otomatik toplu indirme, hesap ihlali, özel içeriklere erişme veya yasa dışı faaliyetler için kullanamazsınız.'] },
        { heading: '4. Telif hakkı bildirimleri (DMCA)', body: ['Bir içeriğin telif hakkınızı ihlal ettiğini düşünüyorsanız furkankisi0@gmail.com adresine içeriğin bağlantısı ve hak sahipliğinizi gösteren bilgilerle başvurun. Geçerli başvurular makul sürede incelenir ve gerekli işlem yapılır.'] },
        { heading: '5. Sorumluluk reddi', body: ['Hizmet "olduğu gibi" sunulur. Üçüncü taraf platformlardaki değişiklikler nedeniyle indirme işlemi her zaman çalışmayabilir.'] },
        { heading: '6. Abonelik', body: ['İsteğe bağlı abonelik, satın alındığı mağaza (Google Play / App Store) üzerinden yönetilir ve iptal edilir.'] },
      ]}
    />
  );
}
