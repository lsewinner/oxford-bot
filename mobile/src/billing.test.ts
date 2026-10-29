import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { BillingController, parseBillingSession, type BillingBackend, type BillingPort, type BillingSession, type StoreProduct, type StorePurchase } from './billing-controller.ts';
import { SUBSCRIPTIONS, billingReplyScript, isStoreSubscriptionId, parseBillingRequest, storeProductId, subscriptionId, type BillingPlatform, type BillingReply, type BillingRequest } from './billing-protocol.ts';

const productId = Object.keys(SUBSCRIPTIONS)[0];
const accountToken = '00000000-0000-4000-8000-000000000001';
const otherAccount = '00000000-0000-4000-8000-000000000002';
const token = 'testBearer.payload.signature';
const origin = 'https://oxford.bot/pricing';
const product: StoreProduct = { id: productId, title: 'Oxford Pro', description: 'Monthly', displayPrice: '£24.99', currency: 'GBP', period: 'P1M', offerToken: 'store-offer' };
function request(action: BillingRequest['action'], requestId: string = action): BillingRequest {
  return { type: 'OXFORD_IAP', version: 1, requestId, action, ...(['products', 'purchase', 'restore'].includes(action) && { accessToken: token }), ...(action === 'purchase' && { productId }) };
}
function fixture(platform: BillingPlatform = 'apple') {
  const platformProductId = storeProductId(productId, platform)!;
  const session: BillingSession = { ready: true, accountToken, googleAccountId: 'opaque-account-id-001', canPurchase: true, managementPlatform: null, enabledProductIds: [platformProductId] };
  const purchase: StorePurchase = { productId: platformProductId, transactionId: '10001', purchaseToken: 'signed-proof', platform, state: 'purchased', accountIdentifier: platform === 'apple' ? accountToken : session.googleAccountId, suspended: false, native: {} };
  const calls = { connects: 0, purchases: 0, verifies: 0, finishes: 0, sync: 0, management: 0 };
  const replies: BillingReply[] = [];
  const owned: StorePurchase[] = [];
  const port: BillingPort = {
    connect: async () => { calls.connects++; return true; },
    products: async ids => { assert.deepEqual(ids, session.enabledProductIds); return [{ ...product, id: platformProductId }]; },
    purchase: async (selected, context) => { calls.purchases++; assert.equal(selected.id, platformProductId); assert.equal(context.accountToken, accountToken); },
    purchases: async sync => { if (sync) calls.sync++; return owned; },
    finish: async () => { calls.finishes++; },
    manage: async () => { calls.management++; },
  };
  const backend: BillingBackend = {
    session: async bearer => { assert.equal(bearer, token); return session; },
    verify: async (bearer, receipt) => { calls.verifies++; assert.equal(bearer, token); assert.equal(receipt.productId, platformProductId); return { verified: true, productId: platformProductId, accountToken, acknowledged: true }; },
  };
  const controller = new BillingController(platform, port, backend);
  const handle = (r: BillingRequest) => controller.handle(r, reply => replies.push(reply));
  return { controller, calls, replies, session, purchase, port, backend, owned, handle };
}

test('billing bridge requires exact app origin, bounded request IDs and current auth', () => {
  const good = request('purchase');
  assert.deepEqual(parseBillingRequest(JSON.stringify(good), origin), good);
  for (const url of ['https://oxford.bot.evil.test/pricing', 'http://oxford.bot', 'https://user@oxford.bot']) assert.equal(parseBillingRequest(JSON.stringify(good), url), null);
  for (const bad of [{ ...good, accessToken: 'not-a-token' }, { ...good, userId: otherAccount }, { ...good, productId: 'forged' }, { ...good, requestId: "');evil()//" }, { ...good, accessToken: 'a'.repeat(18000) }, { ...good, endpoint: 'https://evil.test' }, { ...request('manage'), accessToken: token }]) {
    assert.equal(parseBillingRequest(JSON.stringify(bad), origin), null);
  }
});

