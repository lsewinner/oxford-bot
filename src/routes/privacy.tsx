import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "隐私政策 · Oxford Bot" },
      { name: "description", content: "Oxford Bot 如何收集、使用和保护你的账户、对话与支付信息。" },
      { property: "og:title", content: "隐私政策 · Oxford Bot" },
      { property: "og:description", content: "Oxford Bot 的个人信息收集与使用说明。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="隐私政策">
      <p>本政策说明 Oxford Bot 收集哪些信息、如何使用，以及你拥有的选择。本服务的运营方及相关个人信息的控制者为 {LEGAL_ENTITY}。如需行使本政策所述权利或联系数据保护事宜，请发送邮件至 {LEGAL_CONTACT}。</p>
      <h2>1. 我们收集的信息</h2>
      <p>账户信息（邮箱、昵称、头像）；你发送的消息、上传的附件及对话记录；你主动连接的第三方服务授权；订阅状态。支付卡信息由 Stripe 直接处理，我们不会获取或存储完整卡号。</p>
      <h2>2. 使用方式</h2>
      <p>用于提供和改进服务：生成回复、保存对话历史、在你确认后执行第三方操作、管理订阅。我们不会出售你的个人信息。</p>
      <h2>3. 第三方处理方</h2>
      <p>为提供服务，相关数据会发送给 AI 模型服务、云托管服务以及支付服务商 Stripe，仅限完成相应功能所需。</p>
      <h2>4. 分享</h2>
      <p>只有你主动创建分享链接时，对话快照才会公开；你可随时撤销。</p>
      <h2>5. 你的选择</h2>
      <p>你可以删除对话、断开第三方连接、修改资料，或联系我们删除账户及相关数据。</p>
      <h2>6. 政策变更</h2>
      <p>如有重大变更，我们会在应用内提示。</p>
    </LegalPage>
  ),
});
