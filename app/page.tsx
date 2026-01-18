"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  created_at: string;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      setError(null);

      // 1) load items
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("id, title, price_per_day, city, created_at")
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
    };

    load();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(items.map((i) => i.city).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesQuery =
        q === "" ||
        i.title.toLowerCase().includes(q) ||
        i.city.toLowerCase().includes(q);

      const matchesCity = cityFilter === "" || i.city === cityFilter;

      return matchesQuery && matchesCity;
    });
  }, [items, query, cityFilter]);

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
          <h1 style={{ margin: 0 }}>Items for rent</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
            Find tools, gear and more near you.
          </p>
        </div>

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
          + New item
        </a>
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
          placeholder="Search by title or city..."
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

        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 180,
          }}
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!error && filtered.length === 0 && <p>No items yet.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((item) => {
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
                transition: "transform 120ms ease, box-shadow 120ms ease",
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
                    {item.price_per_day} € / day
                  </span>
                </div>

                <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
                  {item.city}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </main>
  );
}