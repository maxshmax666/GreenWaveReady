#!/usr/bin/env node

const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

const env = process.env;
const mode = env.MOBILE_ENV_MODE ?? env.NODE_ENV ?? 'development';
const isDevelopment = mode === 'development';

const requiredVars = isDevelopment ? [] : ['EXPO_PUBLIC_ROUTING_BASE_URL'];
const candidateVars = ['EXPO_PUBLIC_ROUTING_BASE_URL', 'EXPO_PUBLIC_MAP_TILE_ENDPOINT'];

const fail = (message) => {
  console.error(`[env-check] ${message}`);
  process.exit(1);
};

function isValidAbsoluteHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function maskForLogs(value) {
  if (value == null) return '<undefined>';
  const s = String(value).trim();
  if (!s) return '<empty>';
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

function looksMaskedOrPlaceholder(value) {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();

  if (!normalized) return true;
  if (/^\*+$/.test(normalized)) return true;
  if (normalized.includes('<secret>')) return true;
  if (normalized.includes('changeme')) return true;
  if (normalized.includes('placeholder')) return true;
  if (normalized.includes('${{') || normalized.includes('}}')) return true;

  return false;
}

function resolveMapStyleUrl(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!value) {
    console.warn(
      `[env-check] EXPO_PUBLIC_MAP_STYLE_URL is missing. Using fallback: ${DEFAULT_MAP_STYLE_URL}`,
    );
    return DEFAULT_MAP_STYLE_URL;
  }

  if (looksMaskedOrPlaceholder(value)) {
    console.warn(
      `[env-check] EXPO_PUBLIC_MAP_STYLE_URL is masked/placeholder (${maskForLogs(
        value,
      )}). Using fallback: ${DEFAULT_MAP_STYLE_URL}`,
    );
    return DEFAULT_MAP_STYLE_URL;
  }

  if (!isValidAbsoluteHttpUrl(value)) {
    console.warn(
      `[env-check] EXPO_PUBLIC_MAP_STYLE_URL is invalid (${maskForLogs(
        value,
      )}). Using fallback: ${DEFAULT_MAP_STYLE_URL}`,
    );
    return DEFAULT_MAP_STYLE_URL;
  }

  return value;
}

const isPrivateIp = (hostname) => {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const [a, b] = hostname.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (hostname.includes(':')) {
    const normalized = hostname.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    );
  }

  return false;
};

const validateUrl = (envName, value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${envName} must be a valid absolute URL. Received: ${maskForLogs(value)}`);
  }

  if (!isDevelopment && parsed.protocol !== 'https:') {
    fail(`${envName} must use HTTPS in ${mode}. Received: ${maskForLogs(value)}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isDevelopment) {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      fail(`${envName} must not use localhost in ${mode}. Received: ${maskForLogs(value)}`);
    }

    if (isPrivateIp(hostname)) {
      fail(`${envName} must not use private/loopback IPs in ${mode}. Received: ${maskForLogs(value)}`);
    }
  }
};

for (const envName of requiredVars) {
  const value = env[envName];
  if (!value || value.trim().length === 0) {
    fail(`Missing required env var ${envName} for ${mode}`);
  }

  if (!isDevelopment && looksMaskedOrPlaceholder(value)) {
    fail(`${envName} looks like a masked/placeholder value in ${mode}. Configure a real public HTTPS URL.`);
  }
}

for (const envName of candidateVars) {
  const value = env[envName];
  if (typeof value === 'string' && value.trim().length > 0) {
    validateUrl(envName, value.trim());
  }
}

const resolvedMapStyleUrl = resolveMapStyleUrl(env.EXPO_PUBLIC_MAP_STYLE_URL);
if (!isValidAbsoluteHttpUrl(resolvedMapStyleUrl)) {
  fail(
    `Failed to resolve a valid EXPO_PUBLIC_MAP_STYLE_URL. Final value: ${maskForLogs(
      resolvedMapStyleUrl,
    )}`,
  );
}

if (!isDevelopment && !resolvedMapStyleUrl.startsWith('https://')) {
  fail(
    `EXPO_PUBLIC_MAP_STYLE_URL must resolve to HTTPS in ${mode}. Final value: ${maskForLogs(
      resolvedMapStyleUrl,
    )}`,
  );
}

process.env.EXPO_PUBLIC_MAP_STYLE_URL = resolvedMapStyleUrl;
console.info('[env-check] EXPO_PUBLIC_MAP_STYLE_URL OK');
console.info(
  `[env-check] OK. mode=${mode}; validated=${[
    ...candidateVars.filter((name) => Boolean(env[name])),
    'EXPO_PUBLIC_MAP_STYLE_URL',
  ].join(', ')}`,
);
