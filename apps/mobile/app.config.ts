import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GreenWave Mobile',
  slug: 'greenwave-mobile',
  scheme: 'greenwave',
  version: '0.1.0',
  plugins: [...(config.plugins ?? []), '@maplibre/maplibre-react-native'],
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.greenwave.mobile',
    permissions: [
      ...(config.android?.permissions ?? []),
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
  },
});
