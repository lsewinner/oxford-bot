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
const InstallContext = createContext({ installed: false, busy: false, install: () => {} });

export function DesktopInstallProvider({ children }: { children: ReactNode }) {
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [browser, setBrowser] = useState<Browser>("other");
  const [preview, setPreview] = useState(false);

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

  const install = async () => {
    if (installed || busy) return;
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
          <DialogTitle>{browser === "safari" ? "添加 Oxford Bot 到程序坞" : "安装 Oxford Bot"}</DialogTitle>
          <DialogDescription>{browser === "safari" ? "适用于 macOS Sonoma 14 或更新版本的 Safari。" : "使用浏览器安装，无需下载额外安装包。"}</DialogDescription>
        </DialogHeader>
        {preview && <p className="text-sm text-muted-foreground">请先在独立浏览器窗口打开 <a href="https://oxford.bot" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">oxford.bot</a>，再进行安装。</p>}
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
          {browser === "safari" ? <>
            <li>在 Safari 中打开 Oxford Bot。</li>
            <li>点击顶部菜单「文件」→「添加到程序坞」，或点击「分享」→「添加到程序坞」。</li>
            <li>确认名称为「Oxford Bot」，点击「添加」。</li>
            <li>之后可从程序坞或「应用程序」打开。</li>
          </> : browser === "mobile" ? <>
            <li>桌面端请在电脑浏览器打开 oxford.bot。</li>
            <li>如需安装到手机：iPhone 使用 Safari「分享」→「添加到主屏幕」；Android 使用 Chrome 菜单「安装应用」或「添加到主屏幕」。</li>
          </> : <>
            <li>在电脑上的 Chrome 或 Edge 中打开 oxford.bot。</li>
            <li>点击地址栏右侧的安装图标；Chrome 也可在菜单「投放、保存和分享」中选择「将网页安装为应用」，Edge 可在「应用」中选择「将此站点安装为应用」。</li>
            <li>确认「安装」，之后可从桌面或应用列表打开。</li>
          </>}
        </ol>
        <p className="text-xs leading-5 text-muted-foreground">{browser === "safari" ? "看不到「添加到程序坞」？请检查 macOS 版本，或改用 Chrome / Edge 安装。" : "菜单名称可能因浏览器版本而不同；已安装时可能显示「打开应用」。"} 对话仍需联网。</p>
        <Button onClick={() => setOpen(false)} className="mt-1">知道了</Button>
      </DialogContent>
    </Dialog>
  </InstallContext.Provider>;
}

export function DesktopInstallButton({ sidebar = false }: { sidebar?: boolean }) {
  const { installed, busy, install } = useContext(InstallContext);
  return <Button variant={sidebar ? "ghost" : "outline"} size="sm" disabled={installed || busy} onClick={install} className={cn("shrink-0 gap-2", sidebar && "w-full justify-start text-muted-foreground hover:text-foreground")}>
    <DownloadIcon className="size-4" />{installed ? "已安装桌面端" : busy ? "正在安装…" : "安装桌面端"}
  </Button>;
}
export function useDesktopInstall() { return useContext(InstallContext); }