test('billing reply remains data and is delivered only to its originating document', () => {
  const received: unknown[] = [];
  const reply: BillingReply = { type: 'OXFORD_IAP_RESULT', version: 1, requestId: 'x', platform: 'apple', status: 'error', errorCode: "');globalThis.pwned=true;//" };
  const window = { top: null as unknown, dispatchEvent: (e: { data: string }) => received.push(JSON.parse(e.data)) };
  window.top = window;
  const context = vm.createContext({ window, location: { origin: 'https://oxford.bot', href: origin }, MessageEvent: class { data: string; constructor(_type: string, fields: { data: string }) { this.data = fields.data; } } });
  vm.runInContext(billingReplyScript(reply, origin), context);
  assert.deepEqual(received, [reply]); assert.equal(context.pwned, undefined);
  context.location.href = 'https://oxford.bot/auth';
  vm.runInContext(billingReplyScript(reply, origin), context);
  assert.equal(received.length, 1);
});

test('backend session shape cannot enable purchases with unbound accounts or unknown products', () => {
  const { session } = fixture();
  for (const bad of [{ ...session, ready: 'true' }, { ...session, accountToken: 'email@example.com' }, { ...session, enabledProductIds: ['anything'] }, { ...session, googleAccountId: 'a@b.example' }]) assert.throws(() => parseBillingSession(bad, 'apple'));
});

test('Google catalog fits Play limits and maps each fixed bridge ID without changing Apple IDs', () => {
  const pairs = [
    ['com.oxfordintelligence.oxfordbot.pro.monthly', 'oxfordbot.pro.monthly'],
    ['com.oxfordintelligence.oxfordbot.pro.yearly', 'oxfordbot.pro.yearly'],
    ['com.oxfordintelligence.oxfordbot.ultra.monthly', 'oxfordbot.ultra.monthly'],
    ['com.oxfordintelligence.oxfordbot.ultra.yearly', 'oxfordbot.ultra.yearly'],
  ];
  assert.deepEqual(Object.keys(SUBSCRIPTIONS), pairs.map(([canonical]) => canonical));
  assert.equal(new Set(pairs.map(([canonical]) => storeProductId(canonical, 'google'))).size, 4);
  for (const [canonical, googleId] of pairs) {
    assert.equal(storeProductId(canonical, 'apple'), canonical);
    assert.equal(subscriptionId(canonical, 'apple'), canonical);
    assert.equal(storeProductId(canonical, 'google'), googleId);
    assert.equal(subscriptionId(googleId, 'google'), canonical);
    assert.match(googleId, /^[a-z0-9][a-z0-9._]*$/);
    assert.ok(googleId.length <= 40);
    assert.equal(isStoreSubscriptionId(canonical, 'google'), false);
    assert.equal(isStoreSubscriptionId(googleId, 'apple'), false);
    assert.equal(parseBillingRequest(JSON.stringify({ ...request('purchase'), productId: googleId }), origin), null);
  }
  assert.equal(storeProductId('forged', 'google'), null);
  assert.equal(subscriptionId('forged', 'google'), null);
});

test('platform session rejects legacy Google and cross-platform IDs before opening the store', async () => {
  for (const platform of ['apple', 'google'] as const) {
    const f = fixture(platform);
    assert.deepEqual(parseBillingSession(f.session, platform), f.session);
    f.session.enabledProductIds = [platform === 'google' ? productId : 'oxfordbot.pro.monthly'];
    await f.handle(request('purchase'));
    assert.equal(f.replies.at(-1)?.errorCode, 'NOT_READY');
    assert.equal(f.calls.connects, 0); assert.equal(f.calls.purchases, 0);
  }
});

test('Google products and purchases translate only at the WebView boundary', async () => {
  const f = fixture('google');
  let fetched: string[] = [];
  f.port.products = async ids => {
    fetched = ids;
    return [{ ...product, id: 'oxfordbot.pro.monthly' }, { ...product, id: productId }, { ...product, id: 'forged' }];
  };
  await f.handle(request('products'));
  assert.deepEqual(fetched, ['oxfordbot.pro.monthly']);
  assert.deepEqual(f.replies[0].products, [{
    id: productId, title: product.title, description: product.description,
    displayPrice: product.displayPrice, currency: product.currency, period: product.period,
  }]);
  assert.ok(!JSON.stringify(f.replies).includes('store-offer'));
  await f.handle(request('purchase'));
  assert.equal(f.calls.purchases, 1);
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.calls.verifies, 1);
  assert.equal(f.replies.at(-1)?.status, 'verified');
});

