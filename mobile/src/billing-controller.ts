import { isSubscriptionId, type BillingPlatform, type BillingReply, type BillingRequest, type DisplayProduct } from './billing-protocol.ts';

export type BillingSession = {
  ready: boolean; accountToken: string; googleAccountId: string; canPurchase: boolean;
  managementPlatform: BillingPlatform | 'stripe' | null; enabledProductIds: string[];
};
export type StoreProduct = DisplayProduct & { offerToken?: string };
export type StorePurchase = {
  productId: string; transactionId: string; purchaseToken: string;
  platform: BillingPlatform; state: 'pending' | 'purchased' | 'unknown';
  accountIdentifier: string | null; suspended: boolean; native: unknown;
};
export interface BillingPort {
  connect(): Promise<boolean>;
  products(ids: string[]): Promise<StoreProduct[]>;
  purchase(product: StoreProduct, session: BillingSession): Promise<void>;
  purchases(sync: boolean): Promise<StorePurchase[]>;
  finish(purchase: StorePurchase): Promise<void>;
  manage(): Promise<void>;
}
export interface BillingBackend {
  session(accessToken: string, platform: BillingPlatform): Promise<unknown>;
  verify(accessToken: string, purchase: StorePurchase): Promise<unknown>;
}
type Context = { request: BillingRequest; session: BillingSession; revision: number; send: (reply: BillingReply) => void };
class BillingFailure extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBillingSession(value: unknown): BillingSession {
  const v = value as BillingSession | null;
  if (!v || typeof v.ready !== 'boolean' || typeof v.canPurchase !== 'boolean'
    || typeof v.accountToken !== 'string' || !uuid.test(v.accountToken)
    || typeof v.googleAccountId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(v.googleAccountId)
    || ![null, 'apple', 'google', 'stripe'].includes(v.managementPlatform)
    || !Array.isArray(v.enabledProductIds) || v.enabledProductIds.length > 4
    || !v.enabledProductIds.every(isSubscriptionId)) throw new BillingFailure('NOT_READY');
  return v;
}

/** No entitlement is granted here. Only the authenticated server can grant it. */
export class BillingController {
  private revision = 0;
  private active?: Context;
  private pending?: Context;
  private busy = false;
  private connecting?: Promise<boolean>;
  private seen = new Set<string>();
  private verification = new Map<string, Promise<boolean>>();
  private finished = new Set<string>();
  private platform: BillingPlatform;
  private port: BillingPort;
  private backend: BillingBackend;
  constructor(platform: BillingPlatform, port: BillingPort, backend: BillingBackend) {
    this.platform = platform; this.port = port; this.backend = backend;
  }

  disconnect() { this.revision++; this.active = undefined; this.pending = undefined; }

  private reply(ctx: Context, status: BillingReply['status'], fields: Partial<BillingReply> = {}) {
    if (ctx.revision === this.revision) ctx.send({ ...fields, type: 'OXFORD_IAP_RESULT', version: 1, requestId: ctx.request.requestId, platform: this.platform, status });
  }

  private async connect() {
    this.connecting ??= this.port.connect().catch(() => false);
    if (!(await this.connecting)) { this.connecting = undefined; throw new BillingFailure('STORE_UNAVAILABLE'); }
  }

