import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { membershipPlan, type PaidPlan, type ProFeature } from "@/lib/pro";
import { UpgradeDialog } from "./upgrade-dialog";

type Sub = { status: string; current_period_end: string | null; cancel_at_period_end: boolean | null; price_id: string };
type Ctx = { isPro: boolean; plan: PaidPlan | null; loading: boolean; userId: string | null; subscription: Sub | null; openUpgrade: (feature?: ProFeature) => void; requirePro: (feature: ProFeature) => boolean };
const ProCtx = createContext<Ctx>({ isPro: false, plan: null, loading: false, userId: null, subscription: null, openUpgrade: () => {}, requirePro: () => false });

export function ProProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [feature, setFeature] = useState<ProFeature | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const { data: subscription = null, isLoading } = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId) && paymentsConfigured(),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("subscriptions").select("status,current_period_end,cancel_at_period_end,price_id")
        .eq("user_id", userId).eq("environment", getStripeEnvironment()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as Sub | null;
    },
  });
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`sub-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` }, () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription", userId] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, queryClient]);
  const { data: grant = null, isLoading: grantLoading } = useQuery({
    queryKey: ["pro-grant", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("account_controls").select("pro_granted,pro_until,granted_tier").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const plan = membershipPlan(subscription, grant);
  const isPro = plan !== null;
  const openUpgrade = useCallback((f: ProFeature = "general") => setFeature(f), []);
  const requirePro = useCallback((f: ProFeature) => { if (isPro) return true; setFeature(f); return false; }, [isPro]);
  return <ProCtx.Provider value={{ isPro, plan, loading: isLoading || grantLoading, userId, subscription, openUpgrade, requirePro }}>
    {children}
    <UpgradeDialog feature={feature} onClose={() => setFeature(null)} />
  </ProCtx.Provider>;
}

export const usePro = () => useContext(ProCtx);
