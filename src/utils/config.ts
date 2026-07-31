const USE_B2 = import.meta.env.USE_B2 === 'true' || import.meta.env.USE_B2 === true;
const B2_PROXY_URL = import.meta.env.B2_PROXY_URL || '';
const B2_PREFIX = import.meta.env.B2_PREFIX || '';

export function isB2Enabled(): boolean {
  return USE_B2 && !!B2_PROXY_URL;
}

export function getProxyUrl(): string {
  return B2_PROXY_URL;
}

export function getB2Prefix(): string {
  return B2_PREFIX;
}
