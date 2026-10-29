import { Platform } from 'react-native';
import * as IAP from 'expo-iap';
import { APP_PACKAGE, SUBSCRIPTIONS, subscriptionId, type BillingPlatform } from './billing-protocol';
import { BillingController, type BillingBackend, type BillingPort, type StoreProduct, type StorePurchase } from './billing-controller';

const API_ORIGIN = 'https://oxford.bot';

async function post(path: 'session' | 'verify', accessToken: string, body: object): Promise<unknown> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 25_000);
  try {
    const response = await fetch(`${API_ORIGIN}/api/public/billing/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'omit', redirect: 'error', body: JSON.stringify(body), signal: abort.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('BILLING_UNAVAILABLE');
    const data = await response.text();
    if (data.length > 16_384) throw new Error('BILLING_UNAVAILABLE');
    return JSON.parse(data);
  } finally { clearTimeout(timeout); }
}

function normalizePurchase(p: IAP.Purchase): StorePurchase {
  const apple = p.storeId === 'apple';
  return {
    productId: p.productId, transactionId: p.id, purchaseToken: p.purchaseToken ?? '',
    platform: apple ? 'apple' : 'google',
    state: p.storeId === 'apple' || p.storeId === 'play' ? p.purchaseState : 'unknown',
    accountIdentifier: apple ? (p as IAP.PurchaseIOS).appAccountToken ?? null : (p as IAP.PurchaseAndroid).obfuscatedAccountIdAndroid ?? null,
    suspended: !apple && Boolean((p as IAP.PurchaseAndroid).isSuspendedAndroid), native: p,
  };
}

function normalizeProduct(p: IAP.ProductOrSubscription, platform: BillingPlatform): StoreProduct | null {
  const canonicalId = subscriptionId(p.id, platform);
  if (!canonicalId || p.type !== 'subs' || p.platform !== (platform === 'apple' ? 'ios' : 'android')) return null;
  const expected = SUBSCRIPTIONS[canonicalId];
  let displayPrice = p.displayPrice;
  let currency = p.currency;
  let offerToken: string | undefined;
  if (p.platform === 'ios') {
    if (Number(p.subscriptionPeriodNumberIOS) !== 1 || p.subscriptionPeriodUnitIOS !== (expected.period === 'P1M' ? 'month' : 'year')) return null;
  } else {
    // Only the explicit base plan. Never pick the first promotional/trial offer.
    const offer = p.subscriptionOffers.find(o => o.basePlanIdAndroid === expected.basePlan
      && !o.installmentPlanDetailsAndroid && o.pricingPhasesAndroid?.pricingPhaseList.length === 1
      && o.pricingPhasesAndroid.pricingPhaseList[0].recurrenceMode === 1
      && o.pricingPhasesAndroid.pricingPhaseList[0].billingPeriod === expected.period);
    const phase = offer?.pricingPhasesAndroid?.pricingPhaseList[0];
    if (!offer?.offerTokenAndroid || !phase) return null;
    offerToken = offer.offerTokenAndroid; displayPrice = phase.formattedPrice; currency = phase.priceCurrencyCode;
  }
  if (!displayPrice || !currency) return null;
  return { id: p.id, title: p.title, description: p.description, displayPrice, currency, period: expected.period, ...(offerToken && { offerToken }) };
}

export function createNativeBilling() {
  const platform: BillingPlatform = Platform.OS === 'ios' ? 'apple' : 'google';
  const backend: BillingBackend = {
    session: (token, store) => post('session', token, { platform: store }),
    verify: (token, p) => post('verify', token, { platform: p.platform, productId: p.productId, transactionId: p.transactionId, purchaseToken: p.purchaseToken }),
  };
  const port: BillingPort = {
    connect: () => IAP.initConnection(),
    products: async ids => (await IAP.fetchProducts({ skus: ids, type: 'subs' }) ?? []).map(p => normalizeProduct(p, platform)).filter((p): p is StoreProduct => p !== null),
    purchase: async (product, session) => {
      try {
        await IAP.requestPurchase({ type: 'subs', request: {
          apple: { sku: product.id, appAccountToken: session.accountToken, andDangerouslyFinishTransactionAutomatically: false,
            ...(product.period === 'P1Y' && { billingPlanType: 'up-front' as const }) },
          google: { skus: [product.id], obfuscatedAccountId: session.googleAccountId,
            subscriptionOffers: [{ sku: product.id, offerToken: product.offerToken! }] },
        } });
      } catch (error) { throw new Error(IAP.isUserCancelledError(error) ? 'USER_CANCELLED' : 'STORE_UNAVAILABLE'); }
    },
    purchases: async sync => {
      if (sync && platform === 'apple') await IAP.syncIOS();
      return (await IAP.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true, alsoPublishToEventListenerIOS: false })).map(normalizePurchase);
    },
    finish: p => IAP.finishTransaction({ purchase: p.native as IAP.Purchase, isConsumable: false }),
    manage: async () => {
      if (platform === 'apple') await IAP.showManageSubscriptionsIOS();
      else await IAP.deepLinkToSubscriptions({ packageNameAndroid: APP_PACKAGE });
    },
  };
  const controller = new BillingController(platform, port, backend);
  // Register before initConnection: unfinished transactions may replay immediately.
  const purchases = IAP.purchaseUpdatedListener(p => { void controller.onPurchase(normalizePurchase(p)); });
  const errors = IAP.purchaseErrorListener(e => controller.onError(IAP.isUserCancelledError(e)));
  return {
    controller,
    dispose() { controller.disconnect(); purchases.remove(); errors.remove(); void IAP.endConnection().catch(() => {}); },
  };
}
