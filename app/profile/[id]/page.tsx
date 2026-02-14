"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import { formatDate } from "../../../lib/formatDate";
import Avatar from "../../Avatar";

type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
};

type Review = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type ReviewItem = {
  id: string;
  title: string;
};

type ItemCard = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  neighborhood?: string | null;
};

export default function ProfilePage() {
  const { t } = useI18n();
  const params = useParams();
  const id = params?.id as string | undefined;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewersById, setReviewersById] = useState<Record<string, Profile>>({});
  const [itemsById, setItemsById] = useState<Record<string, ReviewItem>>({});
  const [itemsByOwner, setItemsByOwner] = useState<ItemCard[]>([]);
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>({});
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const load = async () => {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,city,country,avatar_url")
        .eq("id", id)
        .single();

      if (!mounted) return;

      if (profErr) {
        setMsg(`${t("common_error_prefix")} ${profErr.message}`);
        return;
      }

      setProfile(prof as Profile);

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id,reviewer_id,reviewee_id,item_id,rating,comment,created_at")
        .eq("reviewee_id", id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (!reviewError) {
        const list = (reviewData ?? []) as Review[];
        setReviews(list);
        if (list.length > 0) {
          const sum = list.reduce((acc, r) => acc + r.rating, 0);
          setAvgRating(Math.round((sum / list.length) * 10) / 10);
        } else {
          setAvgRating(null);
        }

        const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_id)));
        if (reviewerIds.length > 0) {
          const { data: reviewerData, error: reviewerError } = await supabase
            .from("profiles")
            .select("id,full_name,city,country,avatar_url")
            .in("id", reviewerIds);

          if (!reviewerError) {
            const map: Record<string, Profile> = {};
            for (const p of reviewerData ?? []) map[p.id] = p as Profile;
            setReviewersById(map);
          }
        }

        const itemIds = Array.from(new Set(list.map((r) => r.item_id)));
        if (itemIds.length > 0) {
          const { data: itemData } = await supabase
            .from("items")
            .select("id,title")
            .in("id", itemIds);
          const itemMap: Record<string, ReviewItem> = {};
          for (const it of itemData ?? []) itemMap[it.id] = it as ReviewItem;
          setItemsById(itemMap);
        }
      }

      const { data: ownerItems } = await supabase
        .from("items")
        .select("id,title,price_per_day,city,neighborhood")
        .eq("owner_id", id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const ownerList = (ownerItems ?? []) as ItemCard[];
      setItemsByOwner(ownerList);

      const ownerIds = ownerList.map((i) => i.id);
      if (ownerIds.length > 0) {
        const { data: imgData } = await supabase
          .from("item_images")
          .select("item_id,url,created_at")
          .in("item_id", ownerIds)
          .order("created_at", { ascending: true });
        const map: Record<string, string> = {};
        for (const row of (imgData ?? []) as { item_id: string; url: string }[]) {
          if (!map[row.item_id]) map[row.item_id] = row.url;
        }
        setFirstImageByItem(map);
      } else {
        setFirstImageByItem({});
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <main style={{ padding: 24, maxWidth: "100%" }}>
      <h1>{t("profile_title")}</h1>
      {msg && <p>{msg}</p>}

      {!profile && !msg && <p>{t("common_loading")}</p>}

      {profile && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar url={profile.avatar_url ?? null} size={40} alt="Avatar" />
            <p style={{ margin: 0 }}>
              <b>{t("profile_username")}:</b> {profile.full_name ?? "â€”"}
            </p>
          </div>
          <p>
            <b>{t("profile_city")}:</b> {profile.city ?? "â€”"}
          </p>
          <p>
            <b>{t("profile_country")}:</b> {profile.country ?? "â€”"}
          </p>

          <hr style={{ margin: "24px 0" }} />
          <h2 style={{ marginBottom: 6 }}>{t("profile_items_title")}</h2>
          {itemsByOwner.length === 0 ? (
            <p style={{ marginTop: 0, opacity: 0.7 }}>{t("profile_items_empty")}</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
                width: "100%",
              }}
            >
              {itemsByOwner.map((item) => (
                <a
                  key={item.id}
                  href={`/item/${item.id}`}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    overflow: "hidden",
                    textDecoration: "none",
                    color: "inherit",
                    background: "white",
                  }}
                >
                  <div style={{ width: "100%", height: 120, background: "#f5f5f5" }}>
                    {firstImageByItem[item.id] ? (
                      <img
                        src={firstImageByItem[item.id]}
                        alt={item.title}
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
                          fontSize: 13,
                        }}
                      >
                        No image
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      {item.neighborhood
                        ? `${item.city}, ${item.neighborhood}`
                        : item.city}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {item.price_per_day} € {t("per_day")}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <hr style={{ margin: "24px 0" }} />
          <h2 style={{ marginBottom: 6 }}>{t("profile_reviews")}</h2>
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
                const reviewedItem = itemsById[r.item_id];
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
                        {reviewer?.full_name ?? "-"}
                      </span>{" "}
                      - {r.rating}/5
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                      {t("profile_review_item")}:{" "}
                      {reviewedItem ? (
                        <a href={`/item/${reviewedItem.id}`}>{reviewedItem.title}</a>
                      ) : (
                        "-"
                      )}
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
        </>
      )}
    </main>
  );
}



