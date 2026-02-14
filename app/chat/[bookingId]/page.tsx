"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import { formatDate } from "../../../lib/formatDate";
import Avatar from "../../Avatar";

type Msg = {
  id: string;
  booking_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function ChatPage() {
  const { t } = useI18n();
  const params = useParams();
  const bookingId = params?.bookingId as string | undefined;

  const [me, setMe] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [err, setErr] = useState<string>("");
  const [otherName, setOtherName] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string | null>(null);

  const load = async () => {
    setErr("");
    if (!bookingId) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setMe(user?.id ?? null);
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .select("id,booking_id,sender_id,text,created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) setErr(error.message);
    else {
      const nextMsgs = data ?? [];
      setMsgs(nextMsgs);
      const senderIds = Array.from(new Set(nextMsgs.map((m) => m.sender_id)));
      if (senderIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,avatar_url")
          .in("id", senderIds);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p) => {
          map[p.id] = p;
        });
        setProfilesById(map);
      } else {
        setProfilesById({});
      }
    }

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("owner_id,renter_id")
      .eq("id", bookingId)
      .single();
    if (bookingData) {
      const otherId =
        bookingData.owner_id === user.id ? bookingData.renter_id : bookingData.owner_id;
      setOtherId(otherId);
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", otherId)
        .single();
      setOtherName(prof?.full_name ?? otherId);
    }

    await supabase.from("chat_reads").upsert(
      {
        booking_id: bookingId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "booking_id,user_id" }
    );
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
      setErr(t("chat_login_first"));
      return;
    }

    const textValue = text.trim();
    if (!textValue) return;

    const { error } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_id: user.id,
      text: textValue,
    });

    if (error) setErr(error.message);
    else {
      setText("");
      await supabase.from("chat_reads").upsert(
        {
          booking_id: bookingId,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "booking_id,user_id" }
      );
      load();
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>
        {otherName && otherId ? (
          <>
            {t("chat_with")} <a href={`/profile/${otherId}`}>{otherName}</a>
          </>
        ) : (
          t("chat_title")
        )}
      </h1>
      {err && (
        <p style={{ color: "crimson" }}>
          {t("common_error_prefix")} {err}
        </p>
      )}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          paddingLeft: 56,
          paddingRight: 56,
          minHeight: 280,
          marginBottom: 12,
          background: "white",
          overflow: "visible",
        }}
      >
        {msgs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>{t("chat_no_messages")}</p>
        ) : (
          msgs.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 10,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                justifyContent: m.sender_id === me ? "flex-end" : "flex-start",
              }}
            >
              {m.sender_id !== me ? (
                <span style={{ marginLeft: -44 }}>
                  <Avatar url={profilesById[m.sender_id]?.avatar_url ?? null} size={24} alt="Avatar" />
                </span>
              ) : null}
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
                  {formatDate(m.created_at)}
                </div>
              </div>
              {m.sender_id === me ? (
                <span style={{ marginRight: -44 }}>
                  <Avatar url={profilesById[m.sender_id]?.avatar_url ?? null} size={24} alt="Avatar" />
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat_placeholder")}
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
          {t("chat_send")}
        </button>
      </div>
    </main>
  );
}
