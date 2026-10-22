import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DownloadIcon, MonitorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Browser = "safari" | "chromium" | "other" | "mobile";
export type SiteLang = "zh" | "en";
const InstallContext = createContext<{ installed: boolean; busy: boolean; install: (lang?: SiteLang) => void }>({ installed: false, busy: false, install: () => {} });
const T = {
  zh: { titleSafari: "添加 Oxford Bot 到程序坞", title: "安装 Oxford Bot", descSafari: "适用于 macOS Sonoma 14 或更新版本的 Safari。", desc: "使用浏览器安装，无需下载额外安装包。", previewA: "请先在独立浏览器窗口打开 ", previewB: "，再进行安装。",
    safari: ["在 Safari 中打开 Oxford Bot。", "点击顶部菜单「文件」→「添加到程序坞」，或点击「分享」→「添加到程序坞」。", "确认名称为「Oxford Bot」，点击「添加」。", "之后可从程序坞或「应用程序」打开。"],
    mobile: ["桌面端请在电脑浏览器打开 oxford.bot。", "如需安装到手机：iPhone 使用 Safari「分享」→「添加到主屏幕」；Android 使用 Chrome 菜单「安装应用」或「添加到主屏幕」。"],
    chromium: ["在电脑上的 Chrome 或 Edge 中打开 oxford.bot。", "点击地址栏右侧的安装图标；Chrome 也可在菜单「投放、保存和分享」中选择「将网页安装为应用」，Edge 可在「应用」中选择「将此站点安装为应用」。", "确认「安装」，之后可从桌面或应用列表打开。"],
    noteSafari: "看不到「添加到程序坞」？请检查 macOS 版本，或改用 Chrome / Edge 安装。", note: "菜单名称可能因浏览器版本而不同；已安装时可能显示「打开应用」。", online: " 对话仍需联网。", ok: "知道了", installed: "已安装桌面端", busy: "正在安装…", install: "安装桌面端" },
  en: { titleSafari: "Add Oxford Bot to the Dock", title: "Install Oxford Bot", descSafari: "For Safari on macOS Sonoma 14 or later.", desc: "Install from your browser — no extra download needed.", previewA: "First open ", previewB: " in its own browser window, then install.",
    safari: ["Open Oxford Bot in Safari.", "Choose File → Add to Dock from the menu bar, or Share → Add to Dock.", "Confirm the name “Oxford Bot” and click Add.", "Open it from the Dock or Applications from then on."],
    mobile: ["For the desktop app, open oxford.bot in a computer browser.", "To install on your phone: on iPhone use Safari Share → Add to Home Screen; on Android use Chrome's menu → Install app or Add to Home Screen."],
    chromium: ["Open oxford.bot in Chrome or Edge on your computer.", "Click the install icon at the right of the address bar; in Chrome you can also use Cast, save and share → Install page as app, and in Edge Apps → Install this site as an app.", "Confirm Install, then open it from your desktop or app list."],
    noteSafari: "Don't see Add to Dock? Check your macOS version, or install with Chrome / Edge instead.", note: "Menu names may vary by browser version; if already installed you may see Open app.", online: " Chats still need an internet connection.", ok: "Got it", installed: "Desktop app installed", busy: "Installing…", install: "Install desktop app" },
} as const;

export function DesktopInstallProvider({ children }: { children: ReactNode }) {
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [browser, setBrowser] = useState<Browser>("other");
  const [preview, setPreview] = useState(false);
  const [lang, setLang] = useState<SiteLang>("zh");
  const t = T[lang];

  useEffect(() => {
    const ua = navigator.userAgent;
    setBrowser(/iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "mobile" : /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua) ? "safari" : /Chrome|Chromium|Edg/i.test(ua) ? "chromium" : "other");
    setPreview(window.self !== window.top || /^(id-preview--|preview--)/.test(window.location.hostname));
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateDisplay = () => setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
    };
    const onInstalled = () => { promptRef.current = null; setInstalled(true); setOpen(false); };
    updateDisplay();
    standalone.addEventListener("change", updateDisplay);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standalone.removeEventListener("change", updateDisplay);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async (l: SiteLang = "zh") => {
    if (installed || busy) return;
    setLang(l);
    const event = promptRef.current;
    if (!event || preview) { setOpen(true); return; }
    promptRef.current = null;
    setBusy(true);
    try {
      await event.prompt();
      await event.userChoice;
    } catch { setOpen(true); }
    finally { setBusy(false); }
  };

  return <InstallContext.Provider value={{ installed, busy, install }}>
    {children}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <MonitorIcon className="mb-2 size-7 text-muted-foreground" />
          <DialogTitle>{browser === "safari" ? t.titleSafari : t.title}</DialogTitle>
          <DialogDescription>{browser === "safari" ? t.descSafari : t.desc}</DialogDescription>
        </DialogHeader>
        {preview && <p className="text-sm text-muted-foreground">{t.previewA}<a href="https://oxford.bot" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">oxford.bot</a>{t.previewB}</p>}
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
          {(browser === "safari" ? t.safari : browser === "mobile" ? t.mobile : t.chromium).map(step => <li key={step}>{step}</li>)}
        </ol>
        <p className="text-xs leading-5 text-muted-foreground">{browser === "safari" ? t.noteSafari : t.note}{t.online}</p>
        <Button onClick={() => setOpen(false)} className="mt-1">{t.ok}</Button>
      </DialogContent>
    </Dialog>
  </InstallContext.Provider>;
}

export function DesktopInstallButton({ sidebar = false, lang = "zh" }: { sidebar?: boolean; lang?: SiteLang }) {
  const t = T[lang];
  const { installed, busy, install } = useContext(InstallContext);
  return <Button variant={sidebar ? "ghost" : "outline"} size="sm" disabled={installed || busy} onClick={() => install(lang)} className={cn("shrink-0 gap-2", sidebar && "w-full justify-start text-muted-foreground hover:text-foreground")}>
    <DownloadIcon className="size-4" />{installed ? t.installed : busy ? t.busy : t.install}
  </Button>;
}
export function useDesktopInstall() { return useContext(InstallContext); }
