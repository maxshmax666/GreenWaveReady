#!/usr/bin/env node

const env = process.env;
const mode = env.MOBILE_ENV_MODE ?? env.NODE_ENV ?? 'development';
const isDevelopment = mode === 'development';

const requiredVars = isDevelopment
  ? []
  : ['EXPO_PUBLIC_ROUTING_BASE_URL', 'EXPO_PUBLIC_MAP_STYLE_URL'];

const candidateVars = [
  'EXPO_PUBLIC_ROUTING_BASE_URL',
  'EXPO_PUBLIC_MAP_STYLE_URL',
  'EXPO_PUBLIC_MAP_TILE_ENDPOINT',
];

const fail = (message) => {
  console.error(`[env-check] ${message}`);
  process.exit(1);
};

const looksMaskedOrPlaceholder = (value) => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return true;
  if (normalized === '***') return true;
  if (normalized.includes('<secret>')) return true;
  if (normalized.includes('changeme')) return true;
  if (normalized.includes('placeholder')) return true;
  if (normalized.includes('${{') || normalized.includes('}}')) return true;

  return false;
};

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
    fail(`${envName} must be a valid absolute URL. Received: ${value}`);
  }

  if (!isDevelopment && parsed.protocol !== 'https:') {
    fail(`${envName} must use HTTPS in ${mode}. Received: ${value}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isDevelopment) {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      fail(`${envName} must not use localhost in ${mode}. Received: ${value}`);
    }

    if (isPrivateIp(hostname)) {
      fail(`${envName} must not use private/loopback IPs in ${mode}. Received: ${value}`);
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

console.info(
  `[env-check] OK. mode=${mode}; validated=${candidateVars.filter((name) => Boolean(env[name])).join(', ') || 'none'}`,
);
