import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PlanId = 'annual' | 'monthly';

/** Mağazadaki ücretsiz deneme süresini okur ("3 gün" gibi). Deneme yoksa null döner. */
export function getTrialLabel(pkg: any): string | null {
  const ip = pkg?.product?.introPrice;
  let unit: string | undefined;
  let n: number | undefined;
  if (ip && Number(ip.price) === 0) {
    unit = ip.periodUnit;
    n = ip.periodNumberOfUnits;
  } else {
    const free = pkg?.product?.defaultOption?.freePhase?.billingPeriod;
    if (free) {
      unit = free.unit;
      n = free.value;
    }
  }
  if (!unit || !n) return null;
  switch (String(unit).toUpperCase()) {
    case 'DAY': return `${n} gün`;
    case 'WEEK': return `${n * 7} gün`;
    case 'MONTH': return `${n} ay`;
    case 'YEAR': return `${n} yıl`;
    default: return null;
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  monthly: any | null;
  annual: any | null;
  selected: PlanId;
  onSelect: (p: PlanId) => void;
  onPurchase: () => void;
  onRestore: () => void;
  purchasing: boolean;
};

export function PaywallSheet({ visible, onClose, monthly, annual, selected, onSelect, onPurchase, onRestore, purchasing }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const selectedPkg = selected === 'annual' ? annual : monthly;
  const trial = getTrialLabel(selectedPkg);

  // "2 ay bedava": yıllık fiyat, 12 aylık toplam ile karşılaştırılarak hesaplanır
  const monthsFree =
    monthly && annual && monthly.product.price > 0
      ? Math.round(12 - annual.product.price / monthly.product.price)
      : 0;

  const go = (path: '/privacy' | '/terms') => {
    onClose();
    setTimeout(() => router.push(path), 250);
  };

  const renewalText = selectedPkg
    ? `${trial ? `${trial} ücretsiz deneme sonrasında ` : ''}${selectedPkg.product.priceString} / ${selected === 'annual' ? 'yıl' : 'ay'} tutarında ücretlendirilirsiniz. Abonelik, dönem bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenir. İstediğiniz zaman Google Play veya App Store hesap ayarlarınızdan iptal edebilirsiniz.`
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Ionicons name="star" size={30} color="#FBBF24" style={{ alignSelf: 'center', marginBottom: 6 }} />
            <Text style={styles.title}>REKLAMLARI KALDIR</Text>
            <Text style={styles.subtitle}>BitSaver PRO ile kesintisiz, reklamsız indir.</Text>

            <View style={styles.features}>
              {['Banner ve ödüllü reklamlar tamamen kalkar', 'Reklam izlemeden tek dokunuşla indir', 'İstediğin zaman iptal et'].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {annual && (
              <TouchableOpacity style={[styles.plan, selected === 'annual' && styles.planActive]} onPress={() => onSelect('annual')} activeOpacity={0.85}>
                {monthsFree >= 1 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{monthsFree} AY BEDAVA</Text></View>
                )}
                <View style={styles.radio}>{selected === 'annual' && <View style={styles.radioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>Yıllık</Text>
                  {!!annual.product.pricePerMonthString && (
                    <Text style={styles.planSub}>ayda sadece {annual.product.pricePerMonthString}</Text>
                  )}
                </View>
                <Text style={styles.planPrice}>{annual.product.priceString}<Text style={styles.planPeriod}> / yıl</Text></Text>
              </TouchableOpacity>
            )}

            {monthly && (
              <TouchableOpacity style={[styles.plan, selected === 'monthly' && styles.planActive]} onPress={() => onSelect('monthly')} activeOpacity={0.85}>
                <View style={styles.radio}>{selected === 'monthly' && <View style={styles.radioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>Aylık</Text>
                </View>
                <Text style={styles.planPrice}>{monthly.product.priceString}<Text style={styles.planPeriod}> / ay</Text></Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.cta, purchasing && { opacity: 0.7 }]} onPress={onPurchase} disabled={purchasing || !selectedPkg}>
              {purchasing ? (
                <ActivityIndicator color="#0A0518" />
              ) : (
                <Text style={styles.ctaText}>{trial ? `${trial.toUpperCase()} ÜCRETSİZ DENE` : 'ABONE OL'}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.legal}>{renewalText}</Text>

            <View style={styles.linksRow}>
              <TouchableOpacity onPress={onRestore}><Text style={styles.link}>Satın alımları geri yükle</Text></TouchableOpacity>
              <Text style={styles.dot}>•</Text>
              <TouchableOpacity onPress={() => go('/terms')}><Text style={styles.link}>Şartlar</Text></TouchableOpacity>
              <Text style={styles.dot}>•</Text>
              <TouchableOpacity onPress={() => go('/privacy')}><Text style={styles.link}>Gizlilik</Text></TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={styles.later}>Şimdi değil</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#140A28', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%', borderTopWidth: 2, borderColor: '#FBBF24' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#4B5563', marginBottom: 10 },
  closeBtn: { position: 'absolute', right: 14, top: 12, zIndex: 2, padding: 4 },
  title: { color: '#FBBF24', fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  subtitle: { color: '#D1D5DB', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  features: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: '#E5E7EB', fontSize: 14, flex: 1 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#374151', borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: '#1F1033' },
  planActive: { borderColor: '#FBBF24', backgroundColor: '#2A1744' },
  badge: { position: 'absolute', top: -11, right: 12, backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { color: '#04130D', fontSize: 11, fontWeight: '900' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FBBF24' },
  planName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  planSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  planPrice: { color: '#fff', fontSize: 16, fontWeight: '800' },
  planPeriod: { color: '#9CA3AF', fontSize: 12, fontWeight: '400' },
  cta: { backgroundColor: '#FBBF24', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  ctaText: { color: '#0A0518', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  legal: { color: '#9CA3AF', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
  linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  link: { color: '#A78BFA', fontSize: 12 },
  dot: { color: '#4B5563' },
  later: { color: '#6B7280', fontSize: 13 },
});
