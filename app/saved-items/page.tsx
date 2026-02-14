"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";

type Item = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  neighborhood?: string | null;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

type FavoriteRow = {
  item_id: string;
};

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

export default function SavedItemsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = data.user;
      setUserId(user?.id ?? null);

      if (!user) {
        setItems([]);
        setFirstImageByItem({});
        setLoading(false);
        return;
      }

      const { data: favData, error: favError } = await supabase
        .from("favorites")
        .select("item_id")
        .eq("user_id", user.id);

      if (favError) {
        setError(favError.message);
        setLoading(false);
        return;
      }

      const ids = (favData ?? []).map((f: FavoriteRow) => f.item_id);
      if (ids.length === 0) {
        setItems([]);
        setFirstImageByItem({});
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("id,title,price_per_day,city,neighborhood")
        .in("id", ids)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (itemsError) {
        setError(itemsError.message);
        setLoading(false);
        return;
      }

      const list = (itemsData ?? []) as Item[];
      setItems(list);

      const { data: imgData } = await supabase
        .from("item_images")
        .select("item_id,url,created_at")
        .in("item_id", ids)
        .order("created_at", { ascending: true });

      const map: Record<string, string> = {};
      for (const row of (imgData ?? []) as ItemImageRow[]) {
        if (!map[row.item_id]) map[row.item_id] = row.url;
      }
      setFirstImageByItem(map);
      setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const removeFavorite = async (itemId: string) => {
    if (!userId) return;
    const { error: delError } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId);

    if (!delError) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setFirstImageByItem((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>{t("saved_title")}</h1>

      {!userId && <p>{t("saved_login")}</p>}
      {userId && loading && <p>{t("common_loading")}</p>}
      {userId && !loading && !error && items.length === 0 && <p>{t("saved_empty")}</p>}
      {error && (
        <p style={{ color: "crimson" }}>
          {t("common_error_prefix")} {error}
        </p>
      )}

      {userId && items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {items.map((item) => {
            const img = firstImageByItem[item.id];
            return (
              <a
                key={item.id}
                href={`/item/${item.id}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 14,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  background: "white",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(item.id);
                  }}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#d11",
                  }}
                  aria-label={t("favorites_removed")}
                >
                  {"\u2665"}
                </button>
                <div style={{ width: "100%", height: 170, background: "#f5f5f5" }}>
                  {img ? (
                    <img
                      src={img}
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
                        fontSize: 14,
                      }}
                    >
                      No image
                    </div>
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.25 }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
                    {formatLocation(item.city, item.neighborhood)}
                  </p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.price_per_day} € {t("per_day")}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
