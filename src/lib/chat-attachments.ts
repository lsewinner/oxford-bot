import type { FileUIPart, UIMessage } from "ai";

export const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.csv,.json,.docx";
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
