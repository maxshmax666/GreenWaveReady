const DEFAULT_ROUTING_BASE_URL = 'http://localhost:3000';
const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_MAP_TILE_ENDPOINT =
  'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf';

const env =
  typeof globalThis !== 'undefined' &&
  'process' in globalThis &&
  typeof (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env === 'object'
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env ?? {}
    : {};

const parseRequiredUrl = (
  value: string | undefined,
  fallback: string,
  envName: string,
): string => {
  const candidate = value ?? fallback;

  try {
    new URL(candidate);
    return candidate;
  } catch {
    throw new Error(
      `[config] ${envName} must be a valid absolute URL. Received: ${candidate}`,
    );
  }
};

export type RuntimeConfig = {
  routingBaseUrl: string;
  mapStyleUrl: string;
  mapTileEndpoint: string;
  mockMode: boolean;
};

export const runtimeConfig: RuntimeConfig = {
  routingBaseUrl: parseRequiredUrl(
    env.ROUTING_BASE_URL,
    DEFAULT_ROUTING_BASE_URL,
    'ROUTING_BASE_URL',
  ),
  mapStyleUrl: parseRequiredUrl(
    env.MAP_STYLE_URL,
    DEFAULT_MAP_STYLE_URL,
    'MAP_STYLE_URL',
  ),
  mapTileEndpoint: parseRequiredUrl(
    env.MAP_TILE_ENDPOINT,
    DEFAULT_MAP_TILE_ENDPOINT,
    'MAP_TILE_ENDPOINT',
  ),
  mockMode: env.MOCK_MODE === 'true',
};
