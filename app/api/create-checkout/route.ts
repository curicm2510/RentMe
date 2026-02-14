import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { bookingId, title } = await req.json();

    if (!bookingId || !title) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id,status,paid_at,total_price")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "approved") {
      return NextResponse.json({ error: "Booking not approved" }, { status: 400 });
    }

    if (booking.paid_at || booking.status === "paid") {
      return NextResponse.json({ error: "Booking already paid" }, { status: 409 });
    }

    const totalPrice = Number(booking.total_price);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      return NextResponse.json({ error: "Invalid booking total" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const stripe = new Stripe(secretKey, { apiVersion: "2025-12-15.clover" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: title,
            },
            // Stripe traži "cents"
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      // ✅ bitno: gdje se vraća nakon uspjeha / cancel
      success_url: `${baseUrl}/my-bookings?paid=1&bookingId=${bookingId}`,
      cancel_url: `${baseUrl}/my-bookings?canceled=1&bookingId=${bookingId}`,

      // opcionalno (korisno kasnije za webhook)
      metadata: { booking_id: bookingId },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Stripe error" },
      { status: 500 }
    );
  }
}
