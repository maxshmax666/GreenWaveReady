const DEFAULT_MAP_STYLE_URL =
  'https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_MAPTILER_KEY';
const DEFAULT_MAP_TILE_ENDPOINT =
  'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=YOUR_MAPTILER_KEY';

type EnvMap = Record<string, string | undefined>;
type RuntimeFetcher = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;
type ExpoExtraMap = Partial<Record<ConfigKey, string | boolean>>;
type ExpoConstantsLike = {
  expoConfig?: { extra?: Record<string, unknown> } | null;
  manifest2?: { extra?: Record<string, unknown> } | null;
};

export type ConfigKey = 'routingBaseUrl' | 'mapStyleUrl' | 'mapTileEndpoint' | 'mockMode';
export type ConfigSource = 'override' | 'process_env' | 'expo_extra' | 'fallback';
export type ValidationErrorKind =
  | 'missing_env'
  | 'invalid_url'
  | 'non_https_in_production'
  | 'localhost_in_production'
  | 'private_ip_in_production';

export type RuntimeConfigDiagnostics = {
  ok: boolean;
  nodeEnv: string;
  sources: Record<ConfigKey, ConfigSource>;
  errors: Array<{ key: ConfigKey; rule: ValidationErrorKind; message: string }>;
  resolvedHosts?: Partial<Record<ConfigKey, string>>;
};

export type RuntimeMapStyleDiagnostics = {
  ok: boolean;
  styleUrl: string;
  sourceCount: number;
  usableSourceCount: number;
  hasVectorOrRasterSource: boolean;
  warnings: string[];
};

const CONFIG_KEYS: readonly ConfigKey[] = [
  'routingBaseUrl',
  'mapStyleUrl',
  'mapTileEndpoint',
  'mockMode',
] as const;

const ENV_KEY_ALIASES: Record<ConfigKey, readonly string[]> = {
  routingBaseUrl: ['EXPO_PUBLIC_ROUTING_BASE_URL', 'ROUTING_BASE_URL'],
  mapStyleUrl: ['EXPO_PUBLIC_MAP_STYLE_URL', 'MAP_STYLE_URL'],
  mapTileEndpoint: ['EXPO_PUBLIC_MAP_TILE_ENDPOINT', 'MAP_TILE_ENDPOINT'],
  mockMode: ['MOCK_MODE'],
} as const;

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

const configOverrideStore: RuntimeConfigOverride = {};
const runtimeConfigSourceStore: { expoExtra: ExpoExtraMap } = { expoExtra: {} };
let didLogExpoExtraSource = false;

