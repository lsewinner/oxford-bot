import type { FileUIPart, UIMessage } from "ai";

export const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json";
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
    let mediaType = file.mediaType;
    if (/\.(txt|md|csv|json)$/i.test(file.filename ?? "")) mediaType = "text/plain";
    const url = mediaType !== file.mediaType ? file.url.replace(/^data:[^;]*;/, `data:${mediaType};`) : file.url;
    return { ...file, mediaType, url };
  }));
}