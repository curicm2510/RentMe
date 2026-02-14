import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      owner_id,
      store_name,
      bookings_email,
      oib,
      contact_name,
      category,
      contact_number,
      year_established,
      locations_count,
    } = body || {};

    if (
      !owner_id ||
      !store_name ||
      !bookings_email ||
      !oib ||
      !contact_name ||
      !category ||
      !contact_number ||
      !year_established ||
      !locations_count
    ) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("businesses").insert({
      owner_id,
      store_name,
      bookings_email,
      oib,
      contact_name,
      category,
      contact_number,
      year_established,
      locations_count,
      status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
