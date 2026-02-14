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
    const itemId = body?.itemId as string | undefined;
    const url = body?.url as string | undefined;

    if (!accessToken || !itemId || !url) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: itemData, error: itemError } = await supabaseAdmin
      .from("items")
      .select("owner_id")
      .eq("id", itemId)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (itemData.owner_id !== userData.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("item_images").insert({
      item_id: itemId,
      url,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
