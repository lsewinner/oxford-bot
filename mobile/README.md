# Oxford Bot mobile client

## Subscription release preparation 1.0.0 (2026-10-28)

The product decision is **free download with paid in-app subscriptions**. The
earlier free-companion-only proposal is withdrawn and must not be released.
Existing server-side account entitlements and quotas remain authoritative.
The shell keeps the subscription page reachable while blocking external Stripe
checkout/payment/portal destinations, including popups, and sends Help to support.

Release is blocked until Apple StoreKit and Google Play Billing purchases,
localized prices, restore/manage subscriptions, authenticated server verification,
renewal/refund notifications and account entitlement synchronization are implemented
and tested. No native billing implementation is claimed by these navigation changes.
Preserve website Stripe subscriptions and prevent duplicate cross-platform purchases.

Earlier checks passed strict TypeScript, 24 navigation/download/OAuth tests and
both Hermes exports; they did not test in-app purchases. Re-run checks after the
subscription integration. Native device acceptance and store submission remain
outstanding. No live customer account or subscription was deleted for testing.

After the release blockers pass, build Android with `google-play` (AAB, production,
EAS-managed signing); build iOS with the existing `testflight` profile. Both use
version 1.0.0 and remote incrementing build numbers. Do not upload the older
internal APK as a Google Play release.

The sections below document the original beta implementation and its history.

An Expo / React Native client for the live **https://oxford.bot** application.
The separate marketing website is not the mobile application source.

This first engineering build embeds the existing authenticated web application in
a restricted native WebView. Chat, models, account checks, quotas and conversation
storage remain on the existing server. It is an internal beta foundation, not a
completed native rewrite or an App Store release.

## Implemented

- Separate `mobile/` package and lockfile; no changes to the Lovable web app.
- Dark native entry, safe areas, back/reload controls, connection recovery.
- Native controls follow the device's English/Chinese locale. Web content retains
  the current website's language behavior; this client does not translate it.
- Exact HTTPS Oxford.bot navigation only; source links open in the system browser.
- Standard WebView file picker and a bounded Blob/data export bridge to native
  sharing. Text, Markdown, PNG, JPEG and WebP are limited to 8 MiB per export.
  Successful shares remain in OS cache for recipient access; files older than one
  hour are deleted at the next launch or export. Failed shares are cleaned immediately.
- Native microphone/camera usage descriptions. Android microphone permission is
  enabled through Help → Enable microphone, on explicit user action.
- EAS profiles for iOS simulator, Android APK, and iOS store-signed TestFlight.
- Google/Apple login messages open a system authentication session and return the
  resulting session to the same Oxford Bot WebView document. Cancellation and
  failures return `NATIVE_OAUTH_ERROR`; the existing download bridge is retained.

## Native login contract

The web page sends `{"type":"NATIVE_OAUTH","provider":"google"}` (or `apple`)
through `window.ReactNativeWebView.postMessage`. The native app opens
`https://oxford.bot/api/public/sb/auth/v1/authorize` using
`WebBrowser.openAuthSessionAsync`, with `redirect_to=oxfordbot://oauth-callback`.
`app.json` already registers the `oxfordbot` scheme. No additional native
dependency is needed for this fixed callback URL.

The auth service must allow **`oxfordbot://oauth-callback`** as a redirect URL.
Its provider settings and the deployed web handler are separate from this Expo
package. The web handler must receive `NATIVE_OAUTH_SUCCESS` and call its existing
Supabase client's `auth.setSession({ access_token, refresh_token })`. On
`NATIVE_OAUTH_ERROR`, it should reset the pending UI and let the user retry.

This implements the requested Supabase implicit-flow fragment callback. A PKCE
`code` alone is rejected, not reported as a successful login. Callback URLs,
tokens and provider error payloads are never logged or persisted by the shell.
Only the exact HTTPS app origin can request login; only the registered callback
destination is accepted. Results are discarded if the originating WebView
document was replaced, reloaded or navigated while authentication was open.

