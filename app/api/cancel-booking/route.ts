import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { bookingId, renterId, paidOverride } = await req.json();

  if (!bookingId || !renterId) {
    return NextResponse.json({ error: "Missing bookingId or renterId" }, { status: 400 });
  }

  const { data: booking, error: readErr } = await supabaseAdmin
    .from("bookings")
    .select(
      "id,item_id,renter_id,start_date,end_date,status,paid_at,total_price,items(cancellation_policy)"
    )
    .eq("id", bookingId)
    .single();

  if (readErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.renter_id !== renterId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (booking.status !== "cancelled") {
    const { error: cancelErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 });
    }
  }

  const { error: reopenErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: "pending" })
    .eq("item_id", booking.item_id)
    .eq("status", "rejected")
    .lt("start_date", booking.end_date)
    .gt("end_date", booking.start_date)
    .neq("id", bookingId);

  if (reopenErr) {
    return NextResponse.json({ error: reopenErr.message }, { status: 500 });
  }

  const policy =
    (booking as any).items?.cancellation_policy ??
    "flexible";
  const startDate = new Date(`${booking.start_date}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffMs = startDate.getTime() - todayUtc.getTime();
  const daysUntil = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  let refundPercent = 0;
  if (policy === "flexible") {
    refundPercent = daysUntil >= 2 ? 100 : daysUntil >= 1 ? 50 : 0;
  } else if (policy === "medium") {
    refundPercent = daysUntil >= 7 ? 100 : daysUntil >= 3 ? 50 : 0;
  } else if (policy === "strict") {
    refundPercent = daysUntil >= 30 ? 100 : daysUntil >= 14 ? 50 : 0;
  }

  const totalPrice = Number(booking.total_price ?? 0);
  const refundAmount = totalPrice > 0 ? Math.round((totalPrice * refundPercent) * 100) / 100 : 0;

  const treatAsPaid = Boolean(booking.paid_at || booking.status === "paid" || paidOverride);

  return NextResponse.json({
    ok: true,
    refund_percent: treatAsPaid ? refundPercent : null,
    refund_amount: treatAsPaid ? refundAmount : null,
  });
}
