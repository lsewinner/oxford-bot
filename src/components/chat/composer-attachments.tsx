import { FileTextIcon, PaperclipIcon, XIcon } from "lucide-react";
import { PromptInputButton, usePromptInputAttachments } from "@/components/ai-elements/prompt-input";

export function AttachmentButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  return <PromptInputButton tooltip="上传图片或文件" aria-label="上传图片或文件" disabled={disabled} onClick={() => attachments.openFileDialog()}><PaperclipIcon className="size-4" /></PromptInputButton>;
}

export function AttachmentPreviews() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return <div className="flex gap-2 overflow-x-auto px-4 pt-3">
    {attachments.files.map((file) => <div key={file.id} className="relative flex h-20 w-28 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-secondary">
      {file.mediaType.startsWith("image/") ? <img src={file.url} alt={file.filename ?? "图片附件"} className="h-14 w-full object-cover" /> : <FileTextIcon className="mx-auto my-3 size-8 text-muted-foreground" />}
      <span className="mt-auto truncate px-1.5 pb-1 text-[10px] text-muted-foreground">{file.filename ?? "粘贴图片"}</span>
      <PromptInputButton className="absolute right-0 top-0 size-6 bg-card" aria-label={`删除附件 ${file.filename ?? "图片"}`} tooltip="删除附件" onClick={() => attachments.remove(file.id)}><XIcon className="size-3" /></PromptInputButton>
    </div>)}
  </div>;
}

export function AttachmentSubmit({ text, busy, children }: { text: string; busy: boolean; children: (disabled: boolean) => React.ReactNode }) {
  const attachments = usePromptInputAttachments();
  return children(!busy && !text.trim() && !attachments.files.length);
}