The client uses an explicit `https://oxford.bot` target origin for its injected
`window.postMessage`, preserving the requested message shape. Direct provider
navigation and unrelated connector OAuth remain blocked inside the WebView.

## Current limitations

New tool-connection authorizations still use browser popup/opener callbacks and
need the website. Do not treat native account login as support for those flows.
Email/password and guest chat remain available. The server's identity/ownership
checks and provider-write confirmations are unchanged.

The existing website uses Stripe web checkout. Mobile purchase/account deletion
flows and privacy disclosures must be reviewed before external beta or public
store submission. No universal-link/associated-domain entitlement is claimed.

Native binaries, microphone playback/recording, actual device upload/sharing,
keyboard behavior and session persistence still require iPhone/Android testing.
The existing 512px web icon is reused for development. Prebuild generated an
opaque 1024px iOS icon suitable for building; a higher-resolution original is
recommended for final store artwork. Do not treat JavaScript export or native
project generation as a successful cloud build, TestFlight upload, or Apple review.

## Local checks

Native login update (2026-10-24): strict TypeScript and all 22 navigation,
download and OAuth tests passed. Both iOS and Android Hermes exports succeeded.
These checks cover callback validation, cancellation/error messages, exact-origin
delivery and injection escaping; they do not establish a real provider login or
TestFlight availability for the new source revision.

Preparation validation (2026-10-20): strict TypeScript check and 13 navigation /
download tests passed. Expo resolved SDK 58 compatible dependencies from its
bundled version map; online React Native Directory validation was unavailable.
iOS and Android Hermes bundles exported successfully, and native project
generation (Expo prebuild) completed for both platforms. No signed cloud binary,
TestFlight availability or device test is represented by these checks.

From this directory, with Node 24 and npm:

```sh
npm ci
npm run check
npx expo install --check
npx expo export --platform ios --platform android
```

## Connected cloud accounts

