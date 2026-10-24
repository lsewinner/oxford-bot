import type { FileUIPart, UIMessage } from "ai";

export const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.txt,.md,.csv,.json,.docx,.xlsx,.xls";
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export type ChatInput = { text: string; files?: FileUIPart[] };

export function parsePendingInput(raw: string): ChatInput {
  try {
    const value = JSON.parse(raw);
    if (typeof value.text === "string" && Array.isArray(value.files)) return value;
  } catch { /* Older text-only handoffs remain valid. */ }
  return { text: raw };
}

export function validateAttachments(messages: UIMessage[]) {
  for (const message of messages) {
    const files = message.parts.filter((part) => part.type === "file");
    if (files.length > MAX_ATTACHMENTS) throw new Error("每条消息最多上传 4 个附件");
    for (const file of files) {
      if (!/^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/(plain|markdown|csv)|application\/json)$/.test(file.mediaType)) throw new Error("仅支持图片、文本和 PDF 文件");
      if (!file.url.startsWith(`data:${file.mediaType};base64,`)) throw new Error("附件格式无效，请重新上传");
      if (file.url.length > MAX_ATTACHMENT_BYTES * 4 / 3 + 256) throw new Error("单个附件不能超过 4 MB");
    }
  }
}

export async function prepareAttachments(files: FileUIPart[]): Promise<FileUIPart[]> {
  return Promise.all(files.map(async (file) => {
    if (/\.docx$/i.test(file.filename ?? "") || file.mediaType === DOCX_TYPE) return docxToText(file);
    if (/\.xlsx?$/i.test(file.filename ?? "") || /spreadsheetml|ms-excel/.test(file.mediaType)) return sheetToText(file);
    let mediaType = file.mediaType;
    if (/\.(txt|md|csv|json)$/i.test(file.filename ?? "")) mediaType = "text/plain";
    const url = mediaType !== file.mediaType ? file.url.replace(/^data:[^;]*;/, `data:${mediaType};`) : file.url;
    return { ...file, mediaType, url };
  }));
}
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Word files are read in the browser and sent as plain text, so the model only receives text. */
async function docxToText(file: FileUIPart): Promise<FileUIPart> {
  const { default: mammoth } = await import("mammoth");
  const buffer = await (await fetch(file.url)).arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  if (!value.trim()) throw new Error("没有从 Word 文件中读到文字");
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { ...file, mediaType: "text/plain", url: `data:text/plain;base64,${btoa(bin)}` };
}

/** Excel workbooks are converted in the browser to CSV text per sheet (first 2000 rows each), so the model can analyse and chart them. */
async function sheetToText(file: FileUIPart): Promise<FileUIPart> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await (await fetch(file.url)).arrayBuffer(), { type: "array", cellDates: true });
  const parts = wb.SheetNames.slice(0, 10).map((name) => {
    const sheet = wb.Sheets[name];
    if (!sheet) return "";
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).split("\n");
    return `### 工作表：${name}（${csv.length} 行${csv.length > 2000 ? "，仅前 2000 行" : ""}）\n${csv.slice(0, 2000).join("\n")}`;
  }).filter(Boolean);
  const value = parts.join("\n\n");
  if (!value.trim()) throw new Error("没有从 Excel 文件中读到数据");
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { ...file, mediaType: "text/plain", url: `data:text/plain;base64,${btoa(bin)}` };
}