  async handle(request: BillingRequest, send: (reply: BillingReply) => void) {
    if (request.action === 'disconnect') { this.disconnect(); return; }
    const fallback = { request, send, revision: this.revision, session: null as unknown as BillingSession };
    if (this.seen.has(request.requestId)) return; // A replay must not open a second payment sheet.
    if (this.busy || (this.pending && request.action === 'purchase')) { this.reply(fallback, 'error', { errorCode: 'BUSY' }); return; }
    this.seen.add(request.requestId);
    if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value!);
    this.busy = true;
    try {
      if (request.action === 'manage') {
        await this.port.manage(); this.reply(fallback, 'managed'); return;
      }
      const session = parseBillingSession(await this.backend.session(request.accessToken!, this.platform));
      if (fallback.revision !== this.revision) return;
      const ctx: Context = { ...fallback, session };
      if (this.active && this.active.session.accountToken !== session.accountToken) {
        this.revision++; this.pending = undefined; ctx.revision = this.revision;
      }
      this.active = ctx;
      if (!session.ready) {
        this.reply(ctx, request.action === 'products' ? 'products' : 'error', { products: [], canPurchase: false, managementPlatform: session.managementPlatform, errorCode: 'NOT_READY' }); return;
      }
      await this.connect();
      if (ctx.revision !== this.revision) return;
      if (request.action === 'restore') {
        const purchases = (await this.port.purchases(true)).filter(p => isSubscriptionId(p.productId));
        if (!purchases.length) throw new BillingFailure('NO_PURCHASES');
        let allVerified = true;
        for (const purchase of purchases) allVerified = (await this.process(purchase, ctx)) && allVerified;
        if (allVerified) this.reply(ctx, 'restored');
        return;
      }
      const products = (await this.port.products(session.enabledProductIds)).filter(p => session.enabledProductIds.includes(p.id));
      if (ctx.revision !== this.revision) return;
      if (request.action === 'products') {
        this.reply(ctx, 'products', { products: products.map(({ offerToken: _, ...p }) => p), canPurchase: session.canPurchase, managementPlatform: session.managementPlatform });
        return;
      }
      if (!session.canPurchase || session.managementPlatform !== null) throw new BillingFailure('ALREADY_SUBSCRIBED');
      const product = products.find(p => p.id === request.productId);
      if (!product) throw new BillingFailure('PRODUCT_UNAVAILABLE');
      // Reconcile store-owned purchases before opening a new purchase sheet.
      const owned = (await this.port.purchases(false)).filter(p => isSubscriptionId(p.productId));
      if (owned.length) {
        for (const purchase of owned) await this.process(purchase, ctx);
        throw new BillingFailure('RESTORE_OR_MANAGE');
      }
      if (ctx.revision !== this.revision) return;
      this.pending = ctx;
      this.reply(ctx, 'purchasing');
      await this.port.purchase(product, session);
      // StoreKit / Play completes via the transaction listener, not this promise.
    } catch (error) {
      if (this.pending?.request.requestId === request.requestId) this.pending = undefined;
      const cancelled = error instanceof Error && error.message === 'USER_CANCELLED';
      this.reply(this.active?.request.requestId === request.requestId ? this.active : fallback, cancelled ? 'cancelled' : 'error', cancelled ? {} : { errorCode: error instanceof BillingFailure ? error.code : 'BILLING_UNAVAILABLE' });
    } finally { this.busy = false; }
  }

  async onPurchase(purchase: StorePurchase) {
    const ctx = this.pending ?? this.active;
    if (!ctx || !isSubscriptionId(purchase.productId)) return;
    await this.process(purchase, ctx);
  }

  onError(cancelled: boolean) {
    const ctx = this.pending;
    this.pending = undefined;
    if (ctx) this.reply(ctx, cancelled ? 'cancelled' : 'error', cancelled ? {} : { errorCode: 'STORE_UNAVAILABLE' });
  }

  async resume() {
    const ctx = this.active;
    if (!ctx?.session.ready) return;
    try {
      await this.connect();
      for (const p of await this.port.purchases(false)) if (isSubscriptionId(p.productId)) await this.process(p, ctx);
    } catch { /* Keep unfinished transactions for the next explicit restore. */ }
  }

  private async process(purchase: StorePurchase, ctx: Context): Promise<boolean> {
    if (ctx.revision !== this.revision || !ctx.session.ready) return false;
    if (purchase.state === 'pending') { this.reply(ctx, 'pending'); return false; }
    if (purchase.state !== 'purchased' || purchase.suspended || purchase.platform !== this.platform
      || !isSubscriptionId(purchase.productId) || !purchase.purchaseToken || purchase.purchaseToken.length > 65_536) {
      this.reply(ctx, 'error', { errorCode: 'PURCHASE_NOT_VALID' }); return false;
    }
    const account = this.platform === 'apple' ? ctx.session.accountToken : ctx.session.googleAccountId;
    const matchesAccount = this.platform === 'apple'
      ? purchase.accountIdentifier?.toLowerCase() === account.toLowerCase()
      : purchase.accountIdentifier === account;
    if (!matchesAccount) {
      this.reply(ctx, 'error', { errorCode: 'ACCOUNT_MISMATCH' }); return false;
    }
    const key = `${account}:${purchase.purchaseToken}`;
    const existing = this.verification.get(key);
    if (existing) return existing;
    const work = (async () => {
      try {
        const result = await this.backend.verify(ctx.request.accessToken!, purchase) as Record<string, unknown> | null;
        if (!result || result.verified !== true || result.productId !== purchase.productId || result.accountToken !== ctx.session.accountToken
          || (this.platform === 'google' && result.acknowledged !== true)) throw new BillingFailure('VERIFICATION_FAILED');
        // Google is acknowledged by the server; Apple is finished only after durable verification.
        const transactionKey = `${account}:${purchase.transactionId}`;
        if (this.platform === 'apple' && !this.finished.has(transactionKey)) {
          await this.port.finish(purchase);
          this.finished.add(transactionKey);
          if (this.finished.size > 100) this.finished.delete(this.finished.values().next().value!);
        }
        this.reply(ctx, 'verified');
        if (this.pending === ctx) this.pending = undefined;
        return true;
      } catch {
        this.reply(ctx, 'error', { errorCode: 'VERIFICATION_DELAYED' });
        if (this.pending === ctx) this.pending = undefined;
        return false;
      }
    })();
    this.verification.set(key, work);
    void work.finally(() => { if (this.verification.get(key) === work) this.verification.delete(key); });
    return work;
  }
}
