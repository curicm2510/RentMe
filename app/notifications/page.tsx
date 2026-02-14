"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";
import { formatDate } from "../../lib/formatDate";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  data: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
};

export default function NotificationsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setMsg(t("auth_not_logged_go"));
      setItems([]);
      return;
    }

    const { data } = await supabase
      .from("notifications")
      .select("id,user_id,type,data,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as NotificationRow[];
    setItems(list);
    if (list.some((n) => !n.read_at)) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      setItems((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const renderMsg = () => {
    if (!msg) return null;
    if (msg === t("auth_not_logged_go")) {
      return (
        <p>
          {t("auth_not_logged")}. <a href="/auth">{t("auth_go_to_login")}</a>.
        </p>
      );
    }
    return <p>{msg}</p>;
  };

  const markAllRead = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  const getText = (n: NotificationRow) => {
    const title = n.data?.item_title as string | undefined;
    const label =
      n.type === "message"
        ? t("notif_message")
        : n.type === "booking_payment_required"
        ? t("notif_booking_payment_required")
        : n.type === "booking_approved"
        ? t("notif_booking_approved")
        : n.type === "booking_rejected"
        ? t("notif_booking_rejected")
        : n.type === "booking_cancelled"
        ? t("notif_booking_cancelled")
        : n.type === "booking_paid"
        ? t("notif_booking_paid")
        : n.type === "review_received"
        ? t("notif_review_received")
        : n.type === "review_due"
        ? t("notif_review_due")
        : n.type === "item_approved"
        ? t("notif_item_approved")
        : n.type === "item_rejected"
        ? t("notif_item_rejected")
        : t("notif_generic");
    return title ? `${label}: ${title}` : label;
  };

  const getLink = (n: NotificationRow) => {
    if (n.type === "message" && n.data?.booking_id) {
      return `/chat/${n.data.booking_id}`;
    }
    if (n.type === "review_received") return "/my-profile";
    if (n.type === "item_approved" || n.type === "item_rejected") return "/my-items";
    if (n.data?.role === "owner") return "/booking-requests";
    return "/my-bookings";
  };

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{t("nav_notifications")}</h1>
      </div>

      {renderMsg()}

      {items.length === 0 && !msg ? (
        <p style={{ opacity: 0.7 }}>{t("notif_empty")}</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {items.map((n) => (
            <a
              key={n.id}
              href={getLink(n)}
              onClick={() => {
                if (!n.read_at) markRead(n.id);
              }}
              style={{
                display: "block",
                padding: "10px 10px",
                textDecoration: "none",
                color: "#111",
                background: n.read_at ? "white" : "rgba(220,17,17,0.06)",
                border: "1px solid #eee",
                borderRadius: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: n.read_at ? 500 : 700 }}>{getText(n)}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {formatDate(n.created_at)}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
