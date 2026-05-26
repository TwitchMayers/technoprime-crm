const fs = require('fs');
const path = require('path');

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      acc[key] = stripQuotes(rawValue);
      return acc;
    }, {});
}

function compactEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function normalizeCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalLikeHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.nip.io') ||
    host.endsWith('.lhr.life')
  );
}

function sanitizePublicUrl(raw, fallbackUrl) {
  const fallback = String(fallbackUrl || '').trim();
  const value = String(raw || '').trim();
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase().includes('yourdomain.com')) {
      return fallback;
    }
    if (isLocalLikeHost(parsed.hostname)) {
      return fallback;
    }
    parsed.protocol = 'https:';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function sanitizeCorsOrigins(raw, fallback) {
  const list = normalizeCsv(raw);
  if (!list.length) {
    return fallback;
  }

  const hasPublicOrigin = list.some((entry) => {
    try {
      return !isLocalLikeHost(new URL(entry).hostname);
    } catch {
      return false;
    }
  });

  return hasPublicOrigin ? list.join(',') : fallback;
}

const rootDir = path.resolve(__dirname, '..', '..');
const backendEnvFromFiles = {
  ...parseEnvFile(path.join(rootDir, 'backend', '.env')),
  ...parseEnvFile(path.join(rootDir, 'backend', '.env.production')),
};
const shopEnvFromFiles = parseEnvFile(path.join(rootDir, 'shop', '.env'));

const sharedShopApiKey =
  process.env.SHOP_API_KEY ||
  shopEnvFromFiles.SHOP_API_KEY ||
  backendEnvFromFiles.SHOP_API_KEY;

const backendEnv = compactEnv({
  ...backendEnvFromFiles,
  NODE_ENV: 'production',
  PORT: 4000,
  BIND_HOST: '127.0.0.1',
  FRONTEND_URL:
    sanitizePublicUrl(backendEnvFromFiles.FRONTEND_URL, 'https://crm.technoprimestore.ru'),
  SHOP_PUBLIC_URL:
    sanitizePublicUrl(
      backendEnvFromFiles.SHOP_PUBLIC_URL || shopEnvFromFiles.SHOP_PUBLIC_URL,
      'https://technoprimestore.ru',
    ),
  CORS_ORIGINS: sanitizeCorsOrigins(
    backendEnvFromFiles.CORS_ORIGINS,
    'https://technoprimestore.ru,https://crm.technoprimestore.ru',
  ),
  WS_ORIGIN:
    sanitizePublicUrl(
      backendEnvFromFiles.WS_ORIGIN,
      'https://crm.technoprimestore.ru',
    ),
  SHOP_API_KEY: sharedShopApiKey,
});

const shopEnv = compactEnv({
  ...shopEnvFromFiles,
  NODE_ENV: 'production',
  PORT: 3000,
  HOST: '127.0.0.1',
  SHOP_PUBLIC_URL: sanitizePublicUrl(
    shopEnvFromFiles.SHOP_PUBLIC_URL || backendEnvFromFiles.SHOP_PUBLIC_URL,
    'https://technoprimestore.ru',
  ),
  NEXT_PUBLIC_SHOP_PUBLIC_URL: sanitizePublicUrl(
    shopEnvFromFiles.NEXT_PUBLIC_SHOP_PUBLIC_URL || shopEnvFromFiles.SHOP_PUBLIC_URL || backendEnvFromFiles.SHOP_PUBLIC_URL,
    'https://technoprimestore.ru',
  ),
  SHOP_API_BASE: shopEnvFromFiles.SHOP_API_BASE || 'http://127.0.0.1:4000/api',
  SHOP_API_KEY: sharedShopApiKey,
});

module.exports = {
  apps: [
    {
      name: 'technoprime-backend',
      cwd: path.join(rootDir, 'backend'),
      script: 'node',
      args: 'dist/src/main.js',
      env_production: backendEnv,
    },
    {
      name: 'technoprime-crm',
      cwd: path.join(rootDir, 'frontend'),
      script: 'npm',
      args: 'run start -- --hostname 127.0.0.1 --port 3001',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
      },
    },
    {
      name: 'technoprime-shop',
      cwd: path.join(rootDir, 'shop'),
      script: 'npm',
      args: 'run start -- --hostname 127.0.0.1 --port 3000',
      env_production: shopEnv,
    },
  ],
};
