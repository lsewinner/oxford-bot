import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopInstallButton, DesktopInstallProvider } from "@/components/desktop-install";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("desktop installation", () => {
  it("invokes a captured native prompt only on click and consumes it once", async () => {
    render(<DesktopInstallProvider><DesktopInstallButton /></DesktopInstallProvider>);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "安装桌面端" }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "安装桌面端" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "安装桌面端" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("disables both entry points after the browser confirms installation", () => {
    render(<DesktopInstallProvider><DesktopInstallButton /><DesktopInstallButton sidebar /></DesktopInstallProvider>);
    fireEvent(window, new Event("appinstalled"));
    const entries = screen.getAllByRole("button", { name: "已安装桌面端" });
    expect(entries).toHaveLength(2);
    entries.forEach(entry => expect(entry).toBeDisabled());
  });

  it("falls back to guidance if the native prompt fails", async () => {
    render(<DesktopInstallProvider><DesktopInstallButton /></DesktopInstallProvider>);
    fireEvent(window, Object.assign(new Event("beforeinstallprompt"), { prompt: vi.fn().mockRejectedValue(new Error("not available")), userChoice: Promise.resolve({ outcome: "dismissed" }) }));
    fireEvent.click(screen.getByRole("button", { name: "安装桌面端" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.getByRole("button", { name: "安装桌面端" })).not.toBeDisabled();
  });
});