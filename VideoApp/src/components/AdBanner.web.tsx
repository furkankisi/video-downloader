import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

export default function AdBanner() {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.log('Adsense banner yüklenirken hata:', e);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-8754966775877680"
        data-ad-slot="4753170122"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
});