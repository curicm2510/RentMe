"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import {
  CategoryKey,
  categories,
  getCategoryLabel,
  getSubcategories,
} from "../../categories";
import { citiesHr } from "../../cities_hr";
import { neighborhoodsByCity } from "../../neighborhoods_hr";

type Item = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  price_3_days: number | null;
  price_7_days: number | null;
  city: string;
  neighborhood?: string | null;
  category: CategoryKey | null;
  subcategory: string | null;
};

type ItemImage = {
  id: string;
  url: string;
  created_at: string;
};

type DisplayItem =
  | { kind: "saved"; img: ItemImage }
  | { kind: "pending"; id: string; url: string };

const getStoragePathFromUrl = (url: string) => {
  const clean = url.split("?")[0];
  const marker = "/item-images/";
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(clean.slice(idx + marker.length));
};

export default function EditItemPage() {
  const { t, lang } = useI18n();
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [price3, setPrice3] = useState("");
  const [price7, setPrice7] = useState("");
  const [cancelPolicy, setCancelPolicy] = useState<"flexible" | "medium" | "strict">(
    "flexible"
  );
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [images, setImages] = useState<ItemImage[]>([]);
  const [imgMsg, setImgMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<{ id: string; file: File; url: string }[]>(
    []
  );
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<ItemImage[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const initialRef = useRef<{
    title: string;
    price: string;
    price3: string;
    price7: string;
    cancelPolicy: "flexible" | "medium" | "strict";
    city: string;
    neighborhood: string;
    description: string;
    category: CategoryKey | "";
    subcategory: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const renderMsg = () => {
    if (!msg) return null;
    if (msg === t("auth_not_logged_go")) {
      return (
        <div style={{ marginTop: 8 }}>
          {t("auth_not_logged")}.{" "}
          <a href="/auth">{t("auth_go_to_login")}</a>.
        </div>
      );
    }
    return <div style={{ marginTop: 8 }}>{msg}</div>;
  };

  const loadItem = async (showLoading = true) => {
    if (!id) return;

    setMsg("");
    setImgMsg("");
    if (showLoading) setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg(t("auth_not_logged_go"));
      if (showLoading) setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select(
        "id,owner_id,title,description,price_per_day,price_3_days,price_7_days,cancellation_policy,city,neighborhood,category,subcategory"
      )
      .eq("id", id)
      .single();

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      if (showLoading) setLoading(false);
      return;
    }

    const item = data as Item;

    if (item.owner_id !== user.id) {
      setMsg(t("edit_item_not_owner"));
      if (showLoading) setLoading(false);
      return;
    }

    const nextTitle = item.title;
    const nextPrice = String(item.price_per_day);
    const nextPrice3 = item.price_3_days ? String(item.price_3_days) : "";
    const nextPrice7 = item.price_7_days ? String(item.price_7_days) : "";
    const nextCancel =
      (item.cancellation_policy as "flexible" | "medium" | "strict") ?? "flexible";
    const nextCity = item.city ?? "";
    const nextNeighborhood = item.neighborhood ?? "";
    const nextDesc = item.description ?? "";
    const nextCategory = item.category ?? "";
    const nextSubcategory = item.subcategory ?? "";

    setTitle(nextTitle);
    setPrice(nextPrice);
    setPrice3(nextPrice3);
    setPrice7(nextPrice7);
    setCancelPolicy(nextCancel);
    setCity(nextCity);
    setNeighborhood(nextNeighborhood);
    setDescription(nextDesc);
    setCategory(nextCategory);
    setSubcategory(nextSubcategory);

    const { data: imgData } = await supabase
      .from("item_images")
      .select("id,url,created_at")
      .eq("item_id", id)
      .order("created_at", { ascending: true });
    const nextImages = (imgData ?? []) as ItemImage[];
    setImages(nextImages);
    setPendingItems([]);
    setDisplayItems(nextImages.map((img) => ({ kind: "saved" as const, img })));
    setPendingDeletes([]);
    initialRef.current = {
      title: nextTitle,
      price: nextPrice,
      price3: nextPrice3,
      price7: nextPrice7,
      cancelPolicy: nextCancel,
      city: nextCity,
      neighborhood: nextNeighborhood,
      description: nextDesc,
      category: nextCategory,
      subcategory: nextSubcategory,
    };

    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    loadItem(true);
  }, [id]);

  useEffect(() => {
    if (!fileDialogOpen) return;
    const onFocus = () => {
      setFileDialogOpen(false);
      const hasFiles = (fileInputRef.current?.files?.length ?? 0) > 0;
      if (!hasFiles) setImgMsg(t("common_cancel"));
    };
    window.addEventListener("focus", onFocus, { once: true });
    return () => window.removeEventListener("focus", onFocus);
  }, [fileDialogOpen, t]);

  const save = async () => {
    if (!id) return;

    setMsg(t("edit_item_saving"));

    const remainingImages = displayItems.length;

    if (!price.trim()) {
      setMsg(t("price_required"));
      return;
    }
    if (Number.isNaN(Number(price)) || Number(price) < 1) {
      setMsg(t("price_number_only"));
      return;
    }
    if (price3.trim() && (Number.isNaN(Number(price3)) || Number(price3) < 1)) {
      setMsg(t("price_number_only"));
      return;
    }
    if (price7.trim() && (Number.isNaN(Number(price7)) || Number(price7) < 1)) {
      setMsg(t("price_number_only"));
      return;
    }
    if (!city || !citiesHr.includes(city)) {
      setMsg(t("city_required"));
      return;
    }
    if (Object.keys(neighborhoodsByCity).includes(city) && !neighborhood) {
      setMsg(t("neighborhood_required"));
      return;
    }
    if (!category) {
      setMsg(t("category_required"));
      return;
    }

    if (!subcategory) {
      setMsg(t("subcategory_required"));
      return;
    }
    if (remainingImages === 0) {
      setMsg(t("images_required"));
      return;
    }

    try {
      const price3Value = price3.trim() === "" ? null : Number(price3);
      const price7Value = price7.trim() === "" ? null : Number(price7);

      const { error } = await supabase
        .from("items")
        .update({
          title,
          price_per_day: Number(price),
          price_3_days: price3Value,
          price_7_days: price7Value,
          cancellation_policy: cancelPolicy,
          city,
          neighborhood,
          description: description || null,
          category,
          subcategory,
        })
        .eq("id", id);

      if (error) {
        setMsg(`${t("common_error_prefix")} ${error.message}`);
        return;
      }

      setImgMsg("");
      setUploading(true);

      for (const img of pendingDeletes) {
        const storagePath = getStoragePathFromUrl(img.url);
        if (storagePath) {
          const { error: storageError } = await supabase.storage
            .from("item-images")
            .remove([storagePath]);
          if (storageError) {
            throw new Error(t("edit_item_image_delete_failed") + " " + storageError.message);
          }
        }
      }

      const pendingById = new Map(pendingItems.map((p) => [p.id, p]));
      const finalUrls: string[] = [];
      let userId: string | null = null;
      if (displayItems.some((entry) => entry.kind === "pending")) {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          setMsg(t("auth_not_logged_go"));
          return;
        }
        userId = user.id;
      }

      for (const entry of displayItems) {
        if (entry.kind === "saved") {
          finalUrls.push(entry.img.url);
          continue;
        }
        const pending = pendingById.get(entry.id);
        if (!pending) continue;
        if (!userId) {
          setMsg(t("auth_not_logged_go"));
          return;
        }
        const file = pending.file;
        const fileExt = file.name.split(".").pop() || "jpg";
        const uuid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now());
        const filePath = `${userId}/${id}/${uuid}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(filePath, file, { upsert: false });

          if (uploadError) {
            throw new Error(t("edit_item_image_upload_failed") + " " + uploadError.message);
          }

          const { data: publicData } = supabase.storage
            .from("item-images")
            .getPublicUrl(filePath);

          const publicUrl = publicData.publicUrl;

          const { error: imgError } = await supabase.from("item_images").insert({
            item_id: id,
            url: publicUrl,
          });

          if (imgError) {
            throw new Error(t("edit_item_image_upload_failed") + " " + imgError.message);
          }
          finalUrls.push(publicUrl);
      }

      if (finalUrls.length > 0) {
        await supabase.from("item_images").delete().eq("item_id", id);
        const { error: reorderErr } = await supabase.from("item_images").insert(
          finalUrls.map((url) => ({
            item_id: id,
            url,
          }))
        );
        if (reorderErr) {
          throw new Error(t("edit_item_image_upload_failed") + " " + reorderErr.message);
        }
      }

      const { data: imgData } = await supabase
        .from("item_images")
        .select("id,url,created_at")
        .eq("item_id", id)
        .order("created_at", { ascending: true });
      const refreshed = (imgData ?? []) as ItemImage[];
      setImages(refreshed);
      setDisplayItems(refreshed.map((img) => ({ kind: "saved" as const, img })));
      pendingItems.forEach((p) => URL.revokeObjectURL(p.url));
      setPendingItems([]);
      setPendingDeletes([]);
      setMsg(t("edit_item_saved"));
    } catch (e: any) {
      const message = e?.message || "Error";
      setImgMsg(message);
      setMsg(message);
    } finally {
      setUploading(false);
    }
  };

  const queueUpload = (file: File) => {
    setImgMsg("");
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const url = URL.createObjectURL(file);
    setPendingItems((prev) => [...prev, { id, file, url }]);
    setDisplayItems((prev) => [...prev, { kind: "pending", id, url }]);
  };

  const queueDelete = (img: ItemImage) => {
    const ok = confirm(t("edit_item_delete_confirm"));
    if (!ok) return;
    setPendingDeletes((prev) => [...prev, img]);
    setImages((prev) => prev.filter((x) => x.id !== img.id));
    setDisplayItems((prev) => prev.filter((entry) => entry.kind !== "saved" || entry.img.id !== img.id));
  };

  const removePending = (id: string) => {
    setPendingItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
    setDisplayItems((prev) => prev.filter((entry) => entry.kind !== "pending" || entry.id !== id));
  };

  const isDirty = () => {
    const initial = initialRef.current;
    if (!initial) return false;
    if (pendingItems.length > 0 || pendingDeletes.length > 0) return true;
    if (title !== initial.title) return true;
    if (price !== initial.price) return true;
    if (price3 !== initial.price3) return true;
    if (price7 !== initial.price7) return true;
    if (cancelPolicy !== initial.cancelPolicy) return true;
    if (description !== initial.description) return true;
    if (category !== initial.category) return true;
    if (subcategory !== initial.subcategory) return true;
    if (city !== initial.city) return true;
    if (neighborhood !== initial.neighborhood) return true;
    return false;
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>{t("common_loading")}</p>
      </main>
    );
  }

  const hasNeighborhoods = Object.keys(neighborhoodsByCity).includes(city);
  const moveDisplay = (from: number, to: number) => {
    if (to < 0 || to >= displayItems.length) return;
    const next = [...displayItems];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const pendingById = new Map(pendingItems.map((p) => [p.id, p]));
    const nextImages: ItemImage[] = [];
    const nextPending: { id: string; file: File; url: string }[] = [];
    for (const entry of next) {
      if (entry.kind === "saved") nextImages.push(entry.img);
      else {
        const p = pendingById.get(entry.id);
        if (p) nextPending.push(p);
      }
    }
    setDisplayItems(next);
    setImages(nextImages);
    setPendingItems(nextPending);
  };

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>{t("edit_item_title")}</h1>

      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("new_item_title_label")} <span style={{ color: "#d11" }}>*</span>
      </div>
      <input
        placeholder={t("new_item_title_ph")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          border: "1px solid #111",
          borderRadius: 8,
        }}
      />

      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("category_label")} <span style={{ color: "#d11" }}>*</span>
      </div>
      <select
        value={category}
        onChange={(e) => {
          const next = e.target.value as CategoryKey | "";
          setCategory(next);
          setSubcategory("");
        }}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          border: "1px solid #111",
          borderRadius: 8,
        }}
      >
        <option value="">{t("select_category")}</option>
        {categories.map((c) => (
          <option key={c.key} value={c.key}>
            {getCategoryLabel(lang, c.key)}
          </option>
        ))}
      </select>

      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("subcategory_label")} <span style={{ color: "#d11" }}>*</span>
      </div>
      <select
        value={subcategory}
        onChange={(e) => setSubcategory(e.target.value)}
        disabled={!category}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          border: "1px solid #111",
          borderRadius: 8,
        }}
      >
        <option value="">{t("select_subcategory")}</option>
        {getSubcategories(category).map((s) => (
          <option key={s.key} value={s.key}>
            {s.label[lang]}
          </option>
        ))}
      </select>

      <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>
        {t("price_section_title")}
      </div>
      {/* remove repeated description on edit page */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
        <div>
          <div style={{ fontWeight: 600, margin: "6px 0 4px", whiteSpace: "nowrap" }}>
            {t("price_1_day")} <span style={{ color: "#d11" }}>*</span>
          </div>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.6,
              }}
            >
              {"\u20AC"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              step="0.01"
              placeholder=""
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 8px 8px 24px",
                border: "1px solid #111",
                borderRadius: 8,
              }}
            />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, margin: "6px 0 4px", whiteSpace: "nowrap" }}>
            {t("price_3_days")}
          </div>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.6,
              }}
            >
              {"\u20AC"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              step="0.01"
              placeholder=""
              value={price3}
              onChange={(e) => setPrice3(e.target.value.replace(/[^\d.]/g, ""))}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 8px 8px 24px",
                border: "1px solid #111",
                borderRadius: 8,
              }}
            />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, margin: "6px 0 4px", whiteSpace: "nowrap" }}>
            {t("price_7_days")}
          </div>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.6,
              }}
            >
              {"\u20AC"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              step="0.01"
              placeholder=""
              value={price7}
              onChange={(e) => setPrice7(e.target.value.replace(/[^\d.]/g, ""))}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 8px 8px 24px",
                border: "1px solid #111",
                borderRadius: 8,
              }}
            />
          </div>
        </div>
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        {t("price_optional_note")}
      </div>


            <div style={{ fontWeight: 700, margin: "12px 0 6px" }}>
        {t("cancel_terms_title")}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        {(["flexible", "medium", "strict"] as const).map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="cancel_policy_edit"
              value={opt}
              checked={cancelPolicy === opt}
              onChange={() => setCancelPolicy(opt)}
            />
            {opt === "flexible"
              ? t("cancel_flexible")
              : opt === "medium"
                ? t("cancel_medium")
                : t("cancel_strict")}
          </label>
        ))}
      </div>
      <p style={{ marginTop: 0, opacity: 0.7 }}>
        {cancelPolicy === "flexible"
          ? t("cancel_flexible_desc")
          : cancelPolicy === "medium"
            ? t("cancel_medium_desc")
            : t("cancel_strict_desc")}
      </p>
      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("new_item_city_label")} <span style={{ color: "#d11" }}>*</span>
      </div>
      <select
        value={city}
        onChange={(e) => {
          const nextCity = e.target.value;
          setCity(nextCity);
          if (nextCity !== city) setNeighborhood("");
        }}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          border: "1px solid #111",
          borderRadius: 8,
        }}
      >
        <option value="">{t("new_item_city_ph")}</option>
        {citiesHr.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {hasNeighborhoods && (
        <>
          <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
            {t("new_item_neighborhood_label")} <span style={{ color: "#d11" }}>*</span>
          </div>
          <select
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            style={{
              display: "block",
              marginBottom: 8,
              width: "100%",
              padding: 8,
              border: "1px solid #111",
              borderRadius: 8,
              background: "white",
            }}
          >
            <option value="">{t("new_item_neighborhood_ph")}</option>
            {(neighborhoodsByCity[city] ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </>
      )}

      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("new_item_desc_label")}
      </div>
      <textarea
        placeholder={t("new_item_desc_ph")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          minHeight: 90,
          border: "1px solid #111",
          borderRadius: 8,
        }}
      />

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {t("edit_item_images")} <span style={{ color: "#d11" }}>*</span>
        </div>
        {displayItems.length === 0 ? (
          <div style={{ marginBottom: 8, opacity: 0.7 }}>{t("edit_item_no_images")}</div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            {displayItems.map((entry, idx) => (
              <div
                key={entry.kind === "saved" ? entry.img.id : `pending-${entry.id}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  padding: 6,
                  width: 120,
                  cursor: "grab",
                  opacity: dragIndex === idx ? 0.6 : 1,
                }}
                onDragEnd={() => setDragIndex(null)}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === idx) return;
                  moveDisplay(dragIndex, idx);
                  setDragIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragIndex(null);
                }}
              >
                <img
                  src={entry.kind === "saved" ? entry.img.url : entry.url}
                  alt="Item"
                  style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6 }}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(idx));
                  }}
                />
                <button
                  onClick={() =>
                    entry.kind === "saved" ? queueDelete(entry.img) : removePending(entry.id)
                  }
                  style={{
                    marginTop: 6,
                    width: "100%",
                    border: "1px solid #eee",
                    background: "white",
                    borderRadius: 6,
                    padding: "4px 6px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {t("edit_item_delete_image")}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setFileDialogOpen(true);
              fileInputRef.current?.click();
            }}
            style={{
              padding: "6px 10px",
              border: "1px solid #111",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            {t("upload_choose")}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {pendingItems.length === 0
              ? t("upload_none")
              : `${t("upload_selected")} ${pendingItems.length}`}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            disabled={uploading}
            onClick={() => setFileDialogOpen(true)}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) queueUpload(file);
              e.currentTarget.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>
        {pendingItems.length > 0 && (
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {t("edit_item_pending_uploads")}: {pendingItems.length}
            {pendingItems.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 6 }}>
                <span>{p.file.name}</span>
                <button
                  onClick={() => removePending(p.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#555",
                    cursor: "pointer",
                  }}
                >
                  {t("edit_item_remove_pending")}
                </button>
              </div>
            ))}
          </div>
        )}
        {pendingDeletes.length > 0 && (
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {t("edit_item_pending_deletes")}: {pendingDeletes.length}
          </div>
        )}
        {imgMsg && <div style={{ fontSize: 12 }}>{imgMsg}</div>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={save} style={{ padding: 10, width: "100%" }}>
          {t("edit_item_save")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (isDirty()) {
              const ok = confirm(t("edit_item_cancel_confirm"));
              if (!ok) return;
            }
            router.push("/my-items");
          }}
          style={{ padding: 10, width: "100%", background: "white" }}
        >
          {t("common_cancel")}
        </button>
      </div>
      {renderMsg()}
    </main>
  );
}


