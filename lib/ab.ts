export type ABVariant = 'A' | 'B';

const COOKIE_NAME = 'ab_test_variant';
const COOKIE_TTL_DAYS = 14; // keep variant sticky for 2 weeks
const FORCED_VARIANT = (process.env.NEXT_PUBLIC_FORCE_AB as ABVariant | undefined);

function setCookie(name: string, value: string, days: number) {
  try {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  return match ? match.split('=')[1] : undefined;
}

export function pickRandomVariant(): ABVariant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

export function getVariant(): ABVariant {
  // If a branch or environment forces a specific variant, honor it
  if (FORCED_VARIANT === 'A' || FORCED_VARIANT === 'B') {
    setCookie(COOKIE_NAME, FORCED_VARIANT, COOKIE_TTL_DAYS);
    return FORCED_VARIANT;
  }
  const fromCookie = (getCookie(COOKIE_NAME) as ABVariant | undefined);
  if (fromCookie === 'A' || fromCookie === 'B') return fromCookie;
  const v = pickRandomVariant();
  setCookie(COOKIE_NAME, v, COOKIE_TTL_DAYS);
  return v;
}

export function setVariant(v: ABVariant) {
  setCookie(COOKIE_NAME, v, COOKIE_TTL_DAYS);
}

