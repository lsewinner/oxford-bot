import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHONE_SIGNIN_ENABLED } from "@/lib/phone-auth";
import { Route } from "@/routes/auth";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/integrations/lovable/index", () => ({ lovable: { auth: {} } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signInWithOtp: vi.fn(), verifyOtp: vi.fn(),
} } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const Page = Route.options.component as React.ComponentType;
afterEach(cleanup);

describe("phone sign-in entry stays closed until SMS approval", () => {
  it("hides the phone option and opens the email form instead", () => {
    expect(PHONE_SIGNIN_ENABLED).toBe(false);
    render(<Page />);
    expect(screen.queryByLabelText("手机号")).toBeNull();
    expect(screen.queryByRole("button", { name: "获取验证码" })).toBeNull();
    expect(screen.queryByText("手机号")).toBeNull();
    expect(screen.getByPlaceholderText("邮箱")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用 Apple 继续" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用 Google 继续" })).toBeInTheDocument();
  });
});
