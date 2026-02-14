"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import Avatar from "../../Avatar";
import { CategoryKey, getCategoryLabel } from "../../categories";
import { formatDate } from "../../../lib/formatDate";

type Item = {
  id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  price_3_days: number | null;
  price_7_days: number | null;
  city: string;
  neighborhood?: string | null;
  created_at: string;
  owner_id: string;
  category: CategoryKey | null;
  cancellation_policy?: "flexible" | "medium" | "strict" | null;
};

type ItemImage = {
  id: string;
  url: string;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

type ApprovedBooking = {
  id: string;
  start_date: string;
  end_date: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
};

type Review = {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type RelatedItem = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  neighborhood?: string | null;
  category: CategoryKey | null;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const buildDateRange = (start: string, end: string) => {
  const dates: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return dates;

  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const addMonths = (d: Date, delta: number) =>
  new Date(d.getFullYear(), d.getMonth() + delta, 1);

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

export default function ItemPage() {
  const { t, lang } = useI18n();
  const params = useParams();
  const id = params?.id as string | undefined;

  const [item, setItem] = useState<Item | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [approved, setApproved] = useState<ApprovedBooking[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewersById, setReviewersById] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [ownerItems, setOwnerItems] = useState<RelatedItem[]>([]);
  const [categoryItems, setCategoryItems] = useState<RelatedItem[]>([]);
  const [relatedImageByItem, setRelatedImageByItem] = useState<Record<string, string>>(
    {}
  );
  const ownerListRef = useRef<HTMLDivElement | null>(null);
  const categoryListRef = useRef<HTMLDivElement | null>(null);

  // booking state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setError(null);

      // 1) load item
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select(
          "id,title,description,price_per_day,price_3_days,price_7_days,cancellation_policy,city,neighborhood,created_at,owner_id,category"
        )
        .eq("id", id)
        .single();

      if (itemError) {
        setError(itemError.message);
        return;
      }
      setItem(itemData);

      // 2) load images
      const { data: imgData, error: imgError } = await supabase
        .from("item_images")
        .select("id,url")
        .eq("item_id", id)
        .order("created_at", { ascending: true });

      if (imgError) {
        setError(imgError.message);
        return;
      }
      setImages(imgData ?? []);

      // 3) load approved bookings (availability)
      const { data: approvedData, error: approvedError } = await supabase
        .from("bookings")
        .select("id,start_date,end_date")
        .eq("item_id", id)
        .in("status", ["approved", "paid"])
        .order("start_date", { ascending: true });

      if (approvedError) {
        setError(approvedError.message);
        return;
      }
      setApproved(approvedData ?? []);

      // 4) load owner profile
      const { data: ownerData, error: ownerError } = await supabase
        .from("profiles")
        .select("id,full_name,city,country,avatar_url")
        .eq("id", itemData.owner_id)
        .single();

      if (!ownerError) setOwnerProfile(ownerData as Profile);

      // 5) load related items
      const { data: ownerItemsData } = await supabase
        .from("items")
        .select("id,title,price_per_day,city,neighborhood,category")
        .eq("owner_id", itemData.owner_id)
        .eq("is_active", true)
        .neq("id", itemData.id)
        .order("created_at", { ascending: false })
        .limit(6);

      setOwnerItems((ownerItemsData ?? []) as RelatedItem[]);

      let categoryItemsData: RelatedItem[] = [];
      if (itemData.category) {
        const { data: categoryItemsRaw } = await supabase
          .from("items")
          .select("id,title,price_per_day,city,neighborhood,category")
          .eq("category", itemData.category)
          .eq("is_active", true)
          .neq("id", itemData.id)
          .order("created_at", { ascending: false })
          .limit(6);

        categoryItemsData = (categoryItemsRaw ?? []) as RelatedItem[];
        setCategoryItems(categoryItemsData);
      } else {
        setCategoryItems([]);
      }

      const relatedIds = [
        ...(ownerItemsData ?? []).map((r) => r.id),
        ...(itemData.category ? categoryItemsData.map((r) => r.id) : []),
      ];

      if (relatedIds.length > 0) {
        const { data: relatedImages } = await supabase
          .from("item_images")
          .select("item_id,url,created_at")
          .in("item_id", relatedIds)
          .order("created_at", { ascending: true });

        const map: Record<string, string> = {};
        for (const row of (relatedImages ?? []) as ItemImageRow[]) {
          if (!map[row.item_id]) map[row.item_id] = row.url;
        }
        setRelatedImageByItem(map);
      } else {
        setRelatedImageByItem({});
      }

      // 6) load reviews for item
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id,booking_id,reviewer_id,reviewee_id,item_id,rating,comment,created_at")
        .eq("item_id", id)
        .eq("reviewee_id", itemData.owner_id)
        .order("created_at", { ascending: false });

      if (reviewError) return;

      const list = (reviewData ?? []) as Review[];
      setReviews(list);

      const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_id)));
      if (reviewerIds.length === 0) {
        setReviewersById({});
        return;
      }

      const { data: reviewerData, error: reviewerError } = await supabase
        .from("profiles")
        .select("id,full_name,city,country,avatar_url")
        .in("id", reviewerIds);

      if (reviewerError) {
        setReviewersById({});
        return;
      }

      const map: Record<string, Profile> = {};
      for (const p of reviewerData ?? []) map[p.id] = p as Profile;
      setReviewersById(map);
    };

    load();
  }, [id]);

  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = data.user;
      setUserId(user?.id ?? null);
      if (!user || !id) {
        setIsSaved(false);
        return;
      }
      const { data: favData } = await supabase
        .from("favorites")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("item_id", id);
      setIsSaved((favData ?? []).length > 0);
    };

    loadAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setUserId(user?.id ?? null);
      if (!user || !id) {
        setIsSaved(false);
        return;
      }
      const { data: favData } = await supabase
        .from("favorites")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("item_id", id);
      setIsSaved((favData ?? []).length > 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [id]);

  const toggleSave = async () => {
    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    if (isSaved) {
      const { error: delError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", id);
      if (!delError) setIsSaved(false);
      return;
    }

    const { error: insError } = await supabase
      .from("favorites")
      .insert({ user_id: userId, item_id: id });
    if (!insError) setIsSaved(true);
  };

  useEffect(() => {
    if (modalIndex === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalIndex === null) return;
      if (e.key === "Escape") {
        setModalIndex(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        if (images.length <= 1) return;
        setModalIndex((prev) =>
          prev === null ? 0 : (prev - 1 + images.length) % images.length
        );
      }
      if (e.key === "ArrowRight") {
        if (images.length <= 1) return;
        setModalIndex((prev) =>
          prev === null ? 0 : (prev + 1) % images.length
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalIndex, images.length]);

  const unavailableText = useMemo(() => {
    if (approved.length === 0) return "";
    return `${t("item_unavailable")}: ${approved.length}`;
  }, [approved.length, t]);

  const unavailableDates = useMemo(() => {
    const set = new Set<string>();
    for (const b of approved) {
      for (const d of buildDateRange(b.start_date, b.end_date)) {
        set.add(d);
      }
    }
    return set;
  }, [approved]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const todayIso = useMemo(() => toISODate(new Date()), []);
  const monthDays = useMemo(() => {
    const days: (string | null)[] = [];
    const first = startOfMonth(viewMonth);
    const total = daysInMonth(viewMonth);
    const weekday = first.getDay(); // 0=Sun
    const offset = (weekday + 6) % 7; // Monday=0

    for (let i = 0; i < offset; i += 1) days.push(null);
    for (let day = 1; day <= total; day += 1) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      days.push(toISODate(d));
    }
    return days;
  }, [viewMonth]);

  const selectedDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : null;
  }, [startDate, endDate]);

  const isUnavailable = (d: string) => unavailableDates.has(d);
  const isPast = (d: string) => d < todayIso;

  const rangeHasUnavailable = (start: string, end: string) => {
    for (const d of buildDateRange(start, end)) {
      if (isUnavailable(d)) return true;
    }
    return false;
  };

  const onDaySelect = (d: string) => {
    if (isUnavailable(d) || isPast(d)) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(d);
      setEndDate("");
      setBookingMsg("");
      return;
    }

    if (d < startDate) {
      setStartDate(d);
      setEndDate("");
      setBookingMsg("");
      return;
    }

    if (rangeHasUnavailable(startDate, d)) {
      setBookingMsg(t("item_selected_range_unavailable"));
      return;
    }

    setEndDate(d);
    setBookingMsg("");
  };

  const isInRange = (d: string) => {
    if (!startDate) return false;
    if (startDate && !endDate) return d === startDate;
    return d >= startDate && d <= endDate;
  };

  const price3 =
    item?.price_3_days && item.price_3_days > 0 ? item.price_3_days : null;
  const price7 =
    item?.price_7_days && item.price_7_days > 0 ? item.price_7_days : null;

  const totalForDays = (days: number) => {
    const base = item?.price_per_day ?? 0;
    const price3Bundle = price3 ?? base * 3;
    const price7Bundle = price7 ?? base * 7;

    const dp = new Array(days + 1).fill(Number.POSITIVE_INFINITY);
    dp[0] = 0;
    for (let i = 1; i <= days; i += 1) {
      dp[i] = Math.min(dp[i], dp[i - 1] + base);
      if (i >= 3) dp[i] = Math.min(dp[i], dp[i - 3] + price3Bundle);
      if (i >= 7) dp[i] = Math.min(dp[i], dp[i - 7] + price7Bundle);
    }
    return Math.round(dp[days] * 100) / 100;
  };

  const scrollList = (ref: React.RefObject<HTMLDivElement | null>, dir: number) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "crimson" }}>
          {t("common_error_prefix")} {error}
        </p>
      </main>
    );
  }

  if (!item) {
    return (
      <main style={{ padding: 24 }}>
        <p>{t("common_loading")}</p>
      </main>
    );
  }

  const categoryLabel = item.category ? getCategoryLabel(lang, item.category) : "";

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ marginBottom: 6, marginTop: 0 }}>{item.title}</h1>
        <button
          type="button"
          onClick={toggleSave}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            color: isSaved ? "#d11" : "#444",
          }}
          aria-label={isSaved ? t("item_saved") : t("item_save")}
        >
          {isSaved ? "\u2665" : "\u2661"} {isSaved ? t("item_saved") : t("item_save")}
        </button>
      </div>
      <p style={{ marginTop: 0 }}>
        {formatLocation(item.city, item.neighborhood)} -{" "}
        <b>{item.price_per_day} EUR</b>
      </p>
      {ownerProfile && (
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          {t("item_owner")}:{" "}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Avatar url={ownerProfile.avatar_url ?? null} size={20} alt="Avatar" />
            <a href={`/profile/${ownerProfile.id}`} style={{ fontWeight: 700 }}>
              {ownerProfile.full_name ?? "—"}
            </a>
          </span>
          {ownerProfile.city || ownerProfile.country ? (
            <>
              {" "}
              • {ownerProfile.city ?? ""}
              {ownerProfile.city && ownerProfile.country ? ", " : ""}
              {ownerProfile.country ?? ""}
            </>
          ) : null}
        </p>
      )}

      {/* IMAGES */}
      {images.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <button
            type="button"
            onClick={() => setModalIndex(galleryIndex)}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "block",
            }}
          >
            <img
              src={images[Math.min(galleryIndex, images.length - 1)].url}
              alt={item.title}
              style={{
                height: 260,
                width: "100%",
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid #ddd",
                display: "block",
              }}
            />
          </button>
          {images.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setGalleryIndex(idx)}
                  style={{
                    padding: 0,
                    border: idx === galleryIndex ? "2px solid #111" : "1px solid #ddd",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={img.url}
                    alt={item.title}
                    style={{
                      width: 64,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 4,
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h3>{t("item_description")}</h3>
      <p>{item.description ?? t("item_no_description")}</p>

      <p style={{ opacity: 0.7 }}>
        {t("item_posted")}: {formatDate(item.created_at)}
      </p>

      {/* BOOKING SECTION */}
      <hr style={{ margin: "24px 0" }} />

      <h3>{t("item_request_booking")}</h3>
      <p style={{ marginTop: 0, opacity: 0.75 }}>{unavailableText}</p>

      <div style={{ margin: "6px 0 10px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            width: 34 * 7 + 5 * 6,
            marginBottom: 6,
          }}
        >
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t("item_calendar_prev")}
          </button>
          <div style={{ fontWeight: 600, fontSize: 14, textAlign: "center" }}>
            {viewMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </div>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t("item_calendar_next")}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 34px)",
            gap: 5,
            marginBottom: 4,
            fontSize: 11,
            opacity: 0.6,
            textAlign: "center",
            justifyContent: "start",
          }}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 34px)",
            gap: 5,
            justifyContent: "start",
          }}
        >
          {monthDays.map((d, idx) => {
            if (!d) {
              return <div key={`empty-${idx}`} />;
            }

            const unavailable = isUnavailable(d);
            const past = isPast(d);
            const inRange = isInRange(d);
            const isStart = startDate === d;
            const isEnd = endDate === d;

            return (
              <button
                key={d}
                onClick={() => onDaySelect(d)}
                disabled={unavailable || past}
                style={{
                  justifySelf: "center",
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  background: inRange ? "#111" : "#fff",
                  color: inRange ? "#fff" : unavailable || past ? "#aaa" : "#111",
                  textDecoration: unavailable ? "line-through" : "none",
                  cursor: unavailable || past ? "not-allowed" : "pointer",
                  fontWeight: isStart || isEnd ? 700 : 500,
                  fontSize: 12,
                }}
                title={
                  unavailable
                    ? t("item_unavailable")
                    : past
                    ? t("item_past_date")
                    : t("item_available")
                }
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 600 }}>{t("item_calendar_from")}</span>{" "}
            {startDate ? formatDate(startDate) : t("item_calendar_select")}
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>{t("item_calendar_to")}</span>{" "}
            {endDate ? formatDate(endDate) : t("item_calendar_select")}
          </div>
        </div>
      </div>

      <div style={{ margin: "14px 0 10px" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("price_section_title")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: "10px 12px",
              minWidth: 140,
            }}
          >
            <div style={{ fontWeight: 600 }}>{item.price_per_day} EUR</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t("price_1_day")}</div>
          </div>
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: "10px 12px",
              minWidth: 140,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {(price3 ?? item.price_per_day * 3).toFixed(2)} EUR</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t("price_3_days")}</div>
          </div>
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: "10px 12px",
              minWidth: 140,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {(price7 ?? item.price_per_day * 7).toFixed(2)} EUR</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t("price_7_days")}</div>
          </div>
        </div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
        {selectedDays
          ? `${t("price_exact")} ${totalForDays(selectedDays)} EUR`
          : t("price_select_days")}
      </div>
    </div>

      <div style={{ margin: "14px 0 10px" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {t("cancel_terms_title")}
        </div>
        <p style={{ marginTop: 0, opacity: 0.7 }}>
          {item.cancellation_policy === "medium"
            ? t("cancel_medium_desc")
            : item.cancellation_policy === "strict"
              ? t("cancel_strict_desc")
              : t("cancel_flexible_desc")}
        </p>
      </div>

      <button
        onClick={async () => {
          setBookingMsg(t("item_sending_request"));

          const { data: userData } = await supabase.auth.getUser();
          const user = userData.user;

          if (!user) {
            window.location.href = "/auth";
            return;
          }

          if (!startDate || !endDate) {
            setBookingMsg(t("item_select_dates"));
            return;
          }

          const start = new Date(startDate);
          const end = new Date(endDate);

          const days =
            Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (days <= 0) {
            setBookingMsg(t("item_end_after_start"));
            return;
          }

          // ✅ UX check: if overlaps approved, tell user immediately
          const overlapsApproved = approved.some((b) => {
            const aStart = new Date(startDate).getTime();
            const aEnd = new Date(endDate).getTime();
            const bStart = new Date(b.start_date).getTime();
            const bEnd = new Date(b.end_date).getTime();
            return aStart < bEnd && aEnd > bStart;
          });

          if (overlapsApproved) {
            setBookingMsg(t("item_dates_booked"));
            return;
          }

          const totalPrice = totalForDays(days);

          const { error } = await supabase.from("bookings").insert({
            item_id: item.id,
            renter_id: user.id,
            owner_id: item.owner_id,
            start_date: startDate,
            end_date: endDate,
            total_price: totalPrice,
            status: "pending",
          });

          if (error) setBookingMsg(`${t("common_error_prefix")} ${error.message}`);
          else setBookingMsg(`${t("item_request_sent")} ${totalPrice} EUR (${days} ${t("per_day")})`);
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {t("item_request_button")}
      </button>

      {bookingMsg && <p style={{ marginTop: 10 }}>{bookingMsg}</p>}

      <hr style={{ margin: "24px 0" }} />

      <h3>{t("item_reviews")}</h3>
      {avgRating !== null && (
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          {t("item_average")}: <b>{avgRating}</b> ({reviews.length})
        </p>
      )}
      {reviews.length === 0 ? (
        <p style={{ marginTop: 0, opacity: 0.7 }}>{t("item_reviews_none")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {reviews.map((r) => {
            const reviewer = reviewersById[r.reviewer_id];
            return (
              <li
                key={r.id}
                style={{
                  border: "1px solid #eee",
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Avatar url={reviewer?.avatar_url ?? null} size={18} alt="Avatar" />
                    {reviewer?.full_name ?? "—"}
                  </span>{" "}
                  — {r.rating}/5
                </div>
                {r.comment && <p style={{ margin: "6px 0 0" }}>{r.comment}</p>}
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                  {formatDate(r.created_at)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {ownerItems.length > 0 && (
        <>
          <hr style={{ margin: "24px 0" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0 }}>{t("more_from_owner")}</h3>
            {ownerProfile && (
              <a href={`/profile/${ownerProfile.id}`} style={{ fontSize: 13 }}>
                {t("view_all")}
              </a>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => scrollList(ownerListRef, -1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              aria-label="Previous"
            >
              {"<"}
            </button>
            <div
              ref={ownerListRef}
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                paddingBottom: 6,
              }}
            >
              {ownerItems.map((ri) => {
                const img = relatedImageByItem[ri.id];
                return (
                  <a
                    key={ri.id}
                    href={`/item/${ri.id}`}
                    style={{
                      minWidth: 220,
                      border: "1px solid #e5e5e5",
                      borderRadius: 12,
                      overflow: "hidden",
                      textDecoration: "none",
                      color: "inherit",
                      background: "white",
                      scrollSnapAlign: "start",
                    }}
                  >
                    <div style={{ width: "100%", height: 140, background: "#f5f5f5" }}>
                      {img ? (
                        <img
                          src={img}
                          alt={ri.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.6,
                            fontSize: 14,
                          }}
                        >
                          No image
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{ri.title}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>
                        {formatLocation(ri.city, ri.neighborhood)}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        {ri.price_per_day} EUR</div>
                    </div>
                  </a>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollList(ownerListRef, 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              aria-label="Next"
            >
              {">"}
            </button>
          </div>
        </>
      )}

      {categoryItems.length > 0 && (
        <>
          <hr style={{ margin: "24px 0" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0 }}>
              {t("more_from_category")}
              {categoryLabel ? `: ${categoryLabel}` : ""}
            </h3>
            {item.category && (
              <a href={`/?category=${item.category}`} style={{ fontSize: 13 }}>
                {t("view_all")}
              </a>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => scrollList(categoryListRef, -1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              aria-label="Previous"
            >
              {"<"}
            </button>
            <div
              ref={categoryListRef}
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                paddingBottom: 6,
              }}
            >
              {categoryItems.map((ri) => {
                const img = relatedImageByItem[ri.id];
                return (
                  <a
                    key={ri.id}
                    href={`/item/${ri.id}`}
                    style={{
                      minWidth: 220,
                      border: "1px solid #e5e5e5",
                      borderRadius: 12,
                      overflow: "hidden",
                      textDecoration: "none",
                      color: "inherit",
                      background: "white",
                      scrollSnapAlign: "start",
                    }}
                  >
                    <div style={{ width: "100%", height: 140, background: "#f5f5f5" }}>
                      {img ? (
                        <img
                          src={img}
                          alt={ri.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.6,
                            fontSize: 14,
                          }}
                        >
                          No image
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{ri.title}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>
                        {formatLocation(ri.city, ri.neighborhood)}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        {ri.price_per_day} EUR</div>
                    </div>
                  </a>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollList(categoryListRef, 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              aria-label="Next"
            >
              {">"}
            </button>
          </div>
        </>
      )}

      {modalIndex !== null && images[modalIndex] && (
        <div
          onClick={() => setModalIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 10,
              padding: 12,
              maxWidth: 900,
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                {modalIndex + 1}/{images.length}
              </div>
              <button
                type="button"
                onClick={() => setModalIndex(null)}
                style={{
                  border: "1px solid #ddd",
                  background: "white",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() =>
                  setModalIndex((prev) =>
                    prev === null ? 0 : (prev - 1 + images.length) % images.length
                  )
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
                aria-label="Previous image"
              >
                ‹
              </button>
              <img
                src={images[modalIndex].url}
                alt={item.title}
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setModalIndex((prev) =>
                    prev === null ? 0 : (prev + 1) % images.length
                  )
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
                aria-label="Next image"
              >
                ›
              </button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 10,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setModalIndex(idx)}
                  style={{
                    padding: 0,
                    border: idx === modalIndex ? "2px solid #111" : "1px solid #ddd",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={img.url}
                    alt={item.title}
                    style={{
                      width: 64,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 4,
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}



