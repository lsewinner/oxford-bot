import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const first = await supabase.auth.getUser();
    if (first.data.user) return { user: first.data.user };
    // A brief network hiccup on mobile must not drop a valid local session.
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user) {
      await new Promise((r) => setTimeout(r, 600));
      const retry = await supabase.auth.getUser();
      if (retry.data.user) return { user: retry.data.user };
      if (retry.error && !/jwt|expired|invalid|not found|session/i.test(retry.error.message)) {
        return { user: s.session.user };
      }
    }
    throw redirect({ to: "/auth", replace: true });
  },
  component: () => <Outlet />,
});
