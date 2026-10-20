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
The existing 512px web icon is reused for development; final store artwork needs
a high-resolution opaque 1024px source. Do not treat JavaScript export success as
a successful native build, TestFlight upload, or Apple review.

## Local checks

Preparation validation (2026-10-20): strict TypeScript check and 13 navigation /
download tests passed. Expo resolved SDK 58 compatible dependencies from its
bundled version map; online React Native Directory validation was unavailable.
iOS and Android Hermes bundles exported successfully. No signed native binary or
device test is represented by these checks.

From this directory, with Node 24 and npm:

```sh
npm ci
npm run check
npx expo install --check
npx expo export --platform ios --platform android
```

## Connect the existing cloud accounts

Use the existing `lsewinner` Expo account. No EAS project ID, Apple team, app ID or
credentials are invented or borrowed from a different app. Run these from
`mobile/`, after secure interactive login:

```sh
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

Link/create the Oxford Bot project, then commit the generated
`expo.extra.eas.projectId` in `app.json`. Confirm bundle/package identifier
`com.oxfordintelligence.oxfordbot` is available. Create/select Oxford Bot's own App
Store Connect record and add its numeric `ascAppId` to `submit.testflight.ios` in
`eas.json`. Select the correct existing Apple Developer team and use EAS-managed
signing. Do not commit `.p8`, certificates, passwords or tokens.

## First builds

```sh
npx eas-cli@latest build --platform android --profile android-preview
npx eas-cli@latest build --platform ios --profile ios-simulator
npx eas-cli@latest build --platform ios --profile testflight
```

After the signed iOS build succeeds, submit its **specific build ID**:

```sh
npx eas-cli@latest submit --platform ios --profile testflight --id BUILD_ID
```

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
