import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The policy pages only use Link for their footer nav, so stub it and render the
// page component directly instead of booting a full router in jsdom.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const { LEGAL_COMPANY, LEGAL_CONTACT } = await import("@/components/legal/legal-page");
const { Route: PrivacyRoute } = await import("@/routes/privacy");
const { Route: RefundRoute } = await import("@/routes/refund");
const { Route: TermsRoute } = await import("@/routes/terms");

// Stripe's live review needs the registered entity and support address on every
// policy page, so each page must render them verbatim.
const pages = [
  ["服务条款", TermsRoute.options.component!],
  ["隐私政策", PrivacyRoute.options.component!],
  ["退款政策", RefundRoute.options.component!],
] as const;

describe("Legal pages company registration", () => {
  it("uses the company support address everywhere", () => {
    expect(LEGAL_CONTACT).toBe("info@oxfordintelligence.co.uk");
    expect(LEGAL_COMPANY.email).toBe("info@oxfordintelligence.co.uk");
  });

  it("registers the company entity on every policy page", () => {
    for (const [title, Page] of pages) {
      cleanup();
      render(<Page />);
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
      expect(screen.getAllByText(LEGAL_CONTACT).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.number).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.address).length).toBeGreaterThan(0);
      expect(screen.queryByText("support@oxford.bot")).toBeNull();
    }
  });
});
