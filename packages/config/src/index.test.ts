import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRuntimeConfigOverride,
  getRuntimeConfigOverride,
  getRuntimeConfigSafe,
  setRuntimeConfigOverride,
} from './index';

const originalEnv = { ...process.env };

const resetEnv = (): void => {
  process.env = { ...originalEnv };
};

afterEach(() => {
  resetEnv();
  clearRuntimeConfigOverride();
});

describe('getRuntimeConfigSafe', () => {
  it('returns structured error when required env is missing in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: '',
      EXPO_PUBLIC_MAP_STYLE_URL: '',
    };

    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=missing_env');
  });

  it('returns structured error for non-https URL in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'http://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
    };

    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=non_https_in_production');
    expect(result.error).toContain('host=api.example.com');
  });

  it('returns structured error for localhost in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://localhost:3000',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
    };

    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=localhost_in_production');
    expect(result.error).toContain('host=localhost:3000');
  });

  it('returns structured error for private IP in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://10.0.0.12:8080',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
    };

    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }
    expect(result.error).toContain('type=private_ip_in_production');
    expect(result.error).toContain('host=10.0.0.12:8080');
  });

  it('applies runtime override as first resolver layer', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_ROUTING_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://maps.example.com/style.json',
    };
    setRuntimeConfigOverride({
      routingBaseUrl: 'https://override.example.com',
      mockMode: true,
    });

    const result = getRuntimeConfigSafe();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success result');
    }
    expect(result.config.routingBaseUrl).toBe('https://override.example.com');
    expect(result.config.mockMode).toBe(true);
    expect(getRuntimeConfigOverride()).toEqual({
      routingBaseUrl: 'https://override.example.com',
      mockMode: true,
    });
  });

  it('rejects invalid override values with production validation rules', () => {
    expect(() =>
      setRuntimeConfigOverride({
        routingBaseUrl: 'http://localhost:3000',
      }),
    ).toThrow('type=non_https_in_production');
  });

  it('clear fully removes override state', () => {
    setRuntimeConfigOverride({
      routingBaseUrl: 'https://override.example.com',
      mapStyleUrl: 'https://override.example.com/style.json',
      mapTileEndpoint: 'https://override.example.com/{z}/{x}/{y}.pbf',
      mockMode: true,
    });

    clearRuntimeConfigOverride();

    expect(getRuntimeConfigOverride()).toEqual({});
  });
});
