/**
 * Stripe for the booking server: Checkout sessions (the payment page hosted by Stripe: card,
 * Apple Pay, Google Pay) and signed webhooks. Plain fetch and Web Crypto, no SDK.
 *   env.STRIPE_SECRET_KEY: sk_live_… (or sk_test_… while testing) (secret)
 *   env.STRIPE_WEBHOOK_SECRET: whsec_… of the webhook endpoint (secret)
 */
const API = 'https://api.stripe.com/v1';

/** nested objects to Stripe's form encoding: a[b][0][c]=… */
export function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(env, method, path, params) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(params ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), 'stripe-version': '2024-06-20' },
    body: params ? formEncode(params) : undefined,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`stripe ${path.split('?')[0]} ${res.status} ${j?.error?.message || ''}`);
  return j;
}

export const createSession = (env, params) => call(env, 'POST', '/checkout/sessions', params);
export const getSession = (env, id) => call(env, 'GET', `/checkout/sessions/${encodeURIComponent(id)}`);
export const expireSession = (env, id) => call(env, 'POST', `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Checks the Stripe-Signature header of a webhook (HMAC-SHA256 of "t.payload" with the endpoint
 * secret, at most `tolerance` seconds old). Returns the parsed event, or null.
 */
export async function verifyWebhook(payload, header, secret, tolerance = 300, now = Date.now()) {
  if (!header || !secret) return null;
  const parts = header.split(',').map((p) => p.trim());
  const t = parts.find((p) => p.startsWith('t='))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > tolerance) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  // constant time comparison
  const same = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
  if (!sigs.some((s) => same(s, expected))) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
