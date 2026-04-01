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
const isProduction = nodeEnv === 'production';

const getEnvValue = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const isPrivateIp = (hostname: string): boolean => {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const octets = hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
      return false;
    }

    const a = octets[0];
    const b = octets[1];
    if (a === undefined || b === undefined) {
      return false;
    }
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    return false;
  }

  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
};

const parseRequiredUrl = (value: string, envNames: string[]): string => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[config] ${envNames.join(' / ')} must be a valid absolute URL. Received: ${value}`,
    );
  }

  if (!isDevelopment) {
    if (parsed.protocol !== 'https:') {
      throw new Error(
        `[config] ${envNames.join(' / ')} must use HTTPS when NODE_ENV=${nodeEnv}. Received: ${value}`,
      );
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw new Error(
        `[config] ${envNames.join(' / ')} must not use localhost when NODE_ENV=${nodeEnv}. Received: ${value}`,
      );
    }

    if (isPrivateIp(hostname)) {
      throw new Error(
        `[config] ${envNames.join(' / ')} must not use private/loopback IPs when NODE_ENV=${nodeEnv}. Received: ${value}`,
      );
    }
  }

  return value;
};

const parseRuntimeUrl = (params: {
  envNames: string[];
  fallback: string | undefined;
  requiredInProduction?: boolean;
}): string => {
  const configured = getEnvValue(...params.envNames);

  if (!configured) {
    if (params.requiredInProduction && isProduction) {
      throw new Error(
        `[config] Missing required env for production: ${params.envNames.join(' or ')}. NODE_ENV=${nodeEnv}`,
      );
    }

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
    requiredInProduction: true,
  }),
  mapStyleUrl: parseRuntimeUrl({
    envNames: ['EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'],
    fallback: isDevelopment ? DEFAULT_MAP_STYLE_URL : undefined,
    requiredInProduction: true,
  }),
  mapTileEndpoint: parseRuntimeUrl({
    envNames: ['EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'],
    fallback: DEFAULT_MAP_TILE_ENDPOINT,
  }),
  mockMode: env.MOCK_MODE === 'true',
};