test('Google restore verifies actual owned store IDs even when unavailable for new purchases', async () => {
  const f = fixture('google'); f.session.enabledProductIds = [];
  f.owned.push(f.purchase);
  await f.handle(request('restore'));
  assert.equal(f.calls.verifies, 1); assert.equal(f.calls.finishes, 0);
  assert.equal(f.replies.at(-1)?.status, 'restored');
});

test('Google rejects canonical receipt IDs and mismatched platform before verification', async () => {
  const f = fixture('google'); await f.handle(request('products'));
  await f.controller.onPurchase({ ...f.purchase, productId });
  await f.controller.onPurchase({ ...f.purchase, platform: 'apple' });
  assert.equal(f.calls.verifies, 0);
  assert.ok(!f.replies.some(r => r.status === 'verified'));
});

test('Google verification must echo its actual short store ID, not the canonical bridge ID', async () => {
  const f = fixture('google'); await f.handle(request('purchase'));
  f.backend.verify = async (_bearer, receipt) => {
    assert.equal(receipt.productId, 'oxfordbot.pro.monthly');
    return { verified: true, accountToken, productId, acknowledged: true };
  };
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.replies.at(-1)?.errorCode, 'VERIFICATION_DELAYED');
  assert.equal(f.calls.finishes, 0);
});

test('Google resume reconciles only known actual store IDs', async () => {
  const f = fixture('google'); await f.handle(request('products'));
  f.owned.push({ ...f.purchase, productId }, f.purchase);
  await f.controller.resume();
  assert.equal(f.calls.verifies, 1);
  assert.equal(f.replies.at(-1)?.status, 'verified');
});

test('missing server configuration blocks purchase before opening the store', async () => {
  const f = fixture(); f.session.ready = false;
  await f.handle(request('purchase'));
  assert.equal(f.calls.connects, 0); assert.equal(f.calls.purchases, 0);
  assert.equal(f.replies.at(-1)?.errorCode, 'NOT_READY');
});

test('existing Stripe membership blocks a second store purchase', async () => {
  const f = fixture(); f.session.canPurchase = false; f.session.managementPlatform = 'stripe';
  await f.handle(request('purchase'));
  assert.equal(f.calls.purchases, 0); assert.equal(f.replies.at(-1)?.errorCode, 'ALREADY_SUBSCRIBED');
});

test('prices come from the store and messages do not leak bearer or offer tokens', async () => {
  const f = fixture(); await f.handle(request('products'));
  assert.equal(f.replies[0].products?.[0].displayPrice, '£24.99');
  assert.ok(!JSON.stringify(f.replies).includes(token));
  assert.ok(!JSON.stringify(f.replies).includes('store-offer'));
});

test('purchase request resolution is not success; receipt must verify before Apple finish', async () => {
  const f = fixture(); await f.handle(request('purchase'));
  assert.deepEqual(f.replies.map(x => x.status), ['purchasing']); assert.equal(f.calls.finishes, 0);
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.calls.verifies, 1); assert.equal(f.calls.finishes, 1);
  assert.equal(f.replies.at(-1)?.status, 'verified');
  assert.ok(!JSON.stringify(f.replies).includes('signed-proof'));
});

test('pending payments cannot verify, finish, or report restored access', async () => {
  const f = fixture(); f.purchase.state = 'pending'; f.owned.push(f.purchase);
  await f.handle(request('restore'));
  assert.equal(f.calls.verifies, 0); assert.equal(f.calls.finishes, 0);
  assert.equal(f.replies.at(-1)?.status, 'pending');
});

test('store account mismatch and suspended purchases never reach verification', async () => {
  for (const change of [{ accountIdentifier: otherAccount }, { suspended: true }, { platform: 'google' as const }]) {
    const f = fixture(); await f.handle(request('products'));
    await f.controller.onPurchase({ ...f.purchase, ...change });
    assert.equal(f.calls.verifies, 0); assert.equal(f.calls.finishes, 0);
    assert.equal(f.replies.at(-1)?.status, 'error');
  }
});

