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
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("OK", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.booking_id;

  if (!bookingId) {
    console.error("Missing metadata.booking_id on session", session.id);
    return new Response("OK", { status: 200 });
  }

  const { data: existing, error: readErr } = await supabaseAdmin
    .from("bookings")
    .select("id,item_id,start_date,end_date,paid_at,status")
    .eq("id", bookingId)
    .single();

  if (readErr || !existing) {
    console.error("Booking not found for bookingId:", bookingId, readErr?.message);
    return new Response("OK", { status: 200 });
  }

  if (existing.paid_at || existing.status === "paid") {
    return new Response("OK", { status: 200 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("bookings")
    .update({
      paid_at: new Date().toISOString(),
      status: "paid",
    })
    .eq("id", bookingId)
    .is("paid_at", null);

  if (updErr) {
    console.error("Supabase update error:", updErr.message);
    return new Response("DB update failed", { status: 500 });
  }

  const { error: rejectErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: "rejected" })
    .eq("item_id", existing.item_id)
    .eq("status", "pending")
    .lt("start_date", existing.end_date)
    .gt("end_date", existing.start_date)
    .neq("id", bookingId);

  if (rejectErr) {
    console.error("Reject pending overlaps failed:", rejectErr.message);
    return new Response("DB update failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
