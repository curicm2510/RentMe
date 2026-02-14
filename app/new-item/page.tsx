"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";
import {
  CategoryKey,
  categories,
  getCategoryLabel,
  getSubcategories,
} from "../categories";
import { citiesHr } from "../cities_hr";
import { neighborhoodsByCity } from "../neighborhoods_hr";

export default function NewItemPage() {
  const { t, lang } = useI18n();
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
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const movePreview = (from: number, to: number) => {
    if (to < 0 || to >= previews.length) return;
    setPreviews((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const hasChanges =
      title.trim() !== "" ||
      price.trim() !== "" ||
      price3.trim() !== "" ||
      price7.trim() !== "" ||
      city.trim() !== "" ||
      neighborhood.trim() !== "" ||
      description.trim() !== "" ||
      category !== "" ||
      subcategory !== "" ||
      files.length > 0;
    setIsDirty(hasChanges);
  }, [
    title,
    price,
    price3,
    price7,
    city,
    neighborhood,
    description,
    category,
    subcategory,
    files,
  ]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, saving]);

  useEffect(() => {
    if (!fileDialogOpen) return;
    const onFocus = () => {
      setFileDialogOpen(false);
      const hasFiles = (fileInputRef.current?.files?.length ?? 0) > 0;
      if (!hasFiles) setMsg(t("common_cancel"));
    };
    window.addEventListener("focus", onFocus, { once: true });
    return () => window.removeEventListener("focus", onFocus);
  }, [fileDialogOpen, t]);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), ms);
    });
    const result = await Promise.race([promise, timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return result as T;
  };

  const createItem = async () => {
    if (saving) return;
    setSaving(true);
    setMsg(t("new_item_saving"));

    try {
      const userData = await withTimeout(supabase.auth.getUser());
      const user = userData.data.user;

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      const sessionData = await withTimeout(supabase.auth.getSession());
      const accessToken = sessionData.data.session?.access_token;
      const userId = sessionData.data.session?.user?.id;
      if (!accessToken || !userId) {
        window.location.href = "/auth";
        return;
      }
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
      if (files.length === 0) {
        setMsg(t("images_required"));
        return;
      }

      // 1) create item (server route)
      const price3Value = price3.trim() === "" ? null : Number(price3);
      const price7Value = price7.trim() === "" ? null : Number(price7);

      const createRes = await withTimeout(
        fetch("/api/items/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            item: {
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
            },
          }),
        })
      );

      const createJson = await createRes.json();
      if (!createRes.ok) {
        setMsg(t("new_item_error_create") + " " + (createJson.error || ""));
        return;
      }

      const itemId = createJson.id as string;

      // 2) upload images to storage
      for (const file of files) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const filePath = `${userId}/${itemId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await withTimeout(
          supabase.storage.from("item-images").upload(filePath, file, { upsert: false })
        );

        if (uploadError) {
          setMsg(t("new_item_upload_failed") + " " + uploadError.message);
          return;
        }

        // 4) get public URL
        const { data: publicData } = supabase.storage
          .from("item-images")
          .getPublicUrl(filePath);

        const publicUrl = publicData.publicUrl;

        // 5) save url to item_images table (server route)
        const imgRes = await withTimeout(
          fetch("/api/items/add-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, itemId, url: publicUrl }),
          })
        );

        const imgJson = await imgRes.json();
        if (!imgRes.ok) {
          setMsg(t("new_item_db_save_failed") + " " + (imgJson.error || ""));
          return;
        }
      }

      setMsg(t("new_item_created"));
      resetForm();
    } catch (e: any) {
      setMsg(t("new_item_error_create") + " " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setPrice3("");
    setPrice7("");
    setCancelPolicy("flexible");
    setCity("");
    setNeighborhood("");
    setDescription("");
    setCategory("");
    setSubcategory("");
    setFiles([]);
    previews.forEach((src) => URL.revokeObjectURL(src));
    setPreviews([]);
  };

  const hasNeighborhoods = Object.keys(neighborhoodsByCity).includes(city);

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>{t("new_item_title")}</h1>

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
              min="1"
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
              min="1"
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
              min="1"
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
              name="cancel_policy"
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

      {/* IMAGE UPLOAD */}
      <div style={{ fontWeight: 600, margin: "6px 0 4px" }}>
        {t("edit_item_images")} <span style={{ color: "#d11" }}>*</span>
      </div>
      <label
        htmlFor="new-item-images"
        style={{
          width: 84,
          height: 84,
          border: "1px dashed #bbb",
          borderRadius: 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 12,
          fontSize: 24,
          color: "#666",
        }}
        onClick={() => setFileDialogOpen(true)}
      >
        +
      </label>
      <input
        id="new-item-images"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onClick={() => setFileDialogOpen(true)}
        onChange={(e) => {
          const addedFiles = Array.from(e.target.files ?? []);
          if (addedFiles.length === 0) return;
          setFiles((prev) => [...prev, ...addedFiles]);
          const urls = addedFiles.map((f) => URL.createObjectURL(f));
          setPreviews((prev) => [...prev, ...urls]);
          e.currentTarget.value = "";
        }}
        style={{ display: "none" }}
      />
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {previews.map((src, idx) => (
            <div
              key={`${src}-${idx}`}
              style={{
                position: "relative",
                cursor: "grab",
                opacity: dragIndex === idx ? 0.6 : 1,
              }}
              onDragEnd={() => setDragIndex(null)}
              onDragEnter={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === idx) return;
                movePreview(dragIndex, idx);
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
                src={src}
                alt="Preview"
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                }}
                style={{
                  width: 80,
                  height: 60,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #eee",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const nextFiles = files.filter((_, i) => i !== idx);
                  const nextPreviews = previews.filter((_, i) => i !== idx);
                  URL.revokeObjectURL(src);
                  setFiles(nextFiles);
                  setPreviews(nextPreviews);
                }}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "1px solid #ddd",
                  background: "white",
                  fontSize: 12,
                  lineHeight: "16px",
                  cursor: "pointer",
                }}
                aria-label="Remove image"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={createItem}
        disabled={saving}
        style={{ padding: 10, width: "100%" }}
      >
        {t("new_item_create")}
      </button>
      <p style={{ marginTop: 8, opacity: 0.7 }}>{t("new_item_pending_notice")}</p>

      <p>{msg}</p>
    </main>
  );
}











