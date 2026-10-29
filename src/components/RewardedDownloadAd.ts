
export type RewardedDownloadCallbacks = {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
  onError: () => void;
};

export type RewardedDownloadController = {
  show: () => Promise<void> | void;
  cleanup: () => void;
};

export function createRewardedDownloadAd(
  _callbacks?: RewardedDownloadCallbacks,
): RewardedDownloadController | null {
  // Web sürümünde reklam gösterilmez.
  return null;
}
