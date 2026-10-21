import React from 'react';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-8754966775877680/7883219165';

type Props = { onLoaded: () => void; onFailed: () => void };

export default function AdBanner({ onLoaded, onFailed }: Props) {
  return (
    <BannerAd
      unitId={UNIT_ID}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdLoaded={onLoaded}
      onAdFailedToLoad={onFailed}
    />
  );
}
