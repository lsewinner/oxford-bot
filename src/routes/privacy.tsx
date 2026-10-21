import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LEGAL_CONTACT, LEGAL_ENTITY } from "@/components/legal/legal-page";

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
      <h2>7. Google 用户数据</h2>
      <p>仅当你在「工具与连接」中主动授权时，Oxford Bot 才会访问你的 Google 账户，并只访问完成你所请求任务所需的数据。Google 授权凭据加密保存在服务器端；你可随时在应用内断开连接，或在 Google 账户的「第三方应用访问权限」中撤销，断开后我们会删除对应凭据。</p>

      <h2>English summary</h2>
      <p>This policy explains how Oxford Bot, operated by OXFORD INTELLIGENCE LIMITED (company number 16299065), collects and uses information. Contact: {LEGAL_CONTACT}.</p>
      <h2>Information we collect</h2>
      <p>Account details (email, nickname, avatar); the messages, attachments and conversation history you create; authorisations for third-party services you choose to connect; and subscription status. Card details are processed by Stripe and never stored by us.</p>
      <h2>How we use it</h2>
      <p>Only to provide and improve the service: generating replies, saving your history, running third-party actions you confirm, and managing subscriptions. We do not sell personal information and do not use it for advertising.</p>
      <h2>Google user data</h2>
      <p>Oxford Bot accesses Google data only after you connect a Google service in “Tools &amp; Connections”, and only to complete the task you ask for in chat:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Google Calendar</strong> (calendar.readonly, calendar.events): to list your calendars and events when you ask about your schedule, and to create an event only after you click confirm.</li>
        <li><strong>Gmail</strong> (gmail.readonly, gmail.compose, gmail.send): to search and read messages you ask about, and to save a draft or send an email only after you click confirm.</li>
        <li><strong>Google Drive</strong> (drive.readonly, drive.file): to search and read files you ask about, and to create a file only after you click confirm.</li>
        <li><strong>Basic profile</strong> (userinfo.email): to tell your connected Google accounts apart.</li>
      </ul>
      <p>Google data is sent to the AI model provider only as needed to answer your current request. It is not used to train AI models, not sold, not used for advertising, and not shared with anyone else except as required by law. Oxford Bot’s use and transfer of information received from Google APIs adheres to the <a className="text-foreground underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      <p>Google credentials are stored encrypted on our servers. Retrieved Google content appears only in the conversation where you requested it and is deleted when you delete that conversation. You can disconnect a Google account in the app at any time (we then delete its stored credentials) or revoke access at myaccount.google.com/permissions. To delete your account and all data, email {LEGAL_CONTACT}.</p>
      <h2>Your choices</h2>
      <p>You can delete conversations, disconnect services, edit your profile, or ask us to delete your account and data.</p>
    </LegalPage>
  ),
});
