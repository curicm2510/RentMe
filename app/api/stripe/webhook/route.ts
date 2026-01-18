import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  console.log("✅ WEBHOOK HIT:", event.type);

  // 1) Checkout session completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log("Session id:", session.id);
    console.log("Session metadata:", session.metadata);

    const bookingId = session.metadata?.booking_id;

    if (!bookingId) {
      console.error("❌ Missing metadata.booking_id on session", session.id);
      // 200 OK: Stripe ne retry-a, ali ti vidiš log i znaš da je metadata problem
      return new Response("OK", { status: 200 });
    }

    // provjeri postoji li booking (debug)
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id, paid_at, status")
      .eq("id", bookingId)
      .single();

    if (readErr || !existing) {
      console.error("❌ Booking not found for bookingId:", bookingId, readErr?.message);
      return new Response("OK", { status: 200 });
    }

    // idempotentno: ako je već paid, ne diraj
    if (existing.paid_at || existing.status === "paid") {
      console.log("ℹ️ Booking already marked paid:", bookingId);
      return new Response("OK", { status: 200 });
    }

    const paymentIntentId =
      session.payment_intent ? String(session.payment_intent) : null;

    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        paid_at: new Date().toISOString(),
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", bookingId)
      .is("paid_at", null);

    if (updErr) {
      console.error("❌ Supabase update error:", updErr.message);
      // 500 => Stripe će retry-at webhook
      return new Response("DB update failed", { status: 500 });
    }

    console.log("✅ Booking updated as paid:", bookingId);
    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
}