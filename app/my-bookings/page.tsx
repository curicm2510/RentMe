"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";
import { formatDate } from "../../lib/formatDate";

type Booking = {
  id: string;
  item_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  created_at: string;
  paid_at: string | null;
};

type ReviewRef = {
  id: string;
  booking_id: string;
};

type LatestMessage = {
  booking_id: string;
  sender_id: string;
  created_at: string;
};

type Item = {
  id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

export default function MyBookingsPage() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>({});
  const [latestMessageByBooking, setLatestMessageByBooking] = useState<
    Record<string, LatestMessage>
  >({});
  const [lastReadByBooking, setLastReadByBooking] = useState<Record<string, string>>({});
  const [unreadCountByBooking, setUnreadCountByBooking] = useState<Record<string, number>>(
    {}
  );
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reviewsByBookingId, setReviewsByBookingId] = useState<Record<string, ReviewRef>>(
    {}
  );
  const [reviewForId, setReviewForId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [paidOverrideIds, setPaidOverrideIds] = useState<string[]>([]);
  const [refundMsgById, setRefundMsgById] = useState<Record<string, string>>({});

  const renderMsg = () => {
    if (!msg) return null;
    if (msg === t("auth_not_logged_go")) {
      return (
        <p>
          {t("auth_not_logged")}.{" "}
          <a href="/auth">{t("auth_go_to_login")}</a>.
        </p>
      );
    }
    return <p>{msg}</p>;
  };

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserId(user?.id ?? null);

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      setBookings([]);
      setItemsById({});
      setFirstImageByItem({});
      setLatestMessageByBooking({});
      setLastReadByBooking({});
      setUnreadCountByBooking({});
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id,item_id,renter_id,owner_id,start_date,end_date,status,total_price,paid_at,created_at"
      )
      .eq("renter_id", user.id)
      .order("created_at", { ascending: false });

    if (bookingError) {
      setMsg(`${t("common_error_prefix")} ${bookingError.message}`);
      return;
    }

    const list = bookingData ?? [];
    setBookings(list);

    const bookingIds = list.map((b) => b.id);
    const itemIds = Array.from(new Set(list.map((b) => b.item_id)));
    if (itemIds.length === 0) {
      setItemsById({});
      setFirstImageByItem({});
      setLatestMessageByBooking({});
      setLastReadByBooking({});
      setUnreadCountByBooking({});
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id,title,city,neighborhood")
      .in("id", itemIds);

    if (itemsError) {
      setMsg("Error loading items: " + itemsError.message);
      return;
    }

    const map: Record<string, Item> = {};
    for (const it of itemsData ?? []) map[it.id] = it;
    setItemsById(map);

    const { data: imgData, error: imgError } = await supabase
      .from("item_images")
      .select("item_id,url,created_at")
      .in("item_id", itemIds)
      .order("created_at", { ascending: true });

    if (imgError) {
      setFirstImageByItem({});
    } else {
      const imgMap: Record<string, string> = {};
      for (const row of (imgData ?? []) as ItemImageRow[]) {
        if (!imgMap[row.item_id]) imgMap[row.item_id] = row.url;
      }
      setFirstImageByItem(imgMap);
    }

    if (bookingIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id,booking_id")
        .in("booking_id", bookingIds)
        .eq("reviewer_id", user.id);

      if (!reviewError) {
        const reviewMap: Record<string, ReviewRef> = {};
        for (const r of (reviewData ?? []) as ReviewRef[]) {
          reviewMap[r.booking_id] = r;
        }
        setReviewsByBookingId(reviewMap);
      }
    }

    if (bookingIds.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("booking_id,sender_id,created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });

      const latestMap: Record<string, LatestMessage> = {};
      for (const m of (msgData ?? []) as LatestMessage[]) {
        if (!latestMap[m.booking_id]) latestMap[m.booking_id] = m;
      }
      setLatestMessageByBooking(latestMap);

      const { data: readData } = await supabase
        .from("chat_reads")
        .select("booking_id,last_read_at")
        .eq("user_id", user.id)
        .in("booking_id", bookingIds);

      const readMap: Record<string, string> = {};
      for (const r of (readData ?? []) as { booking_id: string; last_read_at: string }[]) {
        readMap[r.booking_id] = r.last_read_at;
      }
      setLastReadByBooking(readMap);

      const unreadMap: Record<string, number> = {};
      for (const m of (msgData ?? []) as LatestMessage[]) {
        if (m.sender_id === user.id) continue;
        const lastRead = readMap[m.booking_id];
        if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
          unreadMap[m.booking_id] = (unreadMap[m.booking_id] ?? 0) + 1;
        }
      }
      setUnreadCountByBooking(unreadMap);
    }
  };

  useEffect(() => {
    // ✅ samo poruka iz URL-a (NE upisujemo paid_at ovdje!)
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    const bookingId = params.get("bookingId");
    if (paid === "1") setMsg(t("payment_success"));
    if (paid === "1" && bookingId) {
      setPaidOverrideIds((prev) =>
        prev.includes(bookingId) ? prev : [...prev, bookingId]
      );
    }
    if (params.get("canceled") === "1") setMsg(t("payment_canceled"));

    let interval: ReturnType<typeof setInterval> | null = null;
    if (paid === "1" && bookingId) {
      let attempts = 0;
      interval = setInterval(async () => {
        attempts += 1;
        const { data } = await supabase
          .from("bookings")
          .select("paid_at,status")
          .eq("id", bookingId)
          .single();

        if (data && (data.paid_at || data.status === "paid")) {
          if (interval) clearInterval(interval);
          interval = null;
          load();
        } else if (attempts >= 6) {
          if (interval) clearInterval(interval);
          interval = null;
        }
      }, 2000);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) {
        setMonthOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const cancel = async (bookingId: string) => {
    const ok = confirm(t("common_cancel") + "?");
    if (!ok) return;

    setMsg(t("common_cancel"));

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      return;
    }

    const res = await fetch("/api/cancel-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        renterId: user.id,
        paidOverride: paidOverrideIds.includes(bookingId),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg(
        `${t("common_error_prefix")} ${
          data.error || t("common_cancel_failed")
        }`
      );
    } else {
      if (data?.refund_percent !== null && data?.refund_percent !== undefined) {
        const pct = Number(data.refund_percent);
        const refundMsg =
          Number.isFinite(pct) && pct > 0
            ? `${t("refund_prefix")} ${pct}% ${t("refund_suffix")}`
            : t("refund_none");
        setRefundMsgById((prev) => ({ ...prev, [bookingId]: refundMsg }));
      } else {
        setMsg(t("status_cancelled"));
      }
      load();
    }
  };

  const pay = async (bookingId: string, title: string, totalPrice: number) => {
    try {
      setPayingId(bookingId);
      setMsg(t("payment_redirecting"));

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, title, totalPrice }),
      });

      const data = await res.json();

      if (!res.ok) {
      setMsg(
        `${t("common_error_prefix")} ${
          data.error || t("common_stripe_error")
        }`
      );
        setPayingId(null);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(
        `${t("common_error_prefix")} ${
          e?.message || t("common_unknown_error")
        }`
      );
      setPayingId(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "cancelled") return t("status_cancelled");
    if (s === "paid") return t("status_paid");
    if (s === "pending") return t("status_pending");
    if (s === "approved") return t("status_approved");
    if (s === "rejected") return t("status_rejected");
    return s;
  };

  const effectiveStatus = (b: Booking) =>
    b.status === "paid" || b.paid_at || paidOverrideIds.includes(b.id) ? "paid" : b.status;

  const isPastEndDate = (end: string) => {
    const today = new Date();
    const endDate = new Date(end);
    return endDate < today;
  };

  const submitReview = async (b: Booking) => {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setMsg(t("rating_invalid"));
      return;
    }

    const payload = {
      booking_id: b.id,
      item_id: b.item_id,
      reviewer_id: user.id,
      reviewee_id: b.owner_id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    };

    const { error } = await supabase.from("reviews").insert(payload);

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    setMsg(t("review_submitted"));
    setReviewForId(null);
    setReviewComment("");
    setReviewRating(5);
    load();
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter.length === 0) return true;
    return statusFilter.some((s) =>
      s === "paid" ? b.status === "paid" || b.paid_at : b.status === s
    );
  });

  const filteredByMonth = filteredBookings.filter((b) => {
    if (monthFilter.length === 0) return true;
    return monthFilter.includes(b.start_date.slice(0, 7));
  });

  const monthOptions = Array.from(
    new Set(bookings.map((b) => b.start_date.slice(0, 7)))
  ).sort();

  const formatMonth = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const unreadCount = (bookingId: string) => unreadCountByBooking[bookingId] ?? 0;

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>{t("my_bookings_title")}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div ref={statusDropdownRef} style={{ minWidth: 200, position: "relative" }}>
            <button
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>
                {statusFilter.length > 0
                  ? `${t("common_all_statuses")} (${statusFilter.length})`
                  : t("common_all_statuses")}
              </span>
              <span style={{ opacity: 0.6 }}>▾</span>
            </button>
            {statusOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 20,
                  width: "max-content",
                  minWidth: "100%",
                  maxWidth: "90vw",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "white",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                  padding: "8px 0",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 8,
                    padding: "6px 12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter([
                        "pending",
                        "approved",
                        "rejected",
                        "cancelled",
                        "paid",
                      ]);
                      setStatusOpen(false);
                    }}
                    style={{
                      padding: "6px 10px",
                      minHeight: 36,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {t("select_all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter([]);
                      setStatusOpen(false);
                    }}
                    style={{
                      padding: "6px 10px",
                      minHeight: 36,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {t("clear_all")}
                  </button>
                </div>
                {[
                  { value: "pending", label: t("status_pending") },
                  { value: "approved", label: t("status_approved") },
                  { value: "rejected", label: t("status_rejected") },
                  { value: "cancelled", label: t("status_cancelled") },
                  { value: "paid", label: t("status_paid") },
                ].map((s) => (
                  <label
                    key={s.value}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px" }}
                  >
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(s.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStatusFilter((prev) => [...prev, s.value]);
                        } else {
                          setStatusFilter((prev) => prev.filter((x) => x !== s.value));
                        }
                      }}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div ref={monthDropdownRef} style={{ minWidth: 180, position: "relative" }}>
            <button
              type="button"
              onClick={() => setMonthOpen((v) => !v)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>
                {monthFilter.length > 0
                  ? `${t("common_all_months")} (${monthFilter.length})`
                  : t("common_all_months")}
              </span>
              <span style={{ opacity: 0.6 }}>▾</span>
            </button>
            {monthOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 20,
                  width: "max-content",
                  minWidth: "100%",
                  maxWidth: "90vw",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "white",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                  padding: "8px 0",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 8,
                    padding: "6px 12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMonthFilter(monthOptions);
                      setMonthOpen(false);
                    }}
                    style={{
                      padding: "6px 10px",
                      minHeight: 36,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {t("select_all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthFilter([]);
                      setMonthOpen(false);
                    }}
                    style={{
                      padding: "6px 10px",
                      minHeight: 36,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {t("clear_all")}
                  </button>
                </div>
                {monthOptions.map((m) => (
                  <label
                    key={m}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px" }}
                  >
                    <input
                      type="checkbox"
                      checked={monthFilter.includes(m)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMonthFilter((prev) => [...prev, m]);
                        } else {
                          setMonthFilter((prev) => prev.filter((x) => x !== m));
                        }
                      }}
                    />
                    {formatMonth(m)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {renderMsg()}

      {bookings.length === 0 && !msg && <p>{t("my_bookings_none")}</p>}
      {bookings.length > 0 && filteredByMonth.length === 0 && !msg && (
        <p>{t("common_no_results_filters")}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredByMonth.map((b) => {
          const item = itemsById[b.item_id];
          const title = item?.title ?? "Booking";
          const status = effectiveStatus(b);
          const isPaid = status === "paid";
          const canCancel =
            b.status === "pending" || b.status === "approved" || b.status === "paid";

          return (
            <li
              key={b.id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <a
                href={`/item/${b.item_id}`}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #eee",
                  background: "#f5f5f5",
                  flex: "0 0 56px",
                  display: "block",
                }}
              >
                {firstImageByItem[b.item_id] ? (
                  <img
                    src={firstImageByItem[b.item_id]}
                    alt={item ? item.title : "Item"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </a>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>
                  {item ? <a href={`/item/${item.id}`}>{item.title}</a> : "Item"}
                </h3>

                <p style={{ margin: "6px 0" }}>
                  {item ? formatLocation(item.city, item.neighborhood) : ""}{" "}
                  •{" "}
                  {formatDate(b.start_date)} →{" "}
                  {formatDate(b.end_date)}
                </p>

                <p style={{ margin: "6px 0" }}>
                  {t("common_status")}: <b>{statusLabel(status)}</b>
                </p>

                <p style={{ margin: "6px 0" }}>
                  {t("common_total")}: <b>{b.total_price} €</b>
                </p>
                {refundMsgById[b.id] && (
                  <p style={{ margin: "6px 0", color: "#0a5", fontWeight: 600 }}>
                    {refundMsgById[b.id]}
                  </p>
                )}

                {/* ✅ Pay now: samo ako je approved i NIJE paid */}
                {b.status === "approved" && !isPaid && (
                  <button
                    onClick={() => pay(b.id, title, b.total_price)}
                    disabled={payingId === b.id}
                    style={{ padding: "8px 10px", marginRight: 8 }}
                  >
                    {payingId === b.id ? "Redirecting..." : t("my_bookings_pay_now")}
                  </button>
                )}

                {/* ✅ Paid label */}
                {isPaid && (
                  <span style={{ marginRight: 12, fontWeight: 700 }}>
                    {t("my_bookings_paid")}
                  </span>
                )}

                {/* Cancel: pending, approved ili paid */}
                {canCancel && (
                  <button
                    onClick={() => cancel(b.id)}
                    style={{ padding: "8px 10px", marginRight: 12 }}
                  >
                    {t("common_cancel")}
                  </button>
                )}

                <a href={`/chat/${b.id}`} style={{ marginRight: 12 }}>
                  {unreadCount(b.id) > 0 ? (
                    <b>
                      {t("chat_title")} ({unreadCount(b.id)})
                    </b>
                  ) : (
                    t("chat_title")
                  )}
                </a>

                {isPaid && isPastEndDate(b.end_date) && !reviewsByBookingId[b.id] && (
                  <button
                    onClick={() => {
                      setReviewForId(b.id);
                      setReviewRating(5);
                      setReviewComment("");
                    }}
                    style={{ padding: "8px 10px", marginRight: 12 }}
                  >
                    {t("my_bookings_leave_review")}
                  </button>
                )}

                {reviewsByBookingId[b.id] && (
                  <span style={{ marginRight: 12, opacity: 0.7 }}>
                    {t("my_bookings_reviewed")}
                  </span>
                )}

                {reviewForId === b.id && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", fontSize: 13, opacity: 0.7 }}>
                      {t("my_bookings_rating_label")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      style={{ padding: 6, width: 80, marginBottom: 8 }}
                    />

                    <label style={{ display: "block", fontSize: 13, opacity: 0.7 }}>
                      {t("my_bookings_comment_label")}
                    </label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      style={{ width: "100%", padding: 8, minHeight: 80, marginBottom: 8 }}
                    />

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => submitReview(b)} style={{ padding: "8px 10px" }}>
                        {t("my_bookings_submit_review")}
                      </button>
                      <button
                        onClick={() => setReviewForId(null)}
                        style={{ padding: "8px 10px" }}
                      >
                        {t("profile_cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}











