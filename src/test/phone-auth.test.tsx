import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePhone, phoneAuthError } from "@/lib/phone-auth";
import { Route } from "@/routes/auth";

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/integrations/lovable/index", () => ({ lovable: { auth: {} } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signInWithOtp: mocks.send, verifyOtp: mocks.verify,
} } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const Page = Route.options.component as React.ComponentType;
beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue({ error: null }); mocks.verify.mockResolvedValue({ error: null }); });
afterEach(cleanup);

describe("phone OTP", () => {
  it("normalizes mainland and international numbers without doubling country codes", () => {
    expect(normalizePhone("13800138000")).toBe("+8613800138000");
    expect(normalizePhone("0086 138-0013-8000")).toBe("+8613800138000");
    expect(normalizePhone("+44 (7700) 900123")).toBe("+447700900123");
    expect(normalizePhone("1380013800")).toBeNull();
  });
  it("distinguishes China vetting from network and rate-limit failures", () => {
    expect(phoneAuthError({ message: "Messages to China require use case vetting", status: 422 }, "send").kind).toBe("china_approval");
    expect(phoneAuthError({ message: "Twilio error 60220" }, "send").kind).toBe("china_approval");
    expect(phoneAuthError({ code: "over_sms_send_rate_limit", status: 429 }, "send").kind).toBe("rate_limit");
    expect(phoneAuthError(new TypeError("Failed to fetch"), "send").kind).toBe("network");
  });
  it("restores sending after thrown errors and never enables verification for a failed send", async () => {
    mocks.send.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Page />);
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13800138000" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "获取验证码" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send).toHaveBeenLastCalledWith({ phone: "+8613800138000" });
  });
  it("verifies only the successfully requested number and invalidates the code after a phone edit", async () => {
    render(<Page />);
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13800138000" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    await screen.findByRole("button", { name: "重新发送" });
    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith({ phone: "+8613800138000", token: "123456", type: "sms" }));
    await waitFor(() => expect(screen.getByLabelText("手机号")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13900139000" } });
    expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeDisabled();
    expect(screen.getByLabelText("验证码")).toHaveValue("");
  });
});