import React from 'react';
import { View, Text } from 'react-native';
import Constants from 'expo-constants';

export default function AdBanner() {
  // Expo Go ortamında reklam yerine bilgilendirme göster.
  if (Constants.appOwnership === 'expo') {
    return (
      <View style={{ padding: 8, alignItems: 'center' }}>
        <Text style={{ color: '#A78BFA', fontSize: 10 }}>
          [ ADMOB BANNER - TEST MODE ]
        </Text>
      </View>
    );
  }

  try {
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');

    return (
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0518',
        }}
      >
        <BannerAd
          unitId="ca-app-pub-8754966775877680/7883219165"
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  } catch {
    return null;
  }
}
