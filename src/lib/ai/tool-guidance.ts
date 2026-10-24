import type { ProviderId } from '@/lib/connections/catalog';

/** Keep each service's original operational guidance without replaying other services. */
export const SERVICE_TOOL_GUIDANCE: Record<ProviderId, string> = {
  github: 'GitHub repo 用 owner/repo，文件操作指定 path；',
  slack: 'Slack history/send 指定频道 id；',
  microsoft_teams: 'Teams：teams 列出已加入团队，channels 指定 teamId，messages/send 指定 teamId 和 channelId，send 还需 text；团队与频道标识必须来自实际查询，不可猜测。',
  google_calendar: 'Google Calendar：calendars 列出日历；events 查看日程（start/end 为 ISO 时间范围，默认从现在起两周，query 可按关键词过滤，id 为日历 ID 默认 primary）；create_event 需 title、start、end（带时区偏移的 ISO 时间，全天用 YYYY-MM-DD 且 end 为次日），可选 text 作为描述与 timeZone；全天日程的结束日期不含当天；相对日期按用户所在时区换算。',
  google_drive: 'Google 云盘：folders 列出我的文件（id 填文件夹 ID 进入子目录，不填为根目录）；search 用 query 按文件名或正文搜索；read 用 id 读取正文（文档、表格、幻灯片和文本文件可导出为纯文本，PDF 与二进制文件请让用户下载后作为附件上传到对话）；create_file 用 title + text 新建文本文件（写入需确认）；文件夹与文件 ID 必须来自 folders 或 search 的实际返回，不可猜测。Google 表格：sheet_read 用 id(表格 ID，来自 search 结果或链接 /d/ 后那段) + repo(范围如 Sheet1!A1:F100 或工作表名) 读取为 CSV；sheet_append 追加行、sheet_update 覆盖范围，均在 text 填二维数组 JSON（需确认）。读到数据后可用 render_chart 画图。',
  cloudflare: 'Cloudflare 只读：zones 列出站点（query 可按域名过滤），dns_records 用 Zone id 或在 query 填域名。',
  supabase: 'Supabase 只读：projects 列出项目；tables/query/health 用 id 填项目 ref（来自 projects），query 在 query 填只读 SQL（SELECT/WITH/EXPLAIN），多项目时根据用户提到的项目名选择对应 ref。',
  notion: 'Notion：search 用 query 搜索页面/数据库；read 用页面 id 读正文；query 用数据库 id 读条目；append 用页面 id + text 追加内容，create_page 用父页面 id + title + text 新建子页面（写入需确认）；只能访问用户已授权给集成的页面。搜索后用返回的标识 read 正文。',
  yuque: '语雀：repos 列出当前用户知识库（query 可指定实际的用户/团队 login），docs 用 repo 填知识库 namespace（如 login/slug）列出文档，read 用 repo + id 读取 Markdown 正文；列表每页 50 项，offset 翻页，不能把当前页称为全部；create_doc 用 repo + title + text 新建私密文档，update_doc 用 repo + id + title + text 替换完整正文并保持原可见性；写入先提交待确认任务。',
  feishu: '飞书：wiki_spaces 列出知识空间；wiki_nodes 用 repo 填 space_id（query 可填父节点 node_token）列出节点，节点 obj_token 为文档 ID；read_doc 用 repo 填 document_id 读纯文本；bitable_tables 用 repo 填多维表格 app_token；bitable_records 用 repo + id(table_id) 读记录；add_record 用 repo + id + text(字段 JSON 对象) 新增记录（需确认）；资源须已添加该应用。',
  linear: 'Linear：teams 列出工作区团队；issues 列出最近问题（teamId 限定团队，query 按标题关键词过滤）；issue 用 id 填问题编号（如 ENG-123）读取描述与评论；create_issue 用 teamId + title + text 新建问题，create_comment 用 id + text 给问题加评论（写入需确认）；团队标识与问题编号必须来自实际查询，不可猜测。',
  gitee: 'Gitee：repos 列出仓库；issues 用 repo(owner/repo) 列出开放 Issue；read_file 用 repo + path 读取文本文件；create_issue 用 repo + title + text 新建 Issue（需确认）。',
  airtable: 'Airtable：bases 列出 base；tables 用 id 填 base ID 列出数据表；records 用 id(base) + repo(表名或表 ID) 读记录，翻页在 query 填 offset=<上页返回值>；create_record 用 id + repo + text(字段 JSON 对象) 新增记录（需确认）。',
  clickup: 'ClickUp：teams 列出工作区；spaces 用 id(团队 ID)列出空间；folders 用 id(空间 ID)列出文件夹；lists 用 id(空间 ID，repo=space)列出无文件夹列表，或 id(文件夹 ID，repo=folder)列出文件夹内列表；tasks 用 id 填团队 ID 读最近任务；create_task 必须用实际 lists 查询返回的列表 ID 填 id，加 title + text 新建任务（需确认），不能用团队 ID 创建任务。',
  discord: 'Discord：guilds 列出 Bot 已加入的服务器；channels 用 id 填服务器 ID 列出文字频道；messages 用 id 填频道 ID 读最近 50 条消息；send_message 用 id(频道 ID) + text 发消息（需确认，不会 @ 任何人）。',
  x: 'X (Twitter) 只读：search 用 query 检索最近 7 天推文（支持 X 搜索语法，如 "OpenAI lang:en -is:retweet"）；user_tweets 用 repo 填用户名读取其最新推文。总结舆情时引用推文链接，不能代发推文。',
  telegram: 'Telegram：updates 读取 Bot 最近收到的消息与聊天 ID；send_message 用 id(聊天 ID 或 @频道名) + text 发消息（需确认）。',
  asana: 'Asana：workspaces 列出工作区；projects 用 id 填工作区 ID；tasks 用 id 填项目 ID；create_task 用 id(项目 ID) + title + text 新建任务（需确认）。',
  jira: 'Jira：projects 列出项目；issues 用 repo 填项目 Key 或 query 填 JQL；issue 用 id 填 Issue 编号（如 ENG-123）；create_issue 用 repo + title + text 新建 Task 类型 Issue（需确认）。',
  oanda: 'OANDA：accounts 列出交易账户；summary/positions/trades/orders 用 id 填账户 ID；prices 用 id + repo（品种如 EUR_USD、XAU_USD、WTICO_USD、SPX500_USD，逗号分隔）；create_order 用 id + repo + units（整数单位，正数做多、负数做空；1 标准手外汇=100000 单位，黄金 1 单位=1 盎司）+ 可选 orderType(MARKET/LIMIT)、price、stopLoss、takeProfit（需确认）；close_position 用 id + repo + side(long/short/all)（需确认）；close_trade 用 id + ref(交易编号) 可选 units（需确认）；cancel_order 用 id + ref(挂单编号)（需确认）。下单前先查 prices 确认现价、止损止盈方向合理，并告知最大亏损估算；不得保证收益，不构成投资建议。',
  google_mail: '邮件 draft/send 指定 to,title,text；',
  microsoft_outlook: '邮件 draft/send 指定 to,title,text；',
  microsoft_calendar: 'Outlook 日历：calendars 列出日历；events 查看日程（start/end 为 ISO 时间范围，默认从现在起两周，query 可按关键词过滤，id 为日历 ID 默认 primary）；create_event 需 title、start、end（带时区偏移的 ISO 时间，全天用 YYYY-MM-DD 且 end 为次日），可选 text 作为描述与 timeZone；全天日程的结束日期不含当天；相对日期按用户所在时区换算。',
};
