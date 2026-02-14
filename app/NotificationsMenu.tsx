"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "./I18nProvider";
import { formatDate } from "../lib/formatDate";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  data: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
};

export default function NotificationsMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id,user_id,type,data,created_at,read_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as NotificationRow[];
    setItems(list);
    return list;
  };

  const ensureReviewDueNotifications = async (uid: string, existing: NotificationRow[]) => {
    const existingBookings = new Set(
      existing
        .filter((n) => n.type === "review_due")
        .map((n) => String(n.data?.booking_id ?? ""))
        .filter(Boolean)
    );

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id,item_id,owner_id,renter_id,end_date,status")
      .or(`renter_id.eq.${uid},owner_id.eq.${uid}`)
      .eq("status", "paid");

    const now = new Date();
    const due = (bookings ?? []).filter((b) => new Date(b.end_date) < now);
    if (due.length === 0) return;

    const dueIds = due.map((b) => b.id);
    const { data: reviewData } = await supabase
      .from("reviews")
      .select("booking_id,reviewer_id")
      .in("booking_id", dueIds)
      .eq("reviewer_id", uid);

    const reviewed = new Set(
      (reviewData ?? []).map((r) => (r as { booking_id: string }).booking_id)
    );

    const itemIds = Array.from(new Set(due.map((b) => b.item_id)));
    const { data: itemsData } = await supabase
      .from("items")
      .select("id,title")
      .in("id", itemIds);
    const itemTitleById: Record<string, string> = {};
    for (const it of itemsData ?? []) {
      itemTitleById[(it as { id: string }).id] = (it as { title: string }).title;
    }

    const inserts = due
      .filter((b) => !reviewed.has(b.id) && !existingBookings.has(b.id))
      .map((b) => ({
        user_id: uid,
        type: "review_due",
        data: {
          booking_id: b.id,
          item_title: itemTitleById[b.item_id] ?? null,
          role: b.owner_id === uid ? "owner" : "renter",
        },
      }));

    if (inserts.length > 0) {
      await supabase.from("notifications").insert(inserts);
    }
  };

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!mounted) return;
      setUserId(user?.id ?? null);
      if (!user) return;

      const list = await load(user.id);
      await ensureReviewDueNotifications(user.id, list);

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 100));
            }
            if (payload.eventType === "UPDATE") {
              setItems((prev) =>
                prev.map((n) =>
                  n.id === (payload.new as NotificationRow).id
                    ? (payload.new as NotificationRow)
                    : n
                )
              );
            }
          }
        )
        .subscribe();
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (session?.user?.id) {
        load(session.user.id).then((list) =>
          ensureReviewDueNotifications(session.user!.id, list)
        );
      } else {
        setItems([]);
      }
    });

    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);

    return () => {
      mounted = false;
      if (channel) channel.unsubscribe();
      sub.subscription.unsubscribe();
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  const unreadCount = items.filter((n) => !n.read_at).length;
  const latestItems = items.slice(0, 10);

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );
  };

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
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
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open && userId && unreadCount > 0) {
            markAllRead();
          }
        }}
        aria-label={t("nav_notifications")}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid #ddd",
          background: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          cursor: "pointer",
          position: "relative",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "#d11",
              color: "white",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 320,
            maxWidth: "90vw",
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            padding: 8,
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>{t("nav_notifications")}</div>
          </div>

          {latestItems.length === 0 ? (
            <div style={{ padding: "6px 8px", opacity: 0.7 }}>
              {t("notif_empty")}
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {latestItems.map((n) => (
                <a
                  key={n.id}
                  href={getLink(n)}
                  onClick={() => {
                    if (!n.read_at) markRead(n.id);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    padding: "8px 8px",
                    textDecoration: "none",
                    color: "#111",
                    background: n.read_at ? "white" : "rgba(220,17,17,0.06)",
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: n.read_at ? 500 : 700 }}>
                    {getText(n)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                    {formatDate(n.created_at)}
                  </div>
                </a>
              ))}
            </div>
          )}
          <div style={{ borderTop: "1px solid #eee", marginTop: 6, paddingTop: 6 }}>
            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "6px 8px",
                textDecoration: "none",
                color: "#111",
                fontWeight: 600,
              }}
            >
              {t("notif_show_all")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
