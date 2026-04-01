const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_MAP_TILE_ENDPOINT =
  'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf';

type EnvMap = Record<string, string | undefined>;

const env: EnvMap =
  typeof globalThis !== 'undefined' &&
  'process' in globalThis &&
  typeof (globalThis as { process?: { env?: EnvMap } }).process?.env === 'object'
    ? (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {}
    : {};

const nodeEnv = env.NODE_ENV ?? 'development';
const isDevelopment = nodeEnv === 'development';

const getEnvValue = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const parseRequiredUrl = (value: string, envNames: string[]): string => {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(
      `[config] ${envNames.join(' / ')} must be a valid absolute URL. Received: ${value}`,
    );
  }
};

const parseRuntimeUrl = (params: {
  envNames: string[];
  fallback: string | undefined;
}): string => {
  const configured = getEnvValue(...params.envNames);

  if (!configured) {
    if (params.fallback) {
      return parseRequiredUrl(params.fallback, params.envNames);
    }

    throw new Error(
      `[config] Missing required env: ${params.envNames.join(' or ')}. NODE_ENV=${nodeEnv}`,
    );
  }

  return parseRequiredUrl(configured, params.envNames);
};

export type RuntimeConfig = {
  routingBaseUrl: string;
  mapStyleUrl: string;
  mapTileEndpoint: string;
  mockMode: boolean;
};

export const runtimeConfig: RuntimeConfig = {
  routingBaseUrl: parseRuntimeUrl({
    envNames: ['EXPO_PUBLIC_ROUTING_BASE_URL', 'ROUTING_BASE_URL'],
    fallback: isDevelopment ? 'http://localhost:3000' : undefined,
  }),
  mapStyleUrl: parseRuntimeUrl({
    envNames: ['EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'],
    fallback: DEFAULT_MAP_STYLE_URL,
  }),
  mapTileEndpoint: parseRuntimeUrl({
    envNames: ['EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'],
    fallback: DEFAULT_MAP_TILE_ENDPOINT,
  }),
  mockMode: env.MOCK_MODE === 'true',
};