const setConfigOverride = <T extends ConfigKey>(key: T, value: RuntimeConfig[T]): void => {
  setRuntimeConfigOverride({ [key]: value } as RuntimeConfigOverride);
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

const toExpoExtraMap = (source: Record<string, unknown> | undefined): ExpoExtraMap => {
  const candidates: Record<string, unknown>[] = [];
  if (source && typeof source === 'object') {
    candidates.push(source);
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

export const readExpoConstantsExtra = (
  constants: ExpoConstantsLike | null | undefined,
  fallback: Record<string, unknown> | null | undefined = undefined,
): ExpoExtraMap => {
  if (constants?.expoConfig?.extra && typeof constants.expoConfig.extra === 'object') {
    return toExpoExtraMap(constants.expoConfig.extra);
  }

  if (constants?.manifest2?.extra && typeof constants.manifest2.extra === 'object') {
    return toExpoExtraMap(constants.manifest2.extra);
  }

  return toExpoExtraMap(fallback ?? undefined);
};

const readExpoExtra = (): ExpoExtraMap => readExpoConstantsExtra(undefined, runtimeConfigSourceStore.expoExtra);

const resolveFallbackValue = (key: ConfigKey, nodeEnv: string): string | boolean | undefined => {
  if (key === 'routingBaseUrl') {
    return nodeEnv === 'development' ? 'http://localhost:3000' : undefined;
  }
  if (key === 'mapStyleUrl') {
    return nodeEnv === 'development' ? DEFAULT_MAP_STYLE_URL : undefined;
  }
  if (key === 'mapTileEndpoint') {
    return nodeEnv === 'development' ? DEFAULT_MAP_TILE_ENDPOINT : undefined;
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
  key: ConfigKey;
  source: ConfigSource;
  envNames: string[];
  nodeEnv: string;
  host?: string;
}): string => {
  const hostPart = params.host ? ` host=${params.host}` : '';
  return `[config] validation_error type=${params.kind} key=${params.key} source=${params.source} env=${params.envNames.join(' | ')} nodeEnv=${params.nodeEnv}${hostPart}`;
};

const buildValidationError = (params: {
  key: ConfigKey;
  source: ConfigSource;
  rule: ValidationErrorKind;
  envNames: string[];
  nodeEnv: string;
  host?: string;
}): { key: ConfigKey; rule: ValidationErrorKind; message: string } => {
  const message = params.host
    ? formatValidationError({
        kind: params.rule,
        key: params.key,
        source: params.source,
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
        host: params.host,
      })
    : formatValidationError({
        kind: params.rule,
        key: params.key,
        source: params.source,
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      });

  return {
    key: params.key,
    rule: params.rule,
    message,
  };
};

const validateRuntimeUrl = (params: {
  key: ConfigKey;
  source: ConfigSource;
  value: string | boolean | undefined;
  envNames: string[];
  nodeEnv: string;
  requiredInProduction?: boolean;
  optional?: boolean;
}): { value?: string; host?: string; error?: { key: ConfigKey; rule: ValidationErrorKind; message: string } } => {
  const rawValue = typeof params.value === 'string' ? params.value.trim() : '';

  if (!rawValue) {
    if (params.optional) {
      return {};
    }

    if (params.requiredInProduction && params.nodeEnv === 'production') {
      return {
        error: buildValidationError({
          key: params.key,
          source: params.source,
          rule: 'missing_env',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
        }),
      };
    }

    return {
      error: buildValidationError({
        key: params.key,
        source: params.source,
        rule: 'missing_env',
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      }),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    return {
      error: buildValidationError({
        key: params.key,
        source: params.source,
        rule: 'invalid_url',
        envNames: params.envNames,
        nodeEnv: params.nodeEnv,
      }),
    };
  }

  if (params.nodeEnv !== 'development') {
    if (parsed.protocol !== 'https:') {
      return {
        error: buildValidationError({
          key: params.key,
          source: params.source,
          rule: 'non_https_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return {
        error: buildValidationError({
          key: params.key,
          source: params.source,
          rule: 'localhost_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      };
    }

    if (isPrivateIp(hostname)) {
      return {
        error: buildValidationError({
          key: params.key,
          source: params.source,
          rule: 'private_ip_in_production',
          envNames: params.envNames,
          nodeEnv: params.nodeEnv,
          host: parsed.host,
        }),
      };
    }
  }

  return { value: rawValue, host: parsed.host };
};

export type RuntimeConfig = {
  routingBaseUrl: string;
  mapStyleUrl: string;
  mapTileEndpoint?: string;
  mockMode: boolean;
};
export type RuntimeConfigOverride = Partial<
  Pick<RuntimeConfig, 'routingBaseUrl' | 'mapStyleUrl' | 'mapTileEndpoint' | 'mockMode'>
>;

const parseBoolean = (value: string | boolean): boolean =>
  typeof value === 'boolean' ? value : value.trim().toLowerCase() === 'true';

const validateOverridePatch = (patch: RuntimeConfigOverride): void => {
  if ('mockMode' in patch && patch.mockMode !== undefined && typeof patch.mockMode !== 'boolean') {
    throw new Error(
      '[config] validation_error type=invalid_override key=mockMode source=override expected=boolean',
    );
  }

  const urlEntries: Array<[ConfigKey, string | undefined]> = [
    ['routingBaseUrl', patch.routingBaseUrl],
    ['mapStyleUrl', patch.mapStyleUrl],
    ['mapTileEndpoint', patch.mapTileEndpoint],
  ];

  for (const [key, value] of urlEntries) {
    if (value === undefined) {
      continue;
    }

    const validation = validateRuntimeUrl({
      key,
      source: 'override',
      value,
      envNames: [...ENV_KEY_ALIASES[key]],
      nodeEnv: 'production',
      requiredInProduction: true,
    });
    if (validation.error) {
      throw new Error(validation.error.message);
    }
  }
};

export const setRuntimeConfigOverride = (patch: RuntimeConfigOverride): void => {
  validateOverridePatch(patch);
  Object.assign(configOverrideStore, patch);
};

export const clearRuntimeConfigOverride = (): void => {
  clearConfigOverrides();
};

export const getRuntimeConfigOverride = (): RuntimeConfigOverride => ({ ...configOverrideStore });

export const setRuntimeConfigSource = (params: {
  expoExtra?: Record<string, unknown> | null;
}): void => {
  runtimeConfigSourceStore.expoExtra = readExpoConstantsExtra(undefined, params.expoExtra);
};

type RuntimeConfigEvaluation = {
  config: RuntimeConfig | null;
  diagnostics: RuntimeConfigDiagnostics;
};

const evaluateRuntimeConfig = (): RuntimeConfigEvaluation => {
  const env = getProcessEnv();
  const nodeEnv = getNodeEnv(env);
  const expoExtra = readExpoExtra();

  const resolved = CONFIG_KEYS.reduce(
    (acc, key) => {
      const entry = resolveConfigValue({ key, env, expoExtra, nodeEnv });
      acc[key] = entry;
      return acc;
    },
    {} as Record<ConfigKey, { source: ConfigSource; value: string | boolean } | null>,
  );

  const sources = CONFIG_KEYS.reduce(
    (acc, key) => {
      acc[key] = resolved[key]?.source ?? 'fallback';
      return acc;
    },
    {} as Record<ConfigKey, ConfigSource>,
  );

  const errors: RuntimeConfigDiagnostics['errors'] = [];
  const resolvedHosts: Partial<Record<ConfigKey, string>> = {};

  const routingValidation = validateRuntimeUrl({
    key: 'routingBaseUrl',
    source: sources.routingBaseUrl,
    value: resolved.routingBaseUrl?.value,
    envNames: [...ENV_KEY_ALIASES.routingBaseUrl],
    nodeEnv,
    requiredInProduction: true,
  });
  if (routingValidation.error) {
    errors.push(routingValidation.error);
  }
  if (routingValidation.host) {
    resolvedHosts.routingBaseUrl = routingValidation.host;
  }

  const mapStyleValidation = validateRuntimeUrl({
    key: 'mapStyleUrl',
    source: sources.mapStyleUrl,
    value: resolved.mapStyleUrl?.value,
    envNames: [...ENV_KEY_ALIASES.mapStyleUrl],
    nodeEnv,
    requiredInProduction: true,
  });
  if (mapStyleValidation.error) {
    errors.push(mapStyleValidation.error);
  }
  if (mapStyleValidation.host) {
    resolvedHosts.mapStyleUrl = mapStyleValidation.host;
  }

  const mapTilesValidation = validateRuntimeUrl({
    key: 'mapTileEndpoint',
    source: sources.mapTileEndpoint,
    value: resolved.mapTileEndpoint?.value,
    envNames: [...ENV_KEY_ALIASES.mapTileEndpoint],
    nodeEnv,
    optional: true,
  });
  if (mapTilesValidation.error) {
    errors.push(mapTilesValidation.error);
  }
  if (mapTilesValidation.host) {
    resolvedHosts.mapTileEndpoint = mapTilesValidation.host;
  }

  const diagnostics: RuntimeConfigDiagnostics = {
    ok: errors.length === 0,
    nodeEnv,
    sources,
    errors,
    ...(Object.keys(resolvedHosts).length > 0 ? { resolvedHosts } : {}),
  };

  if (!didLogExpoExtraSource && Object.values(sources).some((source) => source === 'expo_extra')) {
    didLogExpoExtraSource = true;
    console.info('[config] source=expo_extra');
  }

  if (errors.length > 0) {
    return { config: null, diagnostics };
  }

  return {
    config: {
      routingBaseUrl: routingValidation.value as string,
      mapStyleUrl: mapStyleValidation.value as string,
      ...(mapTilesValidation.value ? { mapTileEndpoint: mapTilesValidation.value } : {}),
      mockMode: resolved.mockMode ? parseBoolean(resolved.mockMode.value) : false,
    },
    diagnostics,
  };
};

export const getRuntimeConfigDiagnostics = (): RuntimeConfigDiagnostics => evaluateRuntimeConfig().diagnostics;

export const getRuntimeConfigSafe =
  (): { ok: true; config: RuntimeConfig } | { ok: false; error: string } => {
    const evaluation = evaluateRuntimeConfig();
    if (!evaluation.config) {
      return {
        ok: false,
        error: evaluation.diagnostics.errors[0]?.message ?? '[config] validation_error type=unknown',
      };
    }

    return {
      ok: true,
      config: evaluation.config,
    };
  };

export const getRuntimeConfig = (): RuntimeConfig => {
  const result = getRuntimeConfigSafe();
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.config;
};

export const validateMapStyleSources = async (params: {
  styleUrl: string;
  fetcher?: RuntimeFetcher;
}): Promise<RuntimeMapStyleDiagnostics> => {
  const styleUrl = params.styleUrl.trim();
  const fetcher =
    params.fetcher ??
    (typeof fetch === 'function'
      ? (fetch.bind(globalThis) as unknown as RuntimeFetcher)
      : undefined);

  if (!fetcher) {
    return {
      ok: false,
      styleUrl,
      sourceCount: 0,
      usableSourceCount: 0,
      hasVectorOrRasterSource: false,
      warnings: ['Style validation skipped: fetch API is unavailable in current runtime.'],
    };
  }

  try {
    const response = await fetcher(styleUrl);
    if (!response.ok) {
      return {
        ok: false,
        styleUrl,
        sourceCount: 0,
        usableSourceCount: 0,
        hasVectorOrRasterSource: false,
        warnings: [`Style URL is unreachable: HTTP ${response.status}.`],
      };
    }

    const rawStyle = (await response.json()) as {
      sources?: Record<string, { type?: string } | undefined>;
    };
    const sources = rawStyle.sources ?? {};
    const sourceEntries = Object.entries(sources);
    const usableSourceEntries = sourceEntries.filter(([, source]) =>
      ['vector', 'raster'].includes(String(source?.type ?? '').toLowerCase()),
    );
    const hasVectorOrRasterSource = usableSourceEntries.length > 0;

    return {
      ok: hasVectorOrRasterSource,
      styleUrl,
      sourceCount: sourceEntries.length,
      usableSourceCount: usableSourceEntries.length,
      hasVectorOrRasterSource,
      warnings: hasVectorOrRasterSource
        ? []
        : ['Style has no usable vector/raster sources for base map rendering.'],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return {
      ok: false,
      styleUrl,
      sourceCount: 0,
      usableSourceCount: 0,
      hasVectorOrRasterSource: false,
      warnings: [`Style validation failed: ${message}.`],
    };
  }
};

const runtimeConfigResult = getRuntimeConfigSafe();

export const runtimeConfig: RuntimeConfig = new Proxy({} as RuntimeConfig, {
  get: (_target, property: string | symbol): RuntimeConfig[keyof RuntimeConfig] | undefined => {
    if (typeof property !== 'string') {
      return undefined;
    }

    const config = getRuntimeConfig();
    return config[property as keyof RuntimeConfig];
  },
  ownKeys: (): ArrayLike<string | symbol> => Reflect.ownKeys(getRuntimeConfig()),
  getOwnPropertyDescriptor: (
    _target,
    property: string | symbol,
  ): PropertyDescriptor | undefined => {
    if (typeof property !== 'string') {
      return undefined;
    }

    const config = getRuntimeConfig();
    return {
      configurable: true,
      enumerable: true,
      value: config[property as keyof RuntimeConfig],
      writable: false,
    };
  },
});

export const runtimeConfigInitError: string | null = runtimeConfigResult.ok ? null : runtimeConfigResult.error;

export {
  clearConfigOverrides,
  readExpoExtra,
  resolveConfigValue,
  setConfigOverride,
};