test('failed or misbound server verification leaves the transaction unfinished', async () => {
  for (const result of [null, { verified: false }, { verified: true, accountToken: otherAccount, productId }, { verified: true, accountToken, productId: 'wrong' }]) {
    const f = fixture(); f.backend.verify = async () => result;
    await f.handle(request('purchase')); await f.controller.onPurchase(f.purchase);
    assert.equal(f.calls.finishes, 0); assert.equal(f.replies.at(-1)?.errorCode, 'VERIFICATION_DELAYED');
  }
});

test('Google success requires backend acknowledgement and never client acknowledgement', async () => {
  const f = fixture('google'); await f.handle(request('purchase'));
  f.backend.verify = async () => ({ verified: true, accountToken, productId: f.purchase.productId });
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.replies.at(-1)?.errorCode, 'VERIFICATION_DELAYED');
  f.backend.verify = async () => ({ verified: true, accountToken, productId: f.purchase.productId, acknowledged: true });
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.replies.at(-1)?.status, 'verified'); assert.equal(f.calls.finishes, 0);
});

test('replayed requests and overlapping store events cannot duplicate purchase or finish', async () => {
  const f = fixture(); await f.handle(request('purchase')); await f.handle(request('purchase'));
  assert.equal(f.calls.purchases, 1);
  let finishVerify!: (value: object) => void;
  f.backend.verify = async () => { f.calls.verifies++; return new Promise(resolve => { finishVerify = resolve; }); };
  const a = f.controller.onPurchase(f.purchase); const b = f.controller.onPurchase(f.purchase);
  assert.equal(f.calls.verifies, 1);
  finishVerify({ verified: true, productId, accountToken }); await Promise.all([a, b]);
  assert.equal(f.calls.finishes, 1);
});

test('store-owned membership is reconciled before any new purchase sheet', async () => {
  const f = fixture(); f.owned.push(f.purchase); await f.handle(request('purchase'));
  assert.equal(f.calls.purchases, 0); assert.equal(f.calls.verifies, 1);
  assert.equal(f.replies.at(-1)?.errorCode, 'RESTORE_OR_MANAGE');
});

test('replayed finished Apple transaction rechecks server state without finishing twice', async () => {
  const f = fixture(); await f.handle(request('purchase'));
  await f.controller.onPurchase(f.purchase); await f.controller.onPurchase(f.purchase);
  assert.equal(f.calls.verifies, 2); assert.equal(f.calls.finishes, 1);
  f.backend.verify = async () => ({ verified: false });
  await f.controller.onPurchase(f.purchase);
  assert.equal(f.replies.at(-1)?.errorCode, 'VERIFICATION_DELAYED');
});

test('disconnect invalidates an in-flight preflight and clears account context', async () => {
  const f = fixture(); let resolveSession!: (value: object) => void;
  f.backend.session = async () => new Promise(resolve => { resolveSession = resolve; });
  const work = f.handle(request('purchase')); f.controller.disconnect(); resolveSession(f.session); await work;
  assert.equal(f.calls.purchases, 0); assert.equal(f.replies.length, 0);
  await f.controller.onPurchase(f.purchase); assert.equal(f.calls.verifies, 0);
});

test('account switch while verification is pending cannot notify the new document', async () => {
  const f = fixture(); await f.handle(request('purchase'));
  let resolveVerify!: (value: object) => void;
  f.backend.verify = async () => new Promise(resolve => { resolveVerify = resolve; });
  const work = f.controller.onPurchase(f.purchase); f.controller.disconnect();
  resolveVerify({ verified: true, productId, accountToken }); await work;
  assert.equal(f.calls.finishes, 1); assert.deepEqual(f.replies.map(x => x.status), ['purchasing']);
});

test('explicit restore syncs and verifies; empty restore is not successful', async () => {
  const f = fixture(); await f.handle(request('restore'));
  assert.equal(f.replies.at(-1)?.errorCode, 'NO_PURCHASES');
  f.owned.push(f.purchase); await f.handle(request('restore', 'second'));
  assert.equal(f.calls.sync, 2); assert.equal(f.calls.verifies, 1);
  assert.equal(f.replies.at(-1)?.status, 'restored');
});

test('user cancellation is distinct from billing failure', async () => {
  const f = fixture(); await f.handle(request('purchase')); f.controller.onError(true);
  assert.equal(f.replies.at(-1)?.status, 'cancelled'); assert.equal(f.calls.finishes, 0);
});
