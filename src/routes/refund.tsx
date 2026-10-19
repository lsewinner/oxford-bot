import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LEGAL_COMPANY, LEGAL_CONTACT } from "@/components/legal/legal-page";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "退款政策 · Oxford Bot" },
      { name: "description", content: "Oxford Bot Pro 订阅的取消与退款规则。" },
      { property: "og:title", content: "退款政策 · Oxford Bot" },
      { property: "og:description", content: "Pro 订阅如何取消、如何申请退款。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="退款政策">
      <h2>1. 随时取消</h2>
      <p>你可以在升级弹窗中点击「管理或取消订阅」随时取消 Pro。取消后不会再续费，当前已付周期结束前仍可使用 Pro 权益。</p>
      <h2>2. 退款申请</h2>
      <p>首次订阅或续费扣款后 14 天内，如对服务不满意，可发邮件至 {LEGAL_CONTACT} 申请全额退款，请注明账户邮箱和扣款日期。超过 14 天的扣款一般不予退款，但因服务故障导致无法使用的情况我们会个案处理。</p>
      <h2>3. 退款方式</h2>
      <p>批准的退款由 {LEGAL_COMPANY.name}（公司注册号 {LEGAL_COMPANY.number}，注册办公地址：{LEGAL_COMPANY.address}）通过 Stripe 原路退回你的支付方式，到账时间通常为 5–10 个工作日，以发卡行为准。退款后 Pro 权益随即终止。</p>
    </LegalPage>
  ),
});
