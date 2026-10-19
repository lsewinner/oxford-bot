import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

function periodFields(subscription: any) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const start = item?.current_period_start ?? subscription.current_period_start;
  const end = item?.current_period_end ?? subscription.current_period_end;
  return {
    price_id: priceId,
    product_id: productId,
    status: subscription.status,
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  };
}

async function handle(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sub = event.data.object;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const userId = sub.metadata?.userId;
      if (!userId) { console.error("No userId in subscription metadata"); return; }
      const { error } = await supabaseAdmin.from("subscriptions").upsert(
        { user_id: userId, stripe_subscription_id: sub.id, stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id, environment: env, ...periodFields(sub) },
        { onConflict: "stripe_subscription_id" },
      );
      if (error) throw error;
      return;
    }
    case "customer.subscription.deleted": {
      const { error } = await supabaseAdmin.from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id).eq("environment", env);
      if (error) throw error;
      return;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
