import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { bookingId, title, totalPrice } = await req.json();

    if (!bookingId || !title || typeof totalPrice !== "number") {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

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