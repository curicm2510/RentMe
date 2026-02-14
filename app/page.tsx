"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "./I18nProvider";
import { CategoryKey, categories, getCategoryLabel, getSubcategories } from "./categories";

type Item = {
  id: string;
  owner_id: string;
  title: string;
  price_per_day: number;
  city: string;
  neighborhood?: string | null;
  cities?: string[] | null;
  created_at: string;
  category: CategoryKey | null;
  subcategory: string | null;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

type FavoriteRow = {
  item_id: string;
};

type BookingRange = {
  item_id: string;
  start_date: string;
  end_date: string;
};

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

const normalizeCity = (value: string) => value.trim().toLocaleLowerCase("hr-HR");

const displayCity = (value: string) =>
  normalizeCity(value)
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");

export default function Home() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>(
    {}
  );
  const [bookedByItem, setBookedByItem] = useState<Record<string, BookingRange[]>>({});
  const [ownerRatingById, setOwnerRatingById] = useState<
    Record<string, { avg: number; count: number }>
  >({});
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey[]>([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [favoritesByItem, setFavoritesByItem] = useState<Record<string, boolean>>({});
  const [cityOpen, setCityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const subcategoryDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);

      // 1) load items
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select(
          "id, owner_id, title, price_per_day, city, neighborhood, cities, created_at, category, subcategory"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (itemsError) {
        setError(itemsError.message);
        return;
      }

      const list = itemsData ?? [];
      setItems(list);

      // 2) load images for those items (first image per item)
      const ids = list.map((x) => x.id);
      if (ids.length === 0) {
        setFirstImageByItem({});
        setBookedByItem({});
        setOwnerRatingById({});
        return;
      }

      const { data: imgData, error: imgError } = await supabase
        .from("item_images")
        .select("item_id, url, created_at")
        .in("item_id", ids)
        .order("created_at", { ascending: true });

      if (imgError) {
        setError(imgError.message);
        return;
      }

      const map: Record<string, string> = {};
      for (const row of (imgData ?? []) as ItemImageRow[]) {
        if (!map[row.item_id]) map[row.item_id] = row.url;
      }
      setFirstImageByItem(map);

      // 3) load booked ranges for availability filter
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("item_id,start_date,end_date")
        .in("item_id", ids)
        .in("status", ["approved", "paid"]);

      if (bookingError) {
        setBookedByItem({});
      } else {
        const ranges: Record<string, BookingRange[]> = {};
        for (const b of (bookingData ?? []) as BookingRange[]) {
          if (!ranges[b.item_id]) ranges[b.item_id] = [];
          ranges[b.item_id].push(b);
        }
        setBookedByItem(ranges);
      }

      // 4) load owner ratings
      const ownerIds = Array.from(new Set(list.map((x) => x.owner_id)));
      if (ownerIds.length === 0) {
        setOwnerRatingById({});
        return;
      }

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("reviewee_id,rating")
        .in("reviewee_id", ownerIds);

      if (reviewError) {
        setOwnerRatingById({});
        return;
      }

      const tmp: Record<string, { sum: number; count: number }> = {};
      for (const r of reviewData ?? []) {
        const id = (r as { reviewee_id: string; rating: number }).reviewee_id;
        const rating = (r as { reviewee_id: string; rating: number }).rating;
        if (!tmp[id]) tmp[id] = { sum: 0, count: 0 };
        tmp[id].sum += rating;
        tmp[id].count += 1;
      }

      const ratingMap: Record<string, { avg: number; count: number }> = {};
      for (const [id, v] of Object.entries(tmp)) {
        ratingMap[id] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
      }
      setOwnerRatingById(ratingMap);
    };

    load();
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!cityDropdownRef.current) return;
      if (!cityDropdownRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
      if (
        subcategoryDropdownRef.current &&
        !subcategoryDropdownRef.current.contains(e.target as Node)
      ) {
        setSubcategoryOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (!categoryParam) return;
    if (categories.some((c) => c.key === categoryParam)) {
      setCategoryFilter(categoryParam as CategoryKey);
    }
  }, [searchParams]);

  const toggleFavorite = async (itemId: string) => {
    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    if (favoritesByItem[itemId]) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId);
      if (!error) {
        setFavoritesByItem((prev) => ({ ...prev, [itemId]: false }));
      }
      return;
    }

    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, item_id: itemId });
    if (!error) {
      setFavoritesByItem((prev) => ({ ...prev, [itemId]: true }));
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = data.user;
      setIsLoggedIn(Boolean(user));
      setUserId(user?.id ?? null);
      if (user) {
        const { data: favData } = await supabase
          .from("favorites")
          .select("item_id")
          .eq("user_id", user.id);
        const map: Record<string, boolean> = {};
        for (const f of (favData ?? []) as FavoriteRow[]) map[f.item_id] = true;
        setFavoritesByItem(map);
      } else {
        setFavoritesByItem({});
      }
    };

    loadAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setIsLoggedIn(Boolean(user));
      setUserId(user?.id ?? null);
      if (user) {
        const { data: favData } = await supabase
          .from("favorites")
          .select("item_id")
          .eq("user_id", user.id);
        const map: Record<string, boolean> = {};
        for (const f of (favData ?? []) as FavoriteRow[]) map[f.item_id] = true;
        setFavoritesByItem(map);
      } else {
        setFavoritesByItem({});
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const cities = useMemo(() => {
    const map = new Map<string, string>();
    items
      .flatMap((i) => (i.cities && i.cities.length > 0 ? i.cities : [i.city]))
      .filter(Boolean)
      .forEach((raw) => {
        const key = normalizeCity(raw);
        if (!map.has(key)) map.set(key, displayCity(raw));
      });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesQuery =
        q === "" ||
        i.title.toLowerCase().includes(q) ||
        normalizeCity(i.city).includes(q);

      const itemCities =
        i.cities && i.cities.length > 0 ? i.cities : i.city ? [i.city] : [];
      const itemCitiesDisplay = itemCities.map((c) => displayCity(c));
      const matchesCity =
        cityFilter.length === 0 ||
        itemCitiesDisplay.some((c) => cityFilter.includes(c));
      const matchesCategory =
        categoryFilter.length === 0 || (i.category ? categoryFilter.includes(i.category) : false);
      const matchesSubcategory =
        subcategoryFilter.length === 0 ||
        (i.subcategory ? subcategoryFilter.includes(i.subcategory) : false);
      const matchesDate =
        categoryFilter.length === 0 ||
        dateFilter === "" ||
        !(bookedByItem[i.id] ?? []).some(
          (b) => dateFilter >= b.start_date && dateFilter <= b.end_date
        );

      return (
        matchesQuery &&
        matchesCity &&
        matchesCategory &&
        matchesSubcategory &&
        matchesDate
      );
    });
  }, [items, query, cityFilter, categoryFilter, subcategoryFilter, dateFilter, bookedByItem]);

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{t("home_title")}</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
            {t("home_subtitle")}
          </p>
        </div>

        {isLoggedIn && (
          <a
            href="/new-item"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            {t("home_new_item")}
          </a>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <input
          placeholder={t("home_search_placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 240,
            flex: "1 1 240px",
          }}
        />

        <div
          ref={cityDropdownRef}
          style={{ minWidth: 240, position: "relative" }}
        >
          <button
            type="button"
            onClick={() => setCityOpen((v) => !v)}
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
              {cityFilter.length > 0
                ? `${t("home_all_cities")} (${cityFilter.length})`
                : t("home_all_cities")}
            </span>
            <span style={{ opacity: 0.6 }}>▾</span>
          </button>
          {cityOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 20,
                width: "max-content",
                minWidth: 260,
                maxWidth: "90vw",
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "white",
                boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                padding: "10px 12px 12px",
              }}
            >
            <input
              placeholder={t("home_search_placeholder")}
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #ddd",
                marginBottom: 8,
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 8,
                marginBottom: 8,
              }}
            >
                <button
                  type="button"
                  onClick={() => {
                    setCityFilter(cities);
                    setCityOpen(false);
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
                    setCityFilter([]);
                    setCityOpen(false);
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
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {cities
                .filter((c) =>
                  c.toLowerCase().includes(cityInput.trim().toLowerCase())
                )
                .map((c) => (
                  <label
                    key={c}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={cityFilter.includes(c)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCityFilter((prev) => [...prev, c]);
                        } else {
                          setCityFilter((prev) => prev.filter((x) => x !== c));
                        }
                      }}
                    />
                    {c}
                  </label>
                ))}
            </div>
            </div>
          )}
        </div>

        <div ref={categoryDropdownRef} style={{ minWidth: 200, position: "relative" }}>
          <button
            type="button"
            onClick={() => setCategoryOpen((v) => !v)}
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
              {categoryFilter.length > 0
                ? `${t("home_all_categories")} (${categoryFilter.length})`
                : t("home_all_categories")}
            </span>
            <span style={{ opacity: 0.6 }}>▾</span>
          </button>
          {categoryOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 20,
                width: "max-content",
                minWidth: 260,
                maxWidth: "90vw",
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "white",
                boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                padding: "8px 0",
                overflowX: "hidden",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter([]);
                  setSubcategoryFilter([]);
                  setDateFilter("");
                  setCategoryOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {t("home_all_categories")}
              </button>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "6px 12px",
                  flexWrap: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter(categories.map((c) => c.key));
                    setCategoryOpen(false);
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
                      flex: 1,
                      boxSizing: "border-box",
                  }}
                >
                  {t("select_all")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter([]);
                    setSubcategoryFilter([]);
                    setCategoryOpen(false);
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
                      flex: 1,
                      boxSizing: "border-box",
                  }}
                >
                  {t("clear_all")}
                </button>
              </div>
              {categories.map((c) => (
                <label
                  key={c.key}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px" }}
                >
                  <input
                    type="checkbox"
                    checked={categoryFilter.includes(c.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCategoryFilter((prev) => [...prev, c.key]);
                      } else {
                        setCategoryFilter((prev) => prev.filter((x) => x !== c.key));
                        setSubcategoryFilter((prev) =>
                          prev.filter(
                            (s) => !getSubcategories(c.key).some((sc) => sc.key === s)
                          )
                        );
                      }
                    }}
                  />
                  {getCategoryLabel(lang, c.key)}
                </label>
              ))}
            </div>
          )}
        </div>

        <div
          ref={subcategoryDropdownRef}
          style={{
            minWidth: 220,
            position: "relative",
            opacity: categoryFilter.length > 0 ? 1 : 0.6,
          }}
        >
          <button
            type="button"
            disabled={categoryFilter.length === 0}
            onClick={() => setSubcategoryOpen((v) => !v)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: categoryFilter ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              {subcategoryFilter.length > 0
                ? `${t("home_all_subcategories")} (${subcategoryFilter.length})`
                : t("home_all_subcategories")}
            </span>
            <span style={{ opacity: 0.6 }}>▾</span>
          </button>
          {subcategoryOpen && categoryFilter.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 20,
                width: "100%",
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "white",
                boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                padding: "8px 0",
                overflowX: "hidden",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSubcategoryFilter([]);
                  setSubcategoryOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {t("home_all_subcategories")}
              </button>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "6px 12px",
                  flexWrap: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const all = categoryFilter.flatMap((cat) =>
                      getSubcategories(cat).map((s) => s.key)
                    );
                    setSubcategoryFilter(Array.from(new Set(all)));
                    setSubcategoryOpen(false);
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
                      flex: 1,
                      boxSizing: "border-box",
                  }}
                >
                  {t("select_all")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubcategoryFilter([]);
                    setSubcategoryOpen(false);
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
                      flex: 1,
                      boxSizing: "border-box",
                  }}
                >
                  {t("clear_all")}
                </button>
              </div>
              {categoryFilter.flatMap((cat) =>
                getSubcategories(cat).map((s) => ({ ...s, _cat: cat }))
              ).map((s) => (
                <label
                  key={`${s._cat}-${s.key}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px" }}
                >
                  <input
                    type="checkbox"
                    checked={subcategoryFilter.includes(s.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSubcategoryFilter((prev) => [...prev, s.key]);
                      } else {
                        setSubcategoryFilter((prev) => prev.filter((x) => x !== s.key));
                      }
                    }}
                  />
                  {s.label[lang]}
                </label>
              ))}
            </div>
          )}
        </div>

        {categoryFilter && (
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 170,
            }}
          />
        )}
      </div>

      {error && (
        <p style={{ color: "crimson" }}>
          {t("common_error_prefix")} {error}
        </p>
      )}
      {!error && filtered.length === 0 && (
        <p>
          {items.length > 0 ? t("common_no_results_filters") : t("home_no_items")}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((item) => {
          const img = firstImageByItem[item.id];
          const ownerRating = ownerRatingById[item.owner_id];

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
                transition: "transform 120ms ease, box-shadow 120ms ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform =
                  "translateY(-2px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 10px 24px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform =
                  "translateY(0px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 1px 8px rgba(0,0,0,0.04)";
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(item.id);
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
                  color: favoritesByItem[item.id] ? "#d11" : "#666",
                }}
                aria-label={favoritesByItem[item.id] ? "Saved item" : "Save item"}
              >
                {favoritesByItem[item.id] ? "\u2665" : "\u2661"}
              </button>
              {/* Image */}
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

              {/* Content */}
              <div style={{ padding: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.25 }}>
                    {item.title}
                  </h3>
                  <span
                    style={{
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

                <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
                  {formatLocation(item.city, item.neighborhood)}
                </p>
                {ownerRating && (
                  <p style={{ margin: "6px 0 0", opacity: 0.7, fontSize: 13 }}>
                    {t("home_owner_rating")}: {ownerRating.avg} ({ownerRating.count})
                  </p>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </main>
  );
}


