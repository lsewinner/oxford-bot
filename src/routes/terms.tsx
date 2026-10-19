import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "服务条款 · Oxford Bot" },
      { name: "description", content: "Oxford Bot 服务条款：账户、使用规范、Pro 订阅与计费、服务变更。" },
      { property: "og:title", content: "服务条款 · Oxford Bot" },
      { property: "og:description", content: "使用 Oxford Bot 及 Pro 订阅的条款说明。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="服务条款">
      <p>欢迎使用 Oxford Bot（以下简称「本服务」）。注册或使用本服务即表示你同意以下条款。</p>
      <h2>1. 服务内容</h2>
      <p>Oxford Bot 是一款 AI 对话助手，提供对话、联网搜索、图片生成、文件分析、语音以及在你授权后连接第三方服务等功能。AI 生成内容可能不准确，请自行核实重要信息。</p>
      <h2>2. 账户</h2>
      <p>你需对账户下的所有活动负责，并妥善保管登录凭据和你连接的第三方授权。</p>
      <h2>3. 使用规范</h2>
      <p>不得利用本服务从事违法活动、侵犯他人权利、生成有害内容、滥用或干扰系统。违反者我们可暂停或终止其账户。</p>
      <h2>4. Pro 订阅与计费</h2>
      <p>Pro 订阅价格为每月 $25 或每年 $240，通过 Stripe 收费，并在每个计费周期开始时自动续费，直至你取消。你可随时在「管理或取消订阅」中取消，取消后在当前已付周期结束前仍可使用 Pro 权益，之后自动降为免费版。退款规则见《退款政策》。</p>
      <h2>5. 第三方服务</h2>
      <p>连接 Gmail、Outlook、Teams、GitHub、Cloudflare 等服务时，其使用同时受相应服务商条款约束。任何写入操作均需你确认后才会执行。</p>
      <h2>6. 免责与责任限制</h2>
      <p>本服务按「现状」提供。在法律允许范围内，我们不对因使用本服务产生的间接损失承担责任。</p>
      <h2>7. 条款变更</h2>
      <p>我们可能更新本条款，重大变更会在应用内提示。继续使用即视为接受更新后的条款。</p>
    </LegalPage>
  ),
});
