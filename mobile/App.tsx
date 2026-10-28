import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, BackHandler, Image, PermissionsAndroid,
  Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocales } from 'expo-localization';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_URL, destination, isAppUrl } from './src/navigation';
import { DOWNLOAD_BRIDGE_SCRIPT, parseDownloadMessage } from './src/bridge';
import { completeOAuth, oauthReplyScript, parseOAuthRequest } from './src/oauth';
import { strings } from './src/strings';
import { BILLING_CAPABILITY_SCRIPT, billingReplyScript, parseBillingRequest } from './src/billing-protocol';
import { createNativeBilling } from './src/billing';

WebBrowser.maybeCompleteAuthSession();

const exportDirectory = new Directory(Paths.cache, 'oxford-exports');
async function prepareExportDirectory() {
  await exportDirectory.create({ idempotent: true, intermediates: true });
  for (const item of await exportDirectory.list()) {
    const created = Number(item.name.match(/^(\d+)-/)?.[1]);
    if (item instanceof File && created > 0 && Date.now() - created > 60 * 60 * 1000) {
      await item.delete();
    }
  }
}

function OxfordBot() {
  const locales = useLocales();
  const t = strings[locales[0]?.languageCode === 'zh' ? 'zh' : 'en'];
  // WebView 14's default generic is undefined; use object to preserve props under TS 6 strict mode.
  const web = useRef<WebView<object>>(null);
  const currentUrl = useRef(APP_URL);
  const sharing = useRef(false);
  const authenticating = useRef(false);
  const pageRevision = useRef(0);
  const billing = useRef<ReturnType<typeof createNativeBilling> | undefined>(undefined);
  const [entered, setEntered] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => { void prepareExportDirectory().catch(() => {}); }, []);

  useEffect(() => {
    const nativeBilling = createNativeBilling();
    billing.current = nativeBilling;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void nativeBilling.controller.resume();
    });
    return () => { subscription.remove(); nativeBilling.dispose(); billing.current = undefined; };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  async function openBrowser(url: string) {
    if (!['app', 'browser'].includes(destination(url))) return;
    try { await WebBrowser.openBrowserAsync(url); }
    catch { Alert.alert(t.error, t.errorNote); }
  }

  function unavailable() {
    Alert.alert(t.unavailable, t.unavailableNote, [
      { text: t.cancel, style: 'cancel' },
    ]);
  }

  function purchaseUnavailable() {
    Alert.alert(t.purchaseUnavailable, t.purchaseUnavailableNote);
  }

  async function enableVoice() {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) Alert.alert(t.voice, t.voiceDenied);
    } else {
      Alert.alert(t.voice, t.voiceNote);
    }
  }

  function help() {
    Alert.alert('Oxford Bot', t.note, [
      { text: t.cancel, style: 'cancel' },
      { text: t.voice, onPress: () => { void enableVoice(); } },
      { text: t.support, onPress: () => { void openBrowser(`${APP_URL}support`); } },
    ]);
  }

  function retry() {
    pageRevision.current++;
    currentUrl.current = APP_URL;
    setFailed(false);
    setLoading(true);
    setCanGoBack(false);
    setGeneration(value => value + 1);
  }

  async function onMessage(event: WebViewMessageEvent) {
    if (!isAppUrl(currentUrl.current)) return;
    const billingRequest = parseBillingRequest(event.nativeEvent.data, event.nativeEvent.url);
    if (billingRequest) {
      const view = web.current;
      const revision = pageRevision.current;
      const pageUrl = event.nativeEvent.url;
      currentUrl.current = pageUrl;
      await billing.current?.controller.handle(billingRequest, reply => {
        if (view && web.current === view && pageRevision.current === revision && currentUrl.current === pageUrl) {
          view.injectJavaScript(billingReplyScript(reply, pageUrl));
        }
      });
      return;
    }
    const request = parseOAuthRequest(event.nativeEvent.data, event.nativeEvent.url);
    if (request) {
      // Ignore duplicate taps while the system owns the current auth session.
      if (authenticating.current) return;
      const view = web.current;
      const revision = pageRevision.current;
      // The message URL also covers SPA route changes on Android WebViews.
      const pageUrl = event.nativeEvent.url;
      currentUrl.current = pageUrl;
      authenticating.current = true;
      try {
        const reply = request.provider
          ? await completeOAuth(request.provider, (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl))
          : { type: 'NATIVE_OAUTH_ERROR' as const };
        if (view && web.current === view && pageRevision.current === revision && currentUrl.current === pageUrl) {
          view.injectJavaScript(oauthReplyScript(reply, pageUrl));
        }
      } finally {
        authenticating.current = false;
      }
      return;
    }
    if (sharing.current) return;
    const message = parseDownloadMessage(event.nativeEvent.data, event.nativeEvent.url);
    if (!message) return;
    if (message.type === 'oxford-download-unavailable') {
      Alert.alert(t.share, t.exportError);
      return;
    }
    sharing.current = true;
    let file: File | undefined;
    let handedToShareSheet = false;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
      await prepareExportDirectory();
      file = new File(exportDirectory, `${Date.now()}-${message.filename}`);
      await file.write(message.dataBase64, { encoding: 'base64' });
      await Sharing.shareAsync(file.uri, { mimeType: message.mimeType, dialogTitle: t.share });
      handedToShareSheet = true;
    } catch {
      Alert.alert(t.share, t.exportError);
    } finally {
      // Android recipients may read after the chooser closes. Successful exports
      // stay in OS cache; files older than one hour are removed on next launch/export.
      try { if (!handedToShareSheet && file?.exists) await file.delete(); } catch { /* OS may have cleaned cache. */ }
      sharing.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      {!entered ? (
        <View style={styles.intro}>
          <Image source={require('./assets/icon.png')} style={styles.logo} accessibilityLabel="Oxford Bot" />
          <Text style={styles.eyebrow}>{t.eyebrow}</Text>
          <Text style={styles.brand}>OXFORD BOT</Text>
          <Text style={styles.title}>{t.intro}</Text>
          <Text style={styles.note}>{t.note}</Text>
          <Pressable style={styles.button} accessibilityRole="button" onPress={() => setEntered(true)}>
            <Text style={styles.buttonText}>{t.continue}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.toolbar}>
            <Pressable disabled={!canGoBack} onPress={() => web.current?.goBack()} accessibilityRole="button" accessibilityLabel={t.back} style={styles.toolButton}>
              <Text style={[styles.toolText, !canGoBack && styles.disabled]}>‹</Text>
            </Pressable>
            <Text style={styles.wordmark}>OXFORD BOT</Text>
            <Pressable onPress={() => failed ? retry() : web.current?.reload()} accessibilityRole="button" accessibilityLabel={t.reload} style={styles.toolButton}>
              <Text style={styles.toolText}>↻</Text>
            </Pressable>
            <Pressable onPress={help} accessibilityRole="button" accessibilityLabel={t.help} style={styles.toolButton}>
              <Text style={styles.helpText}>?</Text>
            </Pressable>
          </View>
          <View style={styles.content}>
            <WebView<object>
              key={generation}
              ref={web}
              source={{ uri: APP_URL }}
              style={styles.web}
              // Capture every navigation here; unlisted schemes must not be opened automatically.
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={request => {
                const target = destination(request.url);
                if (request.isTopFrame === false) return target === 'app';
                if (target === 'app') return true;
                if (target === 'browser') void openBrowser(request.url);
                else if (target === 'oauth') unavailable();
                else if (target === 'purchase') purchaseUnavailable();
                return false;
              }}
              onOpenWindow={event => {
                const url = event.nativeEvent.targetUrl;
                const target = destination(url);
                if (['browser', 'app'].includes(target)) void openBrowser(url);
                else if (target === 'purchase') purchaseUnavailable();
                else unavailable();
              }}
              onNavigationStateChange={state => {
                currentUrl.current = state.url;
                setCanGoBack(state.canGoBack);
              }}
              onLoadStart={event => {
                pageRevision.current++;
                billing.current?.controller.disconnect();
                currentUrl.current = event.nativeEvent.url;
                setLoading(true);
                setFailed(false);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setFailed(true); }}
              onHttpError={event => {
                if (event.nativeEvent.url === currentUrl.current && event.nativeEvent.statusCode >= 400) setFailed(true);
              }}
              onContentProcessDidTerminate={() => { setFailed(true); setLoading(false); }}
              onRenderProcessGone={() => { setFailed(true); setLoading(false); }}
              injectedJavaScript={DOWNLOAD_BRIDGE_SCRIPT + BILLING_CAPABILITY_SCRIPT}
              injectedJavaScriptBeforeContentLoaded={BILLING_CAPABILITY_SCRIPT}
              injectedJavaScriptBeforeContentLoadedForMainFrameOnly
              injectedJavaScriptForMainFrameOnly
              onMessage={event => { void onMessage(event); }}
              onFileDownload={() => Alert.alert(t.share, t.exportError)}
              applicationNameForUserAgent="OxfordBotMobile/0.1"
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled={false}
              setSupportMultipleWindows
              javaScriptCanOpenWindowsAutomatically={false}
              mixedContentMode="never"
              allowFileAccess={false}
              allowFileAccessFromFileURLs={false}
              allowUniversalAccessFromFileURLs={false}
              geolocationEnabled={false}
              mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              allowsBackForwardNavigationGestures
              contentInsetAdjustmentBehavior="never"
              webviewDebuggingEnabled={false}
            />
            {loading && !failed && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color="#fff" /><Text style={styles.loadingText}>{t.loading}</Text></View>}
            {failed && (
              <View style={styles.error}>
                <Text style={styles.title}>{t.error}</Text>
                <Text style={styles.note}>{t.errorNote}</Text>
                <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.buttonText}>{t.retry}</Text></Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><OxfordBot /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1 },
  web: { flex: 1, backgroundColor: '#000' },
  toolbar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#202020', minHeight: 48 },
  toolButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#fff', fontSize: 28 },
  helpText: { color: '#ddd', fontSize: 18 },
  disabled: { color: '#444' },
  wordmark: { color: '#fff', flex: 1, fontSize: 12, fontWeight: '600', letterSpacing: 2 },
  intro: { flex: 1, justifyContent: 'center', padding: 30, maxWidth: 500, width: '100%', alignSelf: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 36 },
  eyebrow: { color: '#888', fontSize: 10, letterSpacing: 3, marginBottom: 12 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '600', letterSpacing: 1, marginBottom: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '500', marginBottom: 14 },
  note: { color: '#a1a1a1', fontSize: 15, lineHeight: 24, marginBottom: 28 },
  button: { backgroundColor: '#fff', borderRadius: 28, minHeight: 54, paddingHorizontal: 25, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#000', fontSize: 15, fontWeight: '600' },
  loading: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#151515', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 10 },
  loadingText: { color: '#ddd', fontSize: 12 },
  error: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000', padding: 30, justifyContent: 'center' },
});


