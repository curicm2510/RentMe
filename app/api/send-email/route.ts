import { NextResponse } from "next/server";

type Payload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  contextType?: string;
  contextId?: string;
};

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const body = (await req.json()) as Payload;
    if (!body?.to || !body?.subject || !body?.html) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return NextResponse.json({ error: "Email not configured." }, { status: 500 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [body.to],
        subject: body.subject,
        html: body.html,
        text: body.text ?? undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (supabaseUrl && serviceKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);
        await supabaseAdmin.from("email_logs").insert({
          to_email: body.to,
          subject: body.subject,
          context_type: body.contextType ?? null,
          context_id: body.contextId ?? null,
          error: errText,
        });
      }
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (supabaseUrl && serviceKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);
        await supabaseAdmin.from("email_logs").insert({
          to_email: "unknown",
          subject: "send-email",
          context_type: "send-email",
          context_id: null,
          error: e?.message || "Error",
        });
      } catch {}
    }
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
