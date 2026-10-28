import { isAppUrl } from './navigation.ts';

export const APP_PACKAGE = 'com.oxfordintelligence.oxfordbot';
export const SUBSCRIPTIONS = {
  [`${APP_PACKAGE}.pro.monthly`]: { plan: 'pro', period: 'P1M', basePlan: 'monthly' },
  [`${APP_PACKAGE}.pro.yearly`]: { plan: 'pro', period: 'P1Y', basePlan: 'yearly' },
  [`${APP_PACKAGE}.ultra.monthly`]: { plan: 'ultra', period: 'P1M', basePlan: 'monthly' },
  [`${APP_PACKAGE}.ultra.yearly`]: { plan: 'ultra', period: 'P1Y', basePlan: 'yearly' },
} as const;
export type BillingPlatform = 'apple' | 'google';
export type BillingAction = 'products' | 'purchase' | 'restore' | 'manage' | 'disconnect';
export type BillingRequest = {
  type: 'OXFORD_IAP'; version: 1; requestId: string; action: BillingAction;
  accessToken?: string; productId?: string;
};
export type DisplayProduct = {
  id: string; title: string; description: string; displayPrice: string;
  currency: string; period: 'P1M' | 'P1Y';
};
export type BillingReply = {
  type: 'OXFORD_IAP_RESULT'; version: 1; requestId: string; platform: BillingPlatform;
  status: 'products' | 'purchasing' | 'pending' | 'restored' | 'verified' | 'managed' | 'cancelled' | 'error';
  products?: DisplayProduct[]; canPurchase?: boolean;
  managementPlatform?: BillingPlatform | 'stripe' | null; errorCode?: string;
};

export function isSubscriptionId(value: unknown): value is keyof typeof SUBSCRIPTIONS {
  return typeof value === 'string' && Object.hasOwn(SUBSCRIPTIONS, value);
}

/** The event URL is provided by WebView; never trust a payload-supplied origin. */
export function parseBillingRequest(raw: string, sourceUrl: string): BillingRequest | null {
  if (!isAppUrl(sourceUrl) || typeof raw !== 'string' || raw.length > 18_000) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || Array.isArray(v) || v.type !== 'OXFORD_IAP' || v.version !== 1
      || typeof v.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(v.requestId)
      || !['products', 'purchase', 'restore', 'manage', 'disconnect'].includes(v.action)) return null;
    const needsAuth = ['products', 'purchase', 'restore'].includes(v.action);
    const allowed = ['type', 'version', 'requestId', 'action', ...(needsAuth ? ['accessToken'] : []), ...(v.action === 'purchase' ? ['productId'] : [])];
    if (Object.keys(v).some(k => !allowed.includes(k))) return null;
    if (needsAuth && (typeof v.accessToken !== 'string' || v.accessToken.length > 16_384
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.accessToken))) return null;
    if (v.action === 'purchase' && !isSubscriptionId(v.productId)) return null;
    return v as BillingRequest;
  } catch { return null; }
}

export function billingReplyScript(reply: BillingReply, pageUrl: string): string {
  if (!isAppUrl(pageUrl)) return 'true;';
  const data = JSON.stringify(JSON.stringify(reply)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `(function(){if(window.top===window && location.origin==='https://oxford.bot' && location.href===${JSON.stringify(pageUrl)}){window.dispatchEvent(new MessageEvent('message',{data:${data},origin:'https://oxford.bot'}));}})();true;`;
}

export const BILLING_CAPABILITY_SCRIPT = `(function(){if(window.top===window && location.origin==='https://oxford.bot' && window.ReactNativeWebView){window.__OXFORD_NATIVE_BILLING__={version:1};window.dispatchEvent(new Event('oxford-iap-ready'));}})();true;`;
