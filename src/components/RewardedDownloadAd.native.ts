export function createRewardedDownloadAd({
  onLoaded,
  onEarned,
  onClosed,
  onError,
}: {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
  onError: () => void;
}) {
  try {
    const {
      RewardedAd,
      RewardedAdEventType,
      AdEventType,
      TestIds,
    } = require('react-native-google-mobile-ads');

    const adUnitId = __DEV__
      ? TestIds.REWARDED
      : 'ca-app-pub-8754966775877680/2878129487';

    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribe = [
      rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        onLoaded,
      ),
      rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        onEarned,
      ),
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        onClosed();
        rewarded.load();
      }),
      rewarded.addAdEventListener(AdEventType.ERROR, onError),
    ];

    rewarded.load();

    return {
      show: () => rewarded.show(),
      cleanup: () => unsubscribe.forEach((remove: () => void) => remove()),
    };
  } catch (error) {
    console.log('Ödüllü reklam başlatılamadı:', error);
    return null;
  }
}