"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";
import { formatDate } from "../../lib/formatDate";
import Avatar from "../Avatar";

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
  paid_at?: string | null;
};

type Item = {
  id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
  price_per_day: number;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

const statusLabel = (t: (key: string) => string, s: string, paidAt?: string | null) => {
  if (s === "cancelled") return t("status_cancelled");
  if (s === "paid" || paidAt) return t("status_paid");
  if (s === "pending") return t("status_pending");
  if (s === "approved") return t("status_approved");
  if (s === "rejected") return t("status_rejected");
  return s;
};

export default function BookingRequestsPage() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>({});
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
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
  const [userId, setUserId] = useState<string | null>(null);

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
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserId(user?.id ?? null);

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      setBookings([]);
      setItemsById({});
      setFirstImageByItem({});
      setProfilesById({});
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
      .eq("owner_id", user.id)
      .in("status", ["pending", "approved", "rejected", "cancelled", "paid"])
      .order("created_at", { ascending: false });

    if (bookingError) {
      setMsg(`${t("common_error_prefix")} ${bookingError.message}`);
      return;
    }

    const list = bookingData ?? [];
    setBookings(list);

    if (list.length === 0) {
      setItemsById({});
      setFirstImageByItem({});
      setProfilesById({});
      setLatestMessageByBooking({});
      setLastReadByBooking({});
      setUnreadCountByBooking({});
      return;
    }

    const itemIds = Array.from(new Set(list.map((b) => b.item_id)));
    const bookingIds = list.map((b) => b.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id,title,city,neighborhood,price_per_day")
      .in("id", itemIds);

    if (itemsError) {
      setMsg(`${t("common_error_prefix")} ${itemsError.message}`);
      return;
    }

    const itemMap: Record<string, Item> = {};
    for (const it of itemsData ?? []) itemMap[it.id] = it;
    setItemsById(itemMap);

    const { data: imgData, error: imgError } = await supabase
      .from("item_images")
      .select("item_id,url,created_at")
      .in("item_id", itemIds)
      .order("created_at", { ascending: true });

    if (imgError) {
      setFirstImageByItem({});
    } else {
      const map: Record<string, string> = {};
      for (const row of (imgData ?? []) as ItemImageRow[]) {
        if (!map[row.item_id]) map[row.item_id] = row.url;
      }
      setFirstImageByItem(map);
    }

    const renterIds = Array.from(new Set(list.map((b) => b.renter_id)));
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url")
      .in("id", renterIds);

    if (profErr) {
      console.warn("Profiles load error:", profErr.message);
      setProfilesById({});
      return;
    }

    const profMap: Record<string, Profile> = {};
    for (const p of profData ?? []) profMap[p.id] = p;
    setProfilesById(profMap);

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
    load();
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

  const countStillPendingOverlaps = async (bookingId: string) => {
    const { data: b } = await supabase
      .from("bookings")
      .select("id,item_id,start_date,end_date")
      .eq("id", bookingId)
      .single();

    if (!b) return null;

    const { count, error } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("item_id", b.item_id)
      .eq("status", "pending")
      .lt("start_date", b.end_date)
      .gt("end_date", b.start_date);

    if (error) return null;
    return count ?? 0;
  };

  const setStatus = async (bookingId: string, status: "approved" | "rejected") => {
    setMsg(t("common_updating"));

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId)
      .eq("owner_id", user.id)
      .eq("status", "pending");

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    await load();

    const pendingLeft = await countStillPendingOverlaps(bookingId);
    if (status === "approved") {
      setMsg(`${t("status_approved")}. ${t("booking_requests_pending_left")} ${pendingLeft ?? "?"}`);
    } else {
      setMsg(t("status_rejected"));
    }
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
  const formatUserLabel = (id: string) => {
    const name = profilesById[id]?.full_name;
    if (name && name.trim() !== "") return name;
    const shortId = id ? id.slice(0, 8) : "";
    return shortId ? `${t("user_unknown")} (${shortId}…)` : t("user_unknown");
  };

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
        <h1 style={{ margin: 0 }}>{t("booking_requests_title")}</h1>
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
      {bookings.length === 0 && !msg && <p>{t("booking_requests_none")}</p>}
      {bookings.length > 0 && filteredByMonth.length === 0 && !msg && (
        <p>{t("common_no_results_filters")}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredByMonth.map((b) => {
          const item = itemsById[b.item_id];
          const renterName = formatUserLabel(b.renter_id);
          const isPaid = b.status === "paid";
          const isPending = b.status === "pending";

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
                {item ? (
                  <a href={`/item/${item.id}`}>{item.title}</a>
                ) : (
                  "Item"
                )}
              </h3>

              <p style={{ margin: "6px 0", opacity: 0.85 }}>
                {t("booking_requests_from")}:{" "}
                <b>
                  <a
                    href={`/profile/${b.renter_id}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Avatar url={profilesById[b.renter_id]?.avatar_url ?? null} size={18} alt="Avatar" />
                    {renterName}
                  </a>
                </b>
              </p>

              <p style={{ margin: "6px 0" }}>
                {item ? formatLocation(item.city, item.neighborhood) : ""}{" "}
                -{" "}
                {formatDate(b.start_date)} {"->"}{" "}
                {formatDate(b.end_date)}
              </p>

              <p style={{ margin: "6px 0" }}>
                {t("booking_requests_status")}:{" "}
                <b>{statusLabel(t, b.status, b.paid_at)}</b>
                {isPaid ? (
                  <span style={{ marginLeft: 8, opacity: 0.75 }}>
                    ({t("status_paid")})
                  </span>
                ) : null}
              </p>

              <p style={{ margin: "6px 0" }}>
                {t("booking_requests_total")}: <b>{b.total_price} €</b>
              </p>

                <a href={`/chat/${b.id}`} style={{ marginRight: 12 }}>
                  {unreadCount(b.id) > 0 ? (
                    <b>
                      {t("chat_title")} ({unreadCount(b.id)})
                    </b>
                  ) : (
                    t("chat_title")
                  )}
                </a>

                {isPending ? (
                  <>
                    <button
                    onClick={() => setStatus(b.id, "approved")}
                    style={{ marginRight: 8, padding: "8px 10px" }}
                  >
                    {t("booking_requests_approve")}
                  </button>

                  <button
                    onClick={() => setStatus(b.id, "rejected")}
                    style={{ padding: "8px 10px" }}
                  >
                    {t("booking_requests_reject")}
                  </button>
                </>
              ) : (
                <span style={{ opacity: 0.7 }}>{t("booking_requests_handled")}</span>
              )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
