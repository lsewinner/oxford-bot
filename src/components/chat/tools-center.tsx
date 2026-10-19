import { CheckIcon, CloudIcon, FlaskConicalIcon, FolderIcon, MailIcon, MessageSquareIcon, PlugIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TOOL_CATALOG, simulateTool, type ToolId } from "@/lib/tool-catalog";
import { useTools } from "./use-tools";

const icons = { "邮件助手": MailIcon, "云盘与文档": FolderIcon, "开发与运维": CloudIcon, "即时协作": MessageSquareIcon };
export function ToolsCenter() {
  const { enabled, toggle } = useTools();
  const [setup, setSetup] = useState<string | null>(null);
  const [run, setRun] = useState<{ id: ToolId; phase: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const simulate = (id: ToolId) => {
    if (timer.current) clearInterval(timer.current);
    setRun({ id, phase: 0 });
    timer.current = setInterval(() => {
      setRun((current) => {
        if (!current || current.phase >= 2) {
          if (timer.current) clearInterval(timer.current);
          return current;
        }
        return { ...current, phase: current.phase + 1 };
      });
    }, 600);
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label="工具与连接" title="工具与连接" className="gap-1.5 px-2 text-muted-foreground">
          <PlugIcon /><span className="hidden sm:inline">工具</span>{enabled.length > 0 && <span className="font-mono text-xs">{enabled.length}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>工具与连接</DialogTitle>
          <DialogDescription>真实连接 0 · 已启用模拟 {enabled.length}</DialogDescription>
        </DialogHeader>
        {setup && <div role="status" className="border-l-2 border-border pl-3 text-sm text-muted-foreground">{setup} 尚未配置授权。需由工作区管理员在「App User Connectors」设置授权应用，才能连接个人账户。Cloudflare 需单独配置账户访问权限。</div>}
        {Object.entries(icons).map(([category, Icon]) => (
          <section key={category} className="border-t border-border pt-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><Icon className="size-4" />{category}</h2>
            {TOOL_CATALOG.filter((tool) => tool.category === category).map((tool) => (
              <div key={tool.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="text-sm font-medium">{tool.name} <span className="ml-1 text-xs font-normal text-muted-foreground">未连接</span></p><p className="mt-1 text-xs text-muted-foreground">{tool.detail}</p></div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSetup(tool.name)}>连接</Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`模拟 ${tool.name}`} title={`模拟 ${tool.name}`} onClick={() => simulate(tool.id)}><FlaskConicalIcon /></Button>
                  <Switch checked={enabled.includes(tool.id)} onCheckedChange={(checked) => toggle(tool.id, checked)} aria-label={`启用 ${tool.name} 模拟工具`} />
                </div>
              </div>
            ))}
          </section>
        ))}
        {run && <div role="status" className="border-t border-border pt-3 text-sm">
          <p className="flex items-center gap-2">{run.phase === 2 ? <CheckIcon className="size-4" /> : <FlaskConicalIcon className="size-4 motion-safe:animate-pulse" />}模拟 · {TOOL_CATALOG.find((tool) => tool.id === run.id)?.name} · {["准备调用", "执行检索", "已完成"][run.phase]}</p>
          {run.phase === 2 && <p className="mt-2 text-xs text-muted-foreground">{simulateTool(run.id, "测试连接").summary}</p>}
        </div>}
      </DialogContent>
    </Dialog>
  );
}