Oxford Bot is linked to its own Expo and App Store Connect records. The mobile
configuration is prepared in [PR #1](https://github.com/lsewinner/oxford-bot/pull/1).

| Setting | Connected value |
| --- | --- |
| Expo account / project | `lsewinner/oxford-bot` |
| EAS project ID | `42f5e6d6-6032-4241-a8a6-8f449cd9c9fd` |
| Apple Developer team | `A2JY8H9J72` |
| App Store Connect app ID | `6824852336` |
| iOS bundle / Android package | `com.oxfordintelligence.oxfordbot` |
| EAS CLI | `25.2.0` |

`app.json` contains the EAS project link, and `eas.json` targets Oxford Bot's
existing Apple team and App Store Connect app. Use these records for subsequent
builds. Before signing or submitting, verify the active account, project, team,
bundle identifier and destination app against this table.

From `mobile/`, use EAS's secure interactive login and complete any device/browser
authentication prompts when required:

```sh
npx eas-cli@25.2.0 login
npx eas-cli@25.2.0 whoami
```

Use EAS-managed signing for this app. Keep credentials in the secure account or
credential flow; do not put passwords, verification codes or tokens into chat or
command arguments. Do not commit `.p8`, certificates, passwords or tokens.

## First builds

```sh
npx eas-cli@25.2.0 build --platform android --profile android-preview
npx eas-cli@25.2.0 build --platform ios --profile ios-simulator
npx eas-cli@25.2.0 build --platform ios --profile testflight
```

After the signed iOS build succeeds, submit its **specific build ID**:

```sh
npx eas-cli@25.2.0 submit --platform ios --profile testflight --id BUILD_ID
```

## Native OAuth delivery (2026-10-24 UTC)

- Native OAuth source: `c68398e0608bf452fecaeb1c5bc7ec1118155a84`.
- iOS **0.1.0 (2)**: [EAS build f6724737](https://expo.dev/accounts/lsewinner/projects/oxford-bot/builds/f6724737-35e0-4513-b9ea-391b763a3b77) succeeded.
- [EAS submission 7281f72d](https://expo.dev/accounts/lsewinner/projects/oxford-bot/submissions/7281f72d-adc0-4086-8758-f8fece46e4f1) succeeded.
- Submission logs confirm assignment to the existing **Oxford Bot Internal**
  group (`1624c515-1ddb-45cc-8b2a-774f7abd53a9`). No new tester invitations or
  public store release were performed.
- The artifact was built from the local snapshot commit `795426f`, whose native
  OAuth source matches upstream `c68398e`; the source commit is also recorded in
  the EAS build message.
- The Google authorize endpoint still returned HTTP 400,
  `validation_failed: Unsupported provider: missing OAuth secret`, during
  preflight. Auth-provider setup and the native redirect allow-list remain
  separate server-side checks. Physical-device OAuth sign-in is not yet verified.

The successful submission used the existing EAS-managed App Store Connect API key
and `--groups 'Oxford Bot Internal'`. Do not add `--what-to-test` on the current
Expo plan: EAS rejects that optional changelog parameter as Enterprise-only.

## Verified cloud builds (2026-10-20)

| Platform | Version | EAS build | Result |
| --- | --- | --- | --- |
| Android APK | `0.1.0 (3)` | [4b0a5380](https://expo.dev/accounts/lsewinner/projects/oxford-bot/builds/4b0a5380-0ef0-40f3-bf17-414e267a8214) | Succeeded |
| iOS App Store IPA | `0.1.0 (1)` | [73811502](https://expo.dev/accounts/lsewinner/projects/oxford-bot/builds/73811502-3f14-4c95-ac50-6258f7a6be45) | Succeeded |

Both cloud builds passed the post-install typecheck and test gate. These are
signed native artifacts; physical-device acceptance remains outstanding.
The iOS binary uses system HTTPS and declares no non-exempt encryption.

App Store Connect processed iOS `0.1.0 (1)` successfully. The build is linked to
the `Oxford Bot Internal` TestFlight group, with manual distribution and saved
test instructions. The group currently has no testers; no invitations or public
App Store release have been sent.

- [TestFlight group](https://appstoreconnect.apple.com/teams/8ad2cbbd-d559-4740-9d55-62144f46a232/apps/6824852336/testflight/groups/1624c515-1ddb-45cc-8b2a-774f7abd53a9)
- [Successful EAS submission](https://expo.dev/accounts/lsewinner/projects/oxford-bot/submissions/938dde20-226e-4831-a032-d7535cd55f37)

Start with internal TestFlight testers. Wait for App Store Connect processing;
record the build number and actual TestFlight availability. No tester invitations
or public release is performed by this repository configuration. Android APKs
are separate from TestFlight.

## Device acceptance before wider testing

- Email login/logout, restart with preserved session, account separation.
- Google/Apple login through the system window, return to app, persisted session.
- Cancel, denied consent, invalid callback and retry; no pending spinner left behind.
- Confirm the auth redirect allow-list. If consent returns to the website instead
  of the app, report that separately from the build/upload result.
- Guest chat, existing threads, first send, streamed reply, cancellation, error.
- Image/PDF/text attachments, cancellation, supported-size limit and denial.
- Markdown/text and generated-image exports; share cancellation and cleanup.
- Voice permission denial/grant, recording, playback, background/resume.
- Small iPhone keyboard, Android back, tablet/split view, rotation, offline retry.
- External source links stay outside the WebView; popup/OAuth shows honest fallback.
- No private messages/tokens in logs, crash reports or build artifacts. Session
  tokens from the requested auth callback fragment must never be copied into a
  navigated WebView URL or forwarded to an external origin.

References: [Expo WebView](https://docs.expo.dev/versions/v58.0.0/sdk/webview/),
[EAS TestFlight](https://docs.expo.dev/submit/testflight/),
[WebView reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md).


