import { EN_PHRASES } from "./i18n-en";
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";
export const LANG_KEY = "oxford-lang";

/** Saved choice wins; otherwise any non-Chinese browser gets English. */
export function detectLang(saved: string | null, browser: string | undefined): Lang {
  if (saved === "zh" || saved === "en") return saved;
  return (browser ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

const DICT = {
  zh: {
    placeholder: "有什么想问的？",
    thinking: "思考中…",
    thinkingFun: "正在憋个大招…",
    askBot: "你需要我为你做什么？",
    newChatTitle: "今天想了解什么？",
    newChatTitleFun: "来吧，问点刺激的。",
    more: "更多功能",
    less: "收起更多功能",
    liveVoice: "实时语音",
    guestBadge: "游客 · 本机保存",
    signIn: "登录",
    showcaseKicker: "试试 Oxford Bot 能做什么",
    marketTitle: "实时行情",
    marketDesc: "NVDA、AAPL、TSLA 近一月走势图 + 三句话点评",
    marketPrompt: "画出 NVDA、AAPL、TSLA 最近一个月的走势图，并用三句话给出犀利点评。",
    meetingTitle: "会议转任务",
    meetingDesc: "把一段会议速记整理成纪要和可确认的工单",
    meetingPrompt: "下面是今天产品例会的速记，请整理成纪要（结论、风险、决策），并把行动项拆成可派发到 Jira/Linear 的任务（负责人、截止日、优先级）：\n\n李雷：登录页转化掉了 8%，怀疑是验证码太慢。韩梅梅：周三前我出 A/B 方案。王工：支付回调偶发超时，周五前加重试和告警。大家同意下周一发布 2.3 版本，前提是回归测试全部通过。",
    brainTitle: "私人脑库",
    brainDesc: "上传你的资料，回答自带出处，只属于你",
    brainCta: "打开 Smart Brain",
    brainGuest: "登录后使用",
  },
  en: {
    placeholder: "Ask anything",
    thinking: "Thinking…",
    thinkingFun: "Cooking up something good…",
    askBot: "What can I do for you?",
    newChatTitle: "What's on your mind?",
    newChatTitleFun: "Go on, ask me something bold.",
    more: "More",
    less: "Show less",
    liveVoice: "Live voice",
    guestBadge: "Guest · saved on this device",
    signIn: "Sign in",
    showcaseKicker: "See what Oxford Bot can do",
    marketTitle: "Market pulse",
    marketDesc: "One-month chart of NVDA, AAPL and TSLA, plus a sharp three-line take",
    marketPrompt: "Chart NVDA, AAPL and TSLA over the past month and give me a sharp three-line take on what the chart is saying.",
    meetingTitle: "Meeting → tasks",
    meetingDesc: "Turn rough meeting notes into minutes and tickets you approve",
    meetingPrompt: "Here are my rough notes from today's product sync. Turn them into crisp minutes (decisions, risks, open questions) and break the action items into tickets ready for Jira or Linear, with owner, due date and priority:\n\nSarah: sign-up conversion dropped 8%, we think the verification step is too slow. Tom: I'll have an A/B test plan by Wednesday. Priya: the payment webhook times out now and then; adding retries and alerting by Friday. We agreed to ship v2.3 next Monday, provided the regression suite passes.",
    brainTitle: "Smart Brain",
    brainDesc: "Your private knowledge base. Every answer cites its source",
    brainCta: "Open Smart Brain",
    brainGuest: "Sign in to use",
  },
} as const;

export type Dict = { [K in keyof typeof DICT.zh]: string };

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({ lang: "zh", t: DICT.zh, setLang: () => {} });

let currentLang: Lang = "zh";
/** Translate a Chinese UI phrase for the active language; `{0}`… are filled from args. */
export function tz(zh: string, ...args: unknown[]): string {
  const text = currentLang === "en" ? EN_PHRASES[zh] ?? zh : zh;
  return args.length ? text.replace(/\{(\d+)\}/g, (_: string, i: string) => String(args[Number(i)] ?? "")) : text;
}
export const _setLangForTest = (l: Lang) => { currentLang = l; };
export const dateLocale = () => (currentLang === "en" ? "en-GB" : "zh-CN");

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");
  useEffect(() => { setLangState(detectLang(localStorage.getItem(LANG_KEY), navigator.language)); }, []);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; }, [lang]);
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } }, []);
  currentLang = lang;
  // Keyed so every tz() caller re-renders when the language changes.
  return <Ctx.Provider value={{ lang, t: DICT[lang], setLang }}><Fragment key={lang}>{children}</Fragment></Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
