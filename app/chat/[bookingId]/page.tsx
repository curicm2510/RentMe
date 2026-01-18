"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Msg = {
  id: string;
  booking_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

export default function ChatPage() {
  const params = useParams();
  const bookingId = params?.bookingId as string | undefined;

  const [me, setMe] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string>("");

  const load = async () => {
    setErr("");
    if (!bookingId) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setMe(user?.id ?? null);

    const { data, error } = await supabase
      .from("messages")
      .select("id,booking_id,sender_id,text,created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) setErr(error.message);
    else setMsgs(data ?? []);
  };

  useEffect(() => {
    load();
  }, [bookingId]);

  const send = async () => {
    setErr("");
    if (!bookingId) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setErr("Please login.");
      return;
    }

    const t = text.trim();
    if (!t) return;

    const { error } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_id: user.id,
      text: t,
    });

    if (error) setErr(error.message);
    else {
      setText("");
      load();
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>Chat</h1>
      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          minHeight: 280,
          marginBottom: 12,
          background: "white",
        }}
      >
        {msgs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No messages yet.</p>
        ) : (
          msgs.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 10,
                display: "flex",
                justifyContent: m.sender_id === me ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  maxWidth: "75%",
                }}
              >
                <div style={{ fontSize: 14 }}>{m.text}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          onClick={send}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </main>
  );
}