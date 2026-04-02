const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_MAP_TILE_ENDPOINT =
  'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf';

type EnvMap = Record<string, string | undefined>;
type ExpoExtraMap = Partial<Record<ConfigKey, string | boolean>>;

export type ConfigKey = 'routingBaseUrl' | 'mapStyleUrl' | 'mapTileEndpoint' | 'mockMode';
export type ConfigSource = 'override' | 'process_env' | 'expo_extra' | 'fallback';

const ENV_KEY_ALIASES: Record<ConfigKey, readonly string[]> = {
  routingBaseUrl: ['EXPO_PUBLIC_ROUTING_BASE_URL', 'ROUTING_BASE_URL'],
  mapStyleUrl: ['EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'],
  mapTileEndpoint: ['EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'],
  mockMode: ['MOCK_MODE'],
} as const;

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

const configOverrideStore: Partial<Record<ConfigKey, string | boolean>> = {};

const setConfigOverride = <T extends ConfigKey>(key: T, value: RuntimeConfig[T]): void => {
  configOverrideStore[key] = value;
};

const clearConfigOverrides = (): void => {
  for (const key of Object.keys(configOverrideStore) as ConfigKey[]) {
    delete configOverrideStore[key];
  }
};

const normalizeExtraValue = (value: unknown): string | boolean | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
};

const readExpoExtra = (): ExpoExtraMap => {
  const maybeRequire = (globalThis as { require?: (id: string) => unknown }).require;
  if (typeof maybeRequire !== 'function') {
    return {};
  }

  let moduleExports: unknown;
  try {
    moduleExports = maybeRequire('expo-constants');
  } catch {
    return {};
  }

  const constants = (moduleExports as { default?: unknown }).default as
    | { expoConfig?: { extra?: Record<string, unknown> }; manifest2?: { extra?: Record<string, unknown> } }
    | undefined;

  if (!constants) {
    return {};
  }

  const candidates: Record<string, unknown>[] = [];
  if (constants.expoConfig?.extra && typeof constants.expoConfig.extra === 'object') {
    candidates.push(constants.expoConfig.extra);
  }
  if (constants.manifest2?.extra && typeof constants.manifest2.extra === 'object') {
    candidates.push(constants.manifest2.extra);
  }

  const normalized: ExpoExtraMap = {};
  for (const source of candidates) {
    const routingBaseUrl = normalizeExtraValue(source.routingBaseUrl);
    if (routingBaseUrl !== undefined) {
      normalized.routingBaseUrl = routingBaseUrl;
    }

    const mapStyleUrl = normalizeExtraValue(source.mapStyleUrl);
    if (mapStyleUrl !== undefined) {
      normalized.mapStyleUrl = mapStyleUrl;
    }

    const mapTileEndpoint = normalizeExtraValue(source.mapTileEndpoint);
    if (mapTileEndpoint !== undefined) {
      normalized.mapTileEndpoint = mapTileEndpoint;
    }
  }

  return normalized;
};

const resolveFallbackValue = (key: ConfigKey, nodeEnv: string): string | boolean | undefined => {
  if (key === 'routingBaseUrl') {
    return nodeEnv === 'development' ? 'http://localhost:3000' : undefined;
  }
  if (key === 'mapStyleUrl') {
    return nodeEnv === 'development' ? DEFAULT_MAP_STYLE_URL : undefined;
  }
  if (key === 'mapTileEndpoint') {
    return DEFAULT_MAP_TILE_ENDPOINT;
  }
  if (key === 'mockMode') {
    return false;
  }
  return undefined;
};

const resolveConfigValue = (params: {
  key: ConfigKey;
  env: EnvMap;
  expoExtra: ExpoExtraMap;
  nodeEnv: string;
}): { source: ConfigSource; value: string | boolean } | null => {
  const override = configOverrideStore[params.key];
  if (override !== undefined) {
    return { source: 'override', value: override };
  }

  const envValue = getEnvValue(params.env, ...ENV_KEY_ALIASES[params.key]);
  if (envValue !== undefined) {
    return { source: 'process_env', value: envValue };
  }

  if (params.key !== 'mockMode') {
    const extraValue = params.expoExtra[params.key];
    if (extraValue !== undefined) {
      return { source: 'expo_extra', value: extraValue };
    }
  }

  const fallbackValue = resolveFallbackValue(params.key, params.nodeEnv);
  if (fallbackValue !== undefined) {
    return { source: 'fallback', value: fallbackValue };
  }

  return null;
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

const parseBoolean = (value: string | boolean): boolean =>
  typeof value === 'boolean' ? value : value.trim().toLowerCase() === 'true';

const toEnvValue = (value: string | boolean | undefined): EnvMap =>
  value === undefined ? {} : { resolved: String(value) };

export const getRuntimeConfigSafe =
  (): { ok: true; config: RuntimeConfig } | { ok: false; error: string } => {
    const env = getProcessEnv();
    const nodeEnv = getNodeEnv(env);
    const expoExtra = readExpoExtra();

    try {
      const routingBaseUrlResolved = resolveConfigValue({
        key: 'routingBaseUrl',
        env,
        expoExtra,
        nodeEnv,
      });
      const mapStyleUrlResolved = resolveConfigValue({
        key: 'mapStyleUrl',
        env,
        expoExtra,
        nodeEnv,
      });
      const mapTileEndpointResolved = resolveConfigValue({
        key: 'mapTileEndpoint',
        env,
        expoExtra,
        nodeEnv,
      });
      const mockModeResolved = resolveConfigValue({
        key: 'mockMode',
        env,
        expoExtra,
        nodeEnv,
      });

      return {
        ok: true,
        config: {
          routingBaseUrl: parseRuntimeUrl({
            env: toEnvValue(routingBaseUrlResolved?.value),
            envNames: [...ENV_KEY_ALIASES.routingBaseUrl],
            fallback: undefined,
            nodeEnv,
            requiredInProduction: true,
          }),
          mapStyleUrl: parseRuntimeUrl({
            env: toEnvValue(mapStyleUrlResolved?.value),
            envNames: [...ENV_KEY_ALIASES.mapStyleUrl],
            fallback: undefined,
            nodeEnv,
            requiredInProduction: true,
          }),
          mapTileEndpoint: parseRuntimeUrl({
            env: toEnvValue(mapTileEndpointResolved?.value),
            envNames: [...ENV_KEY_ALIASES.mapTileEndpoint],
            fallback: undefined,
            nodeEnv,
          }),
          mockMode: mockModeResolved ? parseBoolean(mockModeResolved.value) : false,
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

export { clearConfigOverrides, readExpoExtra, resolveConfigValue, setConfigOverride };
