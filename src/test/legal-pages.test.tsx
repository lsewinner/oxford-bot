import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { LEGAL_COMPANY, LEGAL_CONTACT } from "@/components/legal/legal-page";
import { Route as PrivacyRoute } from "@/routes/privacy";
import { Route as RefundRoute } from "@/routes/refund";
import { Route as TermsRoute } from "@/routes/terms";

// Stripe's live review needs the registered entity and support address on every
// policy page, so each page must render them verbatim.
const root = createRootRoute();
const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: "/", component: () => null }),
  createRoute({ getParentRoute: () => root, path: "/terms", component: TermsRoute.options.component! }),
  createRoute({ getParentRoute: () => root, path: "/privacy", component: PrivacyRoute.options.component! }),
  createRoute({ getParentRoute: () => root, path: "/refund", component: RefundRoute.options.component! }),
]);

async function renderPage(path: string) {
  cleanup();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.start();
  render(<RouterProvider router={router} />);
}

describe("Legal pages company registration", () => {
  it("uses the company support address everywhere", () => {
    expect(LEGAL_CONTACT).toBe("info@oxfordintelligence.co.uk");
    expect(LEGAL_COMPANY.email).toBe("info@oxfordintelligence.co.uk");
  });

  it("registers the company entity on every policy page", () => {
    for (const path of ["/terms", "/privacy", "/refund"]) {
      renderPage(path);
      expect(screen.getAllByText(LEGAL_CONTACT).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.number).length).toBeGreaterThan(0);
      expect(screen.getAllByText(LEGAL_COMPANY.address).length).toBeGreaterThan(0);
      expect(screen.queryByText("support@oxford.bot")).toBeNull();
    }
  });
});
