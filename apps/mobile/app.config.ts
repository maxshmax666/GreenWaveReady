import type { ConfigContext, ExpoConfig } from 'expo/config';

const readEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GreenWave Mobile',
  slug: 'greenwave-mobile',
  scheme: 'greenwave',
  version: '0.1.0',
  extra: {
    // Эти ключи читаются shared `@greenwave/config` как Expo runtime source.
    ...(config.extra ?? {}),
    routingBaseUrl: readEnv('EXPO_PUBLIC_ROUTING_BASE_URL', 'ROUTING_BASE_URL'),
    mapStyleUrl: readEnv('EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'),
    mapTileEndpoint: readEnv('EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'),
  },
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
