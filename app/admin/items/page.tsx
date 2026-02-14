"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import { CategoryKey, getCategoryLabel, getSubcategoryLabel } from "../../categories";
import { formatDate } from "../../../lib/formatDate";
import Avatar from "../../Avatar";

type Item = {
  id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
  price_per_day: number;
  owner_id: string;
  created_at: string;
  status: string;
  description: string | null;
  category: CategoryKey | null;
  subcategory: string | null;
};

type ItemImageRow = {
  item_id: string;
  url: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

const formatLocation = (city: string, neighborhood: string | null | undefined) =>
  neighborhood ? `${city}, ${neighborhood}` : city;

export default function AdminItemsPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [imagesByItem, setImagesByItem] = useState<Record<string, string[]>>({});
  const [ownersById, setOwnersById] = useState<Record<string, Profile>>({});
  const [imageIndexByItem, setImageIndexByItem] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(["pending"]);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [modalIndex, setModalIndex] = useState(0);

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

  const filteredItems = items.filter(
    (item) => statusFilter.length === 0 || statusFilter.includes(item.status)
  );

  const load = async () => {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setIsAdmin(false);
      setMsg(t("auth_not_logged_go"));
      setItems([]);
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (prof?.role !== "admin") {
      setIsAdmin(false);
      setItems([]);
      setMsg(t("admin_only"));
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("items")
      .select(
        "id,title,city,neighborhood,price_per_day,owner_id,created_at,status,description,category,subcategory"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      setItems([]);
      return;
    }

    const list = (data ?? []) as Item[];
    setItems(list);

    const itemIds = list.map((i) => i.id);
    const ownerIds = Array.from(new Set(list.map((i) => i.owner_id)));

    if (itemIds.length > 0) {
      const { data: imgData } = await supabase
        .from("item_images")
        .select("item_id,url,created_at")
        .in("item_id", itemIds)
        .order("created_at", { ascending: true });

      const map: Record<string, string[]> = {};
      for (const row of (imgData ?? []) as ItemImageRow[]) {
        if (!map[row.item_id]) map[row.item_id] = [];
        map[row.item_id].push(row.url);
      }
      setImagesByItem(map);
      const idxMap: Record<string, number> = {};
      for (const id of Object.keys(map)) {
        idxMap[id] = Math.min(imageIndexByItem[id] ?? 0, map[id].length - 1);
      }
      setImageIndexByItem(idxMap);
    } else {
      setImagesByItem({});
      setImageIndexByItem({});
    }

    if (ownerIds.length > 0) {
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .in("id", ownerIds);

      const map: Record<string, Profile> = {};
      for (const p of ownerData ?? []) map[p.id] = p as Profile;
      setOwnersById(map);
    } else {
      setOwnersById({});
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
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (!modalItemId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!modalItemId) return;
      if (e.key === "Escape") {
        setModalItemId(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        const total = imagesByItem[modalItemId]?.length ?? 0;
        if (total <= 1) return;
        setModalIndex((prev) => (prev - 1 + total) % total);
      }
      if (e.key === "ArrowRight") {
        const total = imagesByItem[modalItemId]?.length ?? 0;
        if (total <= 1) return;
        setModalIndex((prev) => (prev + 1) % total);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalItemId, imagesByItem]);

  const approve = async (itemId: string) => {
    setMsg(t("common_updating"));

    const { error } = await supabase
      .from("items")
      .update({ is_active: true, status: "approved" })
      .eq("id", itemId);

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    const approvedItem = items.find((i) => i.id === itemId);
    if (approvedItem) {
      await supabase.from("notifications").insert({
        user_id: approvedItem.owner_id,
        type: "item_approved",
        data: { item_id: approvedItem.id, item_title: approvedItem.title },
      });
    }

    load();
  };

  const reject = async (itemId: string) => {
    const ok = confirm(t("admin_reject_confirm"));
    if (!ok) return;

    setMsg(t("common_updating"));

    const { error } = await supabase
      .from("items")
      .update({ is_active: false, status: "rejected" })
      .eq("id", itemId);

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    const rejectedItem = items.find((i) => i.id === itemId);
    if (rejectedItem) {
      await supabase.from("notifications").insert({
        user_id: rejectedItem.owner_id,
        type: "item_rejected",
        data: { item_id: rejectedItem.id, item_title: rejectedItem.title },
      });
    }

    load();
  };

  const remove = async (itemId: string) => {
    const ok = confirm(t("admin_delete_confirm"));
    if (!ok) return;

    setMsg(t("common_updating"));

    const { error } = await supabase.from("items").delete().eq("id", itemId);

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    load();
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
        <h1 style={{ margin: 0 }}>{t("admin_items_title")}</h1>
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
                width: "100%",
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
      </div>
      {renderMsg()}

      {isAdmin && items.length === 0 && !msg && <p>{t("admin_no_items")}</p>}
      {isAdmin && items.length > 0 && filteredItems.length === 0 && !msg && (
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
            }}
          >
            <h3 style={{ margin: 0 }}>
              <a href={`/item/${item.id}`}>{item.title}</a>
            </h3>
            <p style={{ margin: "6px 0 10px" }}>
              {formatLocation(item.city, item.neighborhood)} -{" "}
              {item.price_per_day} EUR {t("per_day")}
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("category_label")}: <b>{item.category ? getCategoryLabel(lang, item.category) : "-"}</b>
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("subcategory_label")}: <b>{item.category && item.subcategory
                ? getSubcategoryLabel(lang, item.category, item.subcategory)
                : "-"}</b>
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("item_description")}: {item.description ?? "-"}
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("item_owner")}:{" "}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Avatar url={ownersById[item.owner_id]?.avatar_url ?? null} size={18} alt="Avatar" />
                <a href={`/profile/${item.owner_id}`}>
                  {ownersById[item.owner_id]?.full_name ?? "-"}
                </a>
              </span>
              {ownersById[item.owner_id]?.email
                ? ` (${ownersById[item.owner_id]?.email})`
                : ""}
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("item_posted")}: {formatDate(item.created_at)}
            </p>
            <p style={{ margin: "6px 0" }}>
              {t("admin_filter_status")}: {" "}
              <b>
                {item.status === "approved"
                  ? t("status_approved")
                  : item.status === "rejected"
                  ? t("status_rejected")
                  : t("status_pending")}
              </b>
            </p>
            {(imagesByItem[item.id] ?? []).length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                <button
                  type="button"
                  onClick={() =>
                    setImageIndexByItem((prev) => {
                      const total = imagesByItem[item.id]?.length ?? 0;
                      if (total <= 1) return prev;
                      const next = ((prev[item.id] ?? 0) - 1 + total) % total;
                      return { ...prev, [item.id]: next };
                    })
                  }
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = Math.min(
                      imageIndexByItem[item.id] ?? 0,
                      imagesByItem[item.id].length - 1
                    );
                    setModalItemId(item.id);
                    setModalIndex(idx);
                  }}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={
                      imagesByItem[item.id][
                        Math.min(
                          imageIndexByItem[item.id] ?? 0,
                          imagesByItem[item.id].length - 1
                        )
                      ]
                    }
                    alt={item.title}
                    style={{
                      width: 140,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #eee",
                      display: "block",
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImageIndexByItem((prev) => {
                      const total = imagesByItem[item.id]?.length ?? 0;
                      if (total <= 1) return prev;
                      const next = ((prev[item.id] ?? 0) + 1) % total;
                      return { ...prev, [item.id]: next };
                    })
                  }
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                  aria-label="Next image"
                >
                  ›
                </button>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {(imageIndexByItem[item.id] ?? 0) + 1}/{imagesByItem[item.id].length}
                </div>
              </div>
            )}
            {item.status === "pending" && (
              <>
                <button
                  onClick={() => approve(item.id)}
                  style={{ padding: "8px 10px", marginRight: 8 }}
                >
                  {t("admin_approve")}
                </button>
                <button onClick={() => reject(item.id)} style={{ padding: "8px 10px" }}>
                  {t("admin_reject")}
                </button>
              </>
            )}
            <button
              onClick={() => remove(item.id)}
              style={{ padding: "8px 10px", marginLeft: 8 }}
            >
              {t("admin_delete")}
            </button>
          </li>
        ))}
      </ul>

      {modalItemId && (
        <div
          onClick={() => setModalItemId(null)}
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
              maxWidth: 720,
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
                {(modalIndex + 1)}/{(imagesByItem[modalItemId] ?? []).length}
              </div>
              <button
                type="button"
                onClick={() => setModalItemId(null)}
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
                onClick={() => {
                  const total = imagesByItem[modalItemId]?.length ?? 0;
                  if (total <= 1) return;
                  setModalIndex((prev) => (prev - 1 + total) % total);
                }}
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
                src={(imagesByItem[modalItemId] ?? [])[modalIndex]}
                alt="Preview"
                style={{
                  width: "max-content",
                  minWidth: "100%",
                  maxWidth: "90vw",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const total = imagesByItem[modalItemId]?.length ?? 0;
                  if (total <= 1) return;
                  setModalIndex((prev) => (prev + 1) % total);
                }}
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
          </div>
        </div>
      )}
    </main>
  );
}

