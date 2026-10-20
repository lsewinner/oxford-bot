# Oxford Bot mobile beta

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

## Current limitations

Email/password and guest chat are the intended first device-test paths. Google
sign-in and new connection authorizations are not supported in this build.
Existing OAuth implementations use browser popup/opener callbacks; opening a
system browser cannot transfer its session into this WebView. Popup actions show
a clear fallback, and known OAuth redirects are blocked. Do not relax the origin
policy or put session tokens into a deep link to work around this.

For full OAuth support, implement a reviewed native PKCE or short-lived one-time
handoff flow, with verified callback ownership and replay protection. Keep the
server's current identity/ownership checks and provider write confirmations.

The existing website uses Stripe web checkout. Mobile purchase/account deletion
flows, privacy disclosures and full OAuth must be reviewed before external beta
or public store submission. The `oxfordbot` URL scheme is reserved only; no auth
callback or associated-domain entitlement is claimed yet.

Native binaries, microphone playback/recording, actual device upload/sharing,
keyboard behavior and session persistence still require iPhone/Android testing.
The existing 512px web icon is reused for development. Prebuild generated an
opaque 1024px iOS icon suitable for building; a higher-resolution original is
recommended for final store artwork. Do not treat JavaScript export or native
project generation as a successful cloud build, TestFlight upload, or Apple review.

## Local checks

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

## Verified cloud builds (2026-10-20)

| Platform | Version | EAS build | Result |
| --- | --- | --- | --- |
| Android APK | `0.1.0 (3)` | [4b0a5380](https://expo.dev/accounts/lsewinner/projects/oxford-bot/builds/4b0a5380-0ef0-40f3-bf17-414e267a8214) | Succeeded |
| iOS App Store IPA | `0.1.0 (1)` | [73811502](https://expo.dev/accounts/lsewinner/projects/oxford-bot/builds/73811502-3f14-4c95-ac50-6258f7a6be45) | Succeeded |

Both cloud builds passed the post-install typecheck and test gate. These are
signed native artifacts; physical-device acceptance remains outstanding.
The iOS binary uses system HTTPS and declares no non-exempt encryption.

Start with internal TestFlight testers. Wait for App Store Connect processing;
record the build number and actual TestFlight availability. No tester invitations
or public release is performed by this repository configuration. Android APKs
are separate from TestFlight.

## Device acceptance before wider testing

- Email login/logout, restart with preserved session, account separation.
- Guest chat, existing threads, first send, streamed reply, cancellation, error.
- Image/PDF/text attachments, cancellation, supported-size limit and denial.
- Markdown/text and generated-image exports; share cancellation and cleanup.
- Voice permission denial/grant, recording, playback, background/resume.
- Small iPhone keyboard, Android back, tablet/split view, rotation, offline retry.
- External source links stay outside the WebView; popup/OAuth shows honest fallback.
- No private messages/tokens in logs, crash reports, URLs or build artifacts.

References: [Expo WebView](https://docs.expo.dev/versions/v58.0.0/sdk/webview/),
[EAS TestFlight](https://docs.expo.dev/submit/testflight/),
[WebView reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md).
