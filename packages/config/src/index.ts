const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_MAP_TILE_ENDPOINT =
  'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf';

type EnvMap = Record<string, string | undefined>;

type ValidationErrorKind =
  | 'missing_env'
  | 'invalid_url'
  | 'non_https_in_production'
  | 'localhost_in_production'
  | 'private_ip_in_production';

const getProcessEnv = (): EnvMap =>
  typeof globalThis !== 'undefined' &&
  'process' in globalThis &&
  typeof (globalThis as { process?: { env?: EnvMap } }).process?.env === 'object'
    ? ((globalThis as { process?: { env?: EnvMap } }).process?.env ?? {})
    : {};

const getNodeEnv = (env: EnvMap): string => env.NODE_ENV ?? 'development';

const getEnvValue = (env: EnvMap, ...keys: string[]): string | undefined => {
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

const formatValidationError = (params: {
  kind: ValidationErrorKind;
  envNames: string[];
  nodeEnv: string;
  host?: string;
}): string => {
  const hostPart = params.host ? ` host=${params.host}` : '';
  return `[config] validation_error type=${params.kind} env=${params.envNames.join(' | ')} nodeEnv=${params.nodeEnv}${hostPart}`;
};

const parseRequiredUrl = (params: {
  value: string;
  envNames: string[];
  nodeEnv: string;
}): string => {
  let parsed: URL;

  try {
    parsed = new URL(params.value);
  } catch {
    throw new Error(
      formatValidationError({
        kind: 'invalid_url',
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      }),
    );
  }

  if (params.nodeEnv !== 'development') {
    if (parsed.protocol !== 'https:') {
      throw new Error(
        formatValidationError({
          kind: 'non_https_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      );
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw new Error(
        formatValidationError({
          kind: 'localhost_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      );
    }

    if (isPrivateIp(hostname)) {
      throw new Error(
        formatValidationError({
          kind: 'private_ip_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      );
    }
  }

  return params.value;
};

const parseRuntimeUrl = (params: {
  env: EnvMap;
  envNames: string[];
  fallback: string | undefined;
  nodeEnv: string;
  requiredInProduction?: boolean;
}): string => {
  const configured = getEnvValue(params.env, ...params.envNames);

  if (!configured) {
    if (params.requiredInProduction && params.nodeEnv === 'production') {
      throw new Error(
        formatValidationError({
          kind: 'missing_env',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
        }),
      );
    }

    if (params.fallback) {
      return parseRequiredUrl({
        value: params.fallback,
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      });
    }

    throw new Error(
      formatValidationError({
        kind: 'missing_env',
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      }),
    );
  }

  return parseRequiredUrl({
    value: configured,
    envNames: params.envNames,
    nodeEnv: params.nodeEnv,
  });
};

export type RuntimeConfig = {
  routingBaseUrl: string;
  mapStyleUrl: string;
  mapTileEndpoint: string;
  mockMode: boolean;
};

export const getRuntimeConfigSafe =
  (): { ok: true; config: RuntimeConfig } | { ok: false; error: string } => {
    const env = getProcessEnv();
    const nodeEnv = getNodeEnv(env);

    try {
      return {
        ok: true,
        config: {
          routingBaseUrl: parseRuntimeUrl({
            env,
            envNames: ['EXPO_PUBLIC_ROUTING_BASE_URL', 'ROUTING_BASE_URL'],
            fallback: nodeEnv === 'development' ? 'http://localhost:3000' : undefined,
            nodeEnv,
            requiredInProduction: true,
          }),
          mapStyleUrl: parseRuntimeUrl({
            env,
            envNames: ['EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'],
            fallback: nodeEnv === 'development' ? DEFAULT_MAP_STYLE_URL : undefined,
            nodeEnv,
            requiredInProduction: true,
          }),
          mapTileEndpoint: parseRuntimeUrl({
            env,
            envNames: ['EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'],
            fallback: DEFAULT_MAP_TILE_ENDPOINT,
            nodeEnv,
          }),
          mockMode: env.MOCK_MODE === 'true',
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '[config] validation_error type=unknown',
      };
    }
  };

export const getRuntimeConfig = (): RuntimeConfig => {
  const result = getRuntimeConfigSafe();
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.config;
};

const runtimeConfigResult = getRuntimeConfigSafe();

export const runtimeConfig: RuntimeConfig = runtimeConfigResult.ok
  ? runtimeConfigResult.config
  : {
      routingBaseUrl: 'http://localhost:3000',
      mapStyleUrl: DEFAULT_MAP_STYLE_URL,
      mapTileEndpoint: DEFAULT_MAP_TILE_ENDPOINT,
      mockMode: false,
    };

export const runtimeConfigInitError: string | null = runtimeConfigResult.ok ? null : runtimeConfigResult.error;
