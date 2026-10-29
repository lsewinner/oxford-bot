# OXFORD BOT subscription integration

Status (2026-10-29): platform-specific Google product IDs are prepared in source.
Backend compatibility has not been verified: this snapshot contains only the
mobile client, not the deployed web or billing server implementation. Review the
Google backend contract below before preparing a replacement Android build. Do
not submit or enable Google sales until the integration has been tested with that
replacement client.

## Store products

Bundle/package: `com.oxfordintelligence.oxfordbot`. Apple app: `6824852336`.
Apple subscription group: `22521889` (OXFORD BOT Membership).

| Stable Web bridge ID / existing Apple product ID | Google product ID | Period | Google base plan |
| --- | --- | --- | --- |
| `com.oxfordintelligence.oxfordbot.pro.monthly` | `oxfordbot.pro.monthly` | P1M | monthly |
| `com.oxfordintelligence.oxfordbot.pro.yearly` | `oxfordbot.pro.yearly` | P1Y | yearly |
| `com.oxfordintelligence.oxfordbot.ultra.monthly` | `oxfordbot.ultra.monthly` | P1M | monthly |
| `com.oxfordintelligence.oxfordbot.ultra.yearly` | `oxfordbot.ultra.yearly` | P1Y | yearly |

Google Play's product creation form rejects IDs longer than 40 characters; the
existing Apple IDs are 43–46 characters. The shortened Google IDs are separate
store identities, not a change to the package or the Apple subscriptions. Apple
subscription record IDs remain 6827915970, 6827916442, 6827918465 and 6827919084
respectively; Apple levels remain 2 for Pro and 1 for Ultra.

Approved USD prices are Pro 25/month or 239.99/year and Ultra 60/month or 579/year.
Read localized prices from the store; never hardcode those amounts in the native
paywall. This document does not establish current store activation or backend
readiness. No trials, installment contracts or Family Sharing are implemented.

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
  productId?: string // Required only for purchase: stable Web bridge ID from the table
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

The version-1 Web bridge remains unchanged: `purchase.productId` and returned
`products[].id` always use the stable long IDs in the first table column, on both
platforms. The native controller maps these IDs to/from the exact platform store
ID. Short Google IDs must not be posted as Web bridge purchase requests. Native
store products, purchases and backend requests retain the actual store ID.

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
  enabledProductIds: string[] /* exact store IDs for the requested platform */ }
```

Return `ready:false` until verification, credentials and enabled products are
actually ready for this platform and deployment environment. Return
`canPurchase:false` for an existing paid subscription in any channel. The client
also reconciles store-owned purchases before opening a new payment sheet.

For `platform:'google'`, `enabledProductIds` must contain only the short Google
IDs from the second table column. For `platform:'apple'`, it must contain only the
unchanged long Apple IDs. A Google session containing legacy long IDs is rejected
with `NOT_READY` before store connection or purchase. Do not enable Google
purchases by translating an old server response in the client. An empty enabled
catalog can disable new sales while preserving restore of known owned store IDs,
provided `ready:true` and server verification remain available.

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

For Google, request and response `productId` are the exact short store ID from the
purchase, such as `oxfordbot.pro.monthly`. The response must echo that exact ID;
a canonical long Web bridge ID is rejected even with `verified:true` and
`acknowledged:true`. The server must verify the actual Google product identity
and base plan, then map that verified store product to Pro/Ultra and monthly/yearly
entitlements. Do not substitute an Apple/canonical alias in Publisher API calls,
trusted receipt fields, or purchase records. Apply the same short-ID mapping to
RTDN processing and Publisher subscription line items. Package identity remains
`com.oxfordintelligence.oxfordbot`. Apple verification IDs and protocol are unchanged.

## Google deployment boundary

Already-uploaded Android versionCode 4 uses the old shared long IDs and cannot buy
the short Google products. This source change does not modify that binary. A
backend session switched to short Google IDs will fail closed in versionCode 4;
it is not a compatible fix for the already-submitted build.

Before enabling Google sales, coordinate a replacement Android build, the short-ID
backend session/catalog/verification/RTDN implementation, and matching active Play
products/base plans. Confirm store discovery, purchase, server acknowledgement,
entitlement refresh, renewal/refund handling and restore on the replacement build.
Local mock tests establish only the native mapping and fail-closed contract, not
server deployment, store connectivity or a successful real Google purchase.

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

Historical integration notes are not evidence of the current deployed backend.
The deployed implementation must be inspected independently against this contract;
no backend source or production configuration was changed as part of this patch.
