"use server";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accessToken = body?.accessToken as string | undefined;
    const item = body?.item as
        | {
          title: string;
          price_per_day: number;
          price_3_days?: number | null;
          price_7_days?: number | null;
          cancellation_policy?: "flexible" | "medium" | "strict";
          city?: string;
          neighborhood?: string;
          description?: string | null;
          category: string;
          subcategory: string;
        }
      | undefined;

    if (!accessToken || !item) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = {
      owner_id: userData.user.id,
      title: item.title,
      price_per_day: item.price_per_day,
      price_3_days: item.price_3_days ?? null,
      price_7_days: item.price_7_days ?? null,
      cancellation_policy: item.cancellation_policy ?? "flexible",
      city: item.city ?? null,
      neighborhood: item.neighborhood ?? null,
      description: item.description ?? null,
      category: item.category,
      subcategory: item.subcategory,
      is_active: false,
      status: "pending",
    };

    const { data, error } = await supabaseAdmin
      .from("items")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 400 });
    }

    return NextResponse.json({ id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
