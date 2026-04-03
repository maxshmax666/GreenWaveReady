import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const resetEnv = (): void => {
  process.env = { ...originalEnv };
};

const loadConfigModule = async () => import('./index');

afterEach(() => {
  resetEnv();
  vi.resetModules();
});

describe('getRuntimeConfigSafe', () => {
  it('expo constants adapter prefers expoConfig.extra, then manifest2.extra, then fallback', async () => {
    const { readExpoConstantsExtra } = await loadConfigModule();

    expect(
      readExpoConstantsExtra(
        {
          expoConfig: { extra: { routingBaseUrl: 'https://expo-config.example.com' } },
          manifest2: { extra: { routingBaseUrl: 'https://manifest2.example.com' } },
        },
        { routingBaseUrl: 'https://fallback.example.com' },
      ).routingBaseUrl,
    ).toBe('https://expo-config.example.com');

    expect(
      readExpoConstantsExtra(
        { manifest2: { extra: { routingBaseUrl: 'https://manifest2.example.com' } } },
        { routingBaseUrl: 'https://fallback.example.com' },
      ).routingBaseUrl,
    ).toBe('https://manifest2.example.com');

    expect(
      readExpoConstantsExtra(undefined, { routingBaseUrl: 'https://fallback.example.com' })
        .routingBaseUrl,
    ).toBe('https://fallback.example.com');
  });

  it('node runtime path: missing expo source adapter does not throw', async () => {
    const { readExpoExtra } = await loadConfigModule();
    expect(readExpoExtra()).toEqual({});
  });

  it('Node env path: reads EXPO_PUBLIC_* from process env and marks process_env source', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };

    const { clearRuntimeConfigOverride, getRuntimeConfigDiagnostics, getRuntimeConfigSafe } =
      await loadConfigModule();

    clearRuntimeConfigOverride();
    const safe = getRuntimeConfigSafe();
    const diagnostics = getRuntimeConfigDiagnostics();

    expect(safe.ok).toBe(true);
    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.sources.routingBaseUrl).toBe('process_env');
    expect(diagnostics.sources.mapStyleUrl).toBe('process_env');
    expect(diagnostics.sources.mapTileEndpoint).toBe('process_env');
  });

  it('Expo extra path: uses expoConfig.extra when env is empty', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: '',
      EXPO_PUBLIC_MAP_STYLE_URL: '',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: '',
    };

    const {
      clearRuntimeConfigOverride,
      getRuntimeConfigDiagnostics,
      getRuntimeConfigSafe,
      setRuntimeConfigSource,
    } = await loadConfigModule();

    clearRuntimeConfigOverride();
    setRuntimeConfigSource({
      expoExtra: {
        routingBaseUrl: 'https://expo.example.com',
        mapStyleUrl: 'https://expo.example.com/style.json',
        mapTileEndpoint: 'https://expo.example.com/{z}/{x}/{y}.pbf',
      },
    });
    const safe = getRuntimeConfigSafe();
    const diagnostics = getRuntimeConfigDiagnostics();

    expect(safe.ok).toBe(true);
    expect(diagnostics.sources.routingBaseUrl).toBe('expo_extra');
    expect(diagnostics.sources.mapStyleUrl).toBe('expo_extra');
    expect(diagnostics.sources.mapTileEndpoint).toBe('expo_extra');
  });

  it('missing env path: production without routing/style on all layers returns missing_env', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: '',
      EXPO_PUBLIC_MAP_STYLE_URL: '',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };

    const { clearRuntimeConfigOverride, getRuntimeConfigSafe } = await loadConfigModule();

    clearRuntimeConfigOverride();
    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=missing_env');
  });

  it('invalid URL path: malformed URL is rejected with invalid_url', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'not-a-url',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };

    const { clearRuntimeConfigOverride, getRuntimeConfigSafe } = await loadConfigModule();

    clearRuntimeConfigOverride();
    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=invalid_url');
    expect(result.error).toContain('key=mapStyleUrl');
  });

  it('fallback path: development with empty env/extra resolves fallback source', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      EXPO_PUBLIC_ROUTING_BASE_URL: '',
      EXPO_PUBLIC_MAP_STYLE_URL: '',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: '',
    };

    const { clearRuntimeConfigOverride, getRuntimeConfigDiagnostics, getRuntimeConfigSafe } =
      await loadConfigModule();

    clearRuntimeConfigOverride();
    const safe = getRuntimeConfigSafe();
    const diagnostics = getRuntimeConfigDiagnostics();

    expect(safe.ok).toBe(true);
    if (!safe.ok) {
      throw new Error('Expected success result');
    }
    expect(diagnostics.sources.routingBaseUrl).toBe('fallback');
    expect(diagnostics.sources.mapStyleUrl).toBe('fallback');
    expect(diagnostics.sources.mapTileEndpoint).toBe('fallback');
    expect(safe.config.routingBaseUrl).toBe('http://localhost:3000');
    expect(safe.config.mapStyleUrl).toBe('https://demotiles.maplibre.org/style.json');
  });

  it('hot override path: set override wins, clear restores normal source', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };

    const {
      clearRuntimeConfigOverride,
      getRuntimeConfigDiagnostics,
      getRuntimeConfigSafe,
      setRuntimeConfigOverride,
    } = await loadConfigModule();

    setRuntimeConfigOverride({ routingBaseUrl: 'https://override.example.com' });

    const withOverride = getRuntimeConfigSafe();
    const diagWithOverride = getRuntimeConfigDiagnostics();

    expect(withOverride.ok).toBe(true);
    if (!withOverride.ok) {
      throw new Error('Expected success result');
    }
    expect(withOverride.config.routingBaseUrl).toBe('https://override.example.com');
    expect(diagWithOverride.sources.routingBaseUrl).toBe('override');

    clearRuntimeConfigOverride();

    const afterClear = getRuntimeConfigSafe();
    const diagAfterClear = getRuntimeConfigDiagnostics();

    expect(afterClear.ok).toBe(true);
    if (!afterClear.ok) {
      throw new Error('Expected success result');
    }
    expect(afterClear.config.routingBaseUrl).toBe('https://api.example.com');
    expect(diagAfterClear.sources.routingBaseUrl).toBe('process_env');
  });

  it('precedence order: override > process_env > expo_extra > fallback', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://process.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://process.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://process.example.com/{z}/{x}/{y}.pbf',
    };

    const {
      clearRuntimeConfigOverride,
      getRuntimeConfigDiagnostics,
      getRuntimeConfigSafe,
      setRuntimeConfigSource,
      setRuntimeConfigOverride,
    } = await loadConfigModule();

    setRuntimeConfigSource({
      expoExtra: {
        routingBaseUrl: 'https://expo.example.com',
        mapStyleUrl: 'https://expo.example.com/style.json',
        mapTileEndpoint: 'https://expo.example.com/{z}/{x}/{y}.pbf',
      },
    });
    setRuntimeConfigOverride({ routingBaseUrl: 'https://override.example.com' });

    const withOverride = getRuntimeConfigSafe();
    expect(withOverride.ok).toBe(true);
    if (!withOverride.ok) {
      throw new Error('Expected success result');
    }
    expect(withOverride.config.routingBaseUrl).toBe('https://override.example.com');
    expect(getRuntimeConfigDiagnostics().sources.routingBaseUrl).toBe('override');

    clearRuntimeConfigOverride();

    const withProcess = getRuntimeConfigSafe();
    expect(withProcess.ok).toBe(true);
    if (!withProcess.ok) {
      throw new Error('Expected success result');
    }
    expect(withProcess.config.routingBaseUrl).toBe('https://process.example.com');
    expect(getRuntimeConfigDiagnostics().sources.routingBaseUrl).toBe('process_env');

    process.env = {
      ...process.env,
      EXPO_PUBLIC_ROUTING_BASE_URL: '',
      EXPO_PUBLIC_MAP_STYLE_URL: '',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: '',
    };

    const withExpo = getRuntimeConfigSafe();
    expect(withExpo.ok).toBe(true);
    if (!withExpo.ok) {
      throw new Error('Expected success result');
    }
    expect(withExpo.config.routingBaseUrl).toBe('https://expo.example.com');
    expect(getRuntimeConfigDiagnostics().sources.routingBaseUrl).toBe('expo_extra');
  });

  it('production URL policy rejects non-https, localhost and private IP', async () => {
    const { clearRuntimeConfigOverride, getRuntimeConfigSafe } = await loadConfigModule();

    clearRuntimeConfigOverride();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'http://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };
    let result = getRuntimeConfigSafe();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('type=non_https_in_production');
    }

    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://localhost:3000',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };
    result = getRuntimeConfigSafe();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('type=localhost_in_production');
    }

    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://10.0.0.12:8080',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
      EXPO_PUBLIC_MAP_TILE_ENDPOINT: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    };
    result = getRuntimeConfigSafe();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('type=private_ip_in_production');
    }
  });
});
