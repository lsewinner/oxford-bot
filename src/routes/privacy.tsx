import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LEGAL_CONTACT, LEGAL_ENTITY } from "@/components/legal/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · 隐私政策 · Oxford Bot" },
      { name: "description", content: "Oxford Bot 如何收集、使用和保护你的账户、对话与支付信息。" },
      { property: "og:title", content: "隐私政策 · Oxford Bot" },
      { property: "og:description", content: "Oxford Bot 的个人信息收集与使用说明。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy Policy · 隐私政策">
      <section lang="en">
      <p>This Privacy Policy explains what information Oxford Bot (https://oxford.bot) collects, how we use, share, store and protect it, and the choices you have. Oxford Bot is operated by {LEGAL_ENTITY}, which is the data controller. Contact: {LEGAL_CONTACT}. A Chinese version follows below.</p>
      <h2>1. Information we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Account information:</strong> email address, nickname and avatar; if you sign in with Google or Apple, the name and email those providers share.</li>
        <li><strong>Content you create:</strong> chat messages, uploaded attachments (images, PDFs, documents), meeting recordings and transcripts you choose to make, documents you add to your Smart Brain knowledge base, and conversation history.</li>
        <li><strong>Connected services:</strong> encrypted authorisation credentials for third-party services you choose to connect (such as Google, Notion, GitHub, Slack), and the data from those services that you ask Oxford Bot to retrieve.</li>
        <li><strong>Subscription and usage:</strong> plan status and daily message counts. Card details are processed by Stripe and never stored by us.</li>
        <li><strong>Technical data:</strong> basic logs (time, error messages) needed to keep the service secure and working. We do not use advertising trackers.</li>
      </ul>
      <h2>2. How we use information</h2>
      <p>Only to provide the features you use: generating replies, saving your conversation history, transcribing and summarising meetings you record, searching your own knowledge base, performing third-party actions you explicitly confirm, managing subscriptions, preventing abuse and providing support. We do not sell personal information and do not use it for advertising.</p>
      <h2>3. Google user data</h2>
      <p>Oxford Bot accesses Google data only after you click “Connect” for a Google service in “Tools &amp; Connections”, and only to complete the task you request in chat:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Google Calendar</strong> (calendar.readonly, calendar.events): to list your calendars and events when you ask about your schedule, and to create an event only after you click confirm.</li>
        <li><strong>Gmail</strong> (gmail.readonly, gmail.compose, gmail.send): to search and read the messages you ask about, and to save a draft or send an email only after you click confirm.</li>
        <li><strong>Google Drive</strong> (drive.readonly, drive.file): to search and read the files you ask about or choose to import, and to create a file only after you click confirm.</li>
        <li><strong>Basic profile</strong> (userinfo.email): to identify which Google account is connected.</li>
      </ul>
      <p>Google data is sent to our AI model provider only as needed to answer your current request. It is not used to train or improve AI models, not sold, not used for advertising, and not shared with anyone else except as needed to provide the feature you requested, for security, or as required by law. No human at Oxford Intelligence reads your Google data unless you ask us to for support, it is needed for security, or the law requires it. Oxford Bot’s use and transfer of information received from Google APIs adheres to the <a className="text-foreground underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      <h2>4. Sharing and processors</h2>
      <p>We share data only with service providers that help us run Oxford Bot, and only as needed: AI model providers (to generate replies), cloud hosting and database providers, an email delivery provider (for sign-in emails) and Stripe (payments). A conversation or Bot becomes public only if you create a share link, which you can revoke at any time.</p>
      <h2>5. Storage, security and retention</h2>
      <p>Data is stored with our cloud providers and protected by encryption in transit; third-party credentials are additionally encrypted at rest and only used on our servers. Access is restricted per account. We keep your content until you delete it or delete your account. Retrieved Google content is stored only inside the conversation where you requested it and is deleted when you delete that conversation. Disconnecting a service deletes its stored credentials immediately.</p>
      <h2>6. Your choices and rights</h2>
      <p>You can delete conversations and knowledge-base documents, disconnect services in the app, edit your profile, or revoke Google access at myaccount.google.com/permissions. To access, correct or delete your account and all associated data, email {LEGAL_CONTACT}; we respond within 30 days. Depending on where you live (for example under UK GDPR or China’s PIPL) you may have further rights, including objecting to processing and lodging a complaint with a regulator.</p>
      <h2>7. Children</h2>
      <p>Oxford Bot is not intended for children under 13 and we do not knowingly collect their data.</p>
      <h2>8. Changes</h2>
      <p>We will post updates on this page and notify you in the app of material changes.</p>
      </section>

      <h2>中文版</h2>
      <p>本政策说明 Oxford Bot 收集哪些信息、如何使用，以及你拥有的选择。本服务的运营方及相关个人信息的控制者为 {LEGAL_ENTITY}。如需行使本政策所述权利或联系数据保护事宜，请发送邮件至 {LEGAL_CONTACT}。</p>
      <h2>1. 我们收集的信息</h2>
      <p>账户信息（邮箱、昵称、头像）；你发送的消息、上传的附件、会议录音与转写、Smart Brain 资料及对话记录；你主动连接的第三方服务授权；订阅状态与用量。支付卡信息由 Stripe 直接处理，我们不会获取或存储完整卡号。</p>
      <h2>2. 使用方式</h2>
      <p>仅用于提供你使用的功能：生成回复、保存对话历史、转写和总结会议、检索你自己的知识库、在你确认后执行第三方操作、管理订阅与防止滥用。我们不会出售你的个人信息，也不用于广告。</p>
      <h2>3. 第三方处理方</h2>
      <p>为提供服务，相关数据会发送给 AI 模型服务、云托管服务、邮件发送服务以及支付服务商 Stripe，仅限完成相应功能所需。</p>
      <h2>4. Google 用户数据</h2>
      <p>仅当你在「工具与连接」中主动授权时，Oxford Bot 才会访问你的 Google 账户，并只访问完成你所请求任务所需的数据；发送邮件、创建文件或日程前必须由你确认。Google 数据不会用于训练模型、不会出售、不会用于广告，并遵守 Google API Services User Data Policy（含 Limited Use 要求）。授权凭据加密保存在服务器端；你可随时在应用内断开连接，或在 Google 账户的「第三方应用访问权限」中撤销，断开后我们会删除对应凭据。</p>
      <h2>5. 存储与保留</h2>
      <p>你的内容会保留到你删除它或删除账户为止；对话中获取的 Google 内容随该对话删除。</p>
      <h2>6. 你的选择</h2>
      <p>你可以删除对话、断开第三方连接、修改资料，或发邮件联系我们删除账户及全部数据，我们会在 30 天内处理。</p>
      <h2>7. 政策变更</h2>
      <p>如有重大变更，我们会在应用内提示。</p>
    </LegalPage>
  ),
});
