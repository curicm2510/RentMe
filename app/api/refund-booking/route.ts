import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id,status,stripe_payment_intent_id")
    .eq("id", bookingId)
    .single();

  if (error || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (booking.status !== "paid" || !booking.stripe_payment_intent_id) {
    return NextResponse.json({ error: "Not refundable" }, { status: 400 });
  }

  await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });

  const { error: updErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
