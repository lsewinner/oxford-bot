# OXFORD BOT subscription integration

Status: native adapter prepared; web/backend integration, store pricing and sandbox
acceptance remain required. Do not build a release from this branch yet.

## Store products

Bundle/package: `com.oxfordintelligence.oxfordbot`. Apple app: `6824852336`.
Apple subscription group: `22521889` (OXFORD BOT Membership).

| Product ID suffix after bundle/package | Apple ID | Period | Apple level | Planned Google base plan |
| --- | --- | --- | --- | --- |
| `.pro.monthly` | 6827915970 | P1M | 2 | monthly |
| `.pro.yearly` | 6827916442 | P1Y | 2 | yearly |
| `.ultra.monthly` | 6827918465 | P1M | 1 | monthly |
| `.ultra.yearly` | 6827919084 | P1Y | 1 | yearly |

Apple products exist as drafts, with no price or availability configured yet.
Google products/base plans do not exist yet. Existing web USD prices are Pro
25/month or 240/year and Ultra 60/month or 576/year. Never hardcode these as the
native localized price. No trials, installment contracts or Family Sharing are
implemented. Review Apple's default multi-seat purchase options before release.

## Web bridge

Capability: `window.__OXFORD_NATIVE_BILLING__ = { version: 1 }`, announced with
`oxford-iap-ready`. Old shells must show an update requirement and must never fall
back to Stripe checkout. The current UA marker remains `OxfordBotMobile/0.1`.

Post JSON through `window.ReactNativeWebView.postMessage`:

```ts
{
  type: 'OXFORD_IAP', version: 1,
  requestId: string, // 1–64 ASCII letters, digits, underscores, hyphens
  action: 'products' | 'purchase' | 'restore' | 'manage' | 'disconnect',
  accessToken?: string, // Current Supabase access token; required only for products/purchase/restore
  productId?: string // Required only for purchase, from the fixed catalog
}
```

Do not log, persist or include the access token in URLs. Send `disconnect` on
logout/account change. Native also clears context on document navigation. No
caller-supplied account IDs, receipt destinations or checkout URLs are accepted.

Native replies on `window`'s `message` event with JSON in `event.data`:

```ts
{
  type: 'OXFORD_IAP_RESULT', version: 1, requestId: string,
  platform: 'apple' | 'google',
  status: 'products' | 'purchasing' | 'pending' | 'restored' | 'verified' |
          'managed' | 'cancelled' | 'error',
  products?: { id: string, title: string, description: string,
               displayPrice: string, currency: string, period: 'P1M' | 'P1Y' }[],
  canPurchase?: boolean,
  managementPlatform?: 'apple' | 'google' | 'stripe' | null,
  errorCode?: string
}
```

Replies never contain receipts, bearer tokens or offer tokens. Treat them as UI
signals and re-query server entitlements; they are not authorization. A
`purchasing` response only means the platform purchase sheet was requested.
`pending` never grants access. Use neutral localized error messages and keep
implementation details out of the customer flow.

Error codes: `BUSY`, `NOT_READY`, `STORE_UNAVAILABLE`, `ALREADY_SUBSCRIBED`,
`PRODUCT_UNAVAILABLE`, `RESTORE_OR_MANAGE`, `NO_PURCHASES`, `BILLING_UNAVAILABLE`,
`PURCHASE_NOT_VALID`, `ACCOUNT_MISMATCH`, `VERIFICATION_DELAYED`.

## Server endpoints required before enabling purchases

Both endpoints are fixed under `https://oxford.bot/api/public/billing/`, use POST
JSON and `Authorization: Bearer <current access token>`. Neither accepts a user ID
from the caller. Authenticate the real current user and enforce account deletion,
bans, environment isolation and ownership on the server.

`session`: request `{platform:'apple'|'google'}`; response:

```ts
{ ready: boolean, accountToken: string /* server-bound UUID */,
  googleAccountId: string /* stable, opaque 16–64 ASCII identifier, no PII */,
  canPurchase: boolean, managementPlatform: 'apple'|'google'|'stripe'|null,
  enabledProductIds: string[] }
```

Return `ready:false` until verification, credentials and enabled products are
actually ready for this platform and deployment environment. Return
`canPurchase:false` for an existing paid subscription in any channel. The client
also reconciles store-owned purchases before opening a new payment sheet.

`verify`: request `{platform, productId, transactionId, purchaseToken}`. Apple
purchaseToken is the StoreKit 2 JWS; Google uses its purchase token. Validate the
store, bundle/package, environment, product, account identifier, state, expiry,
refund/revocation and unique ownership with Apple/Google before persisting rights.
Use atomic/idempotent records and do not rely on client receipt fields. Return
non-2xx while unavailable; never return a placeholder success. Success response:

```ts
{ verified:true, productId:string, accountToken:string, acknowledged?:true }
```

For Google, grant durably then acknowledge on the server before returning
`acknowledged:true`; client success requires this flag. Apple is finished by the
native adapter only after verified response. A failure leaves transactions for
later reconciliation and restore, without reporting access granted.

## Remaining integration

- Web native paywall, auth-aware bridge lifecycle and server entitlement refresh.
- Signed store notifications and server-side renewal/refund/expiry processing.
- Secure Apple Server API key and Google Publisher credentials, no client secrets.
- Google app, products, base plans, license testers and authenticated RTDN.
- Apple pricing/localization/availability/review screenshot and sandbox testers.
- Account deletion disclosures: Apple/Google auto-renewal is not automatically
  cancelled by deleting the app account; preserve minimal anti-replay tombstones.
- Confirm upgrade/downgrade, fresh install restore, interrupted transactions,
  account changes and native signing/build compatibility on real devices.

The independent Lovable web/backend task
`umsg_01m60wt12ae7yvthds1rkfsn1y` returned `stopped` before edits. Its final state
must not be described as an implemented backend. Resume it deliberately after
clarifying that stop, and align it to this contract before deployment.
