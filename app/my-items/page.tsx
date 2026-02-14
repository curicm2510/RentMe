"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";

type Item = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  neighborhood?: string | null;
  created_at: string;
  status?: string | null;
};

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

export default function MyItemsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [firstImageByItem, setFirstImageByItem] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);

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

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select("id,title,price_per_day,city,neighborhood,created_at,status")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      setItems([]);
      setFirstImageByItem({});
      return;
    }

    const list = data ?? [];
    setItems(list);

    const ids = list.map((x) => x.id);
    if (ids.length === 0) {
      setFirstImageByItem({});
      return;
    }

    const { data: imgData, error: imgError } = await supabase
      .from("item_images")
      .select("item_id,url,created_at")
      .in("item_id", ids)
      .order("created_at", { ascending: true });

    if (imgError) {
      setFirstImageByItem({});
      return;
    }

    const map: Record<string, string> = {};
    for (const row of (imgData ?? []) as ItemImageRow[]) {
      if (!map[row.item_id]) map[row.item_id] = row.url;
    }
    setFirstImageByItem(map);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const deleteItem = async (id: string) => {
    const ok = confirm(t("my_items_delete_confirm"));
    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) setMsg(`${t("common_error_prefix")} ${error.message}`);
    else {
      setMsg(t("my_items_deleted"));
      load();
    }
  };

  const statusLabel = (status?: string | null) => {
    if (status === "approved") return t("status_approved");
    if (status === "rejected") return t("status_rejected");
    return t("status_pending");
  };

  const filteredItems = items.filter(
    (item) => statusFilter.length === 0 || statusFilter.includes(item.status ?? "pending")
  );

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
        <h1 style={{ margin: 0 }}>{t("my_items_title")}</h1>
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
                      setStatusFilter(["pending", "approved", "rejected"]);
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
        </div>
      </div>
      {renderMsg()}

      {items.length === 0 && !msg && <p>{t("my_items_no_items")}</p>}
      {items.length > 0 && filteredItems.length === 0 && !msg && (
        <p>{t("common_no_results_filters")}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredItems.map((item) => (
          <li
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <a
              href={`/item/${item.id}`}
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
              {firstImageByItem[item.id] ? (
                <img
                  src={firstImageByItem[item.id]}
                  alt={item.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </a>

            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>
                <a href={`/item/${item.id}`}>{item.title}</a>
              </h3>
              <p style={{ margin: "6px 0 10px" }}>
                {formatLocation(item.city, item.neighborhood)} —{" "}
                {item.price_per_day} € / day
              </p>
              <p style={{ margin: "0 0 10px", opacity: 0.7 }}>
                {t("common_status")}: <b>{statusLabel(item.status)}</b>
              </p>
              {item.status === "pending" && (
                <p style={{ margin: "0 0 10px", opacity: 0.7 }}>
                  {t("new_item_pending_notice")}
                </p>
              )}

              <a href={`/edit-item/${item.id}`} style={{ marginRight: 12 }}>
                {t("common_edit")}
              </a>

              <button onClick={() => deleteItem(item.id)}>
                {t("common_delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}



