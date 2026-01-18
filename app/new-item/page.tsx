"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NewItemPage() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  const createItem = async () => {
    setMsg("Saving...");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("Not logged in. Go to /auth and sign in.");
      return;
    }

    // 1) create item
    const { data: insertedItem, error: insertError } = await supabase
      .from("items")
      .insert({
        owner_id: user.id,
        title,
        price_per_day: Number(price),
        city,
        description: description || null,
      })
      .select("id")
      .single();

    if (insertError || !insertedItem) {
      setMsg("Error creating item: " + (insertError?.message ?? ""));
      return;
    }

    const itemId = insertedItem.id as string;

    // 2) if no file selected → done
    if (!file) {
      setMsg("Item created (no image).");
      resetForm();
      return;
    }

    // 3) upload image to storage
    const fileExt = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/${itemId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-images")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      setMsg("Item created, but image upload failed: " + uploadError.message);
      return;
    }

    // 4) get public URL
    const { data: publicData } = supabase.storage
      .from("item-images")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // 5) save url to item_images table
    const { error: imgError } = await supabase.from("item_images").insert({
      item_id: itemId,
      url: publicUrl,
    });

    if (imgError) {
      setMsg("Item created, image uploaded, but DB save failed: " + imgError.message);
      return;
    }

    setMsg("Item + image created!");
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setCity("");
    setDescription("");
    setFile(null);
  };

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>New item</h1>

      <input
        placeholder="Title (e.g. Bušilica)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <input
        placeholder="Price per day (e.g. 10)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <input
        placeholder="City (e.g. Zagreb)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          display: "block",
          marginBottom: 8,
          width: "100%",
          padding: 8,
          minHeight: 90,
        }}
      />

      {/* IMAGE UPLOAD */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ display: "block", marginBottom: 12, width: "100%" }}
      />

      <button onClick={createItem} style={{ padding: 10, width: "100%" }}>
        Create
      </button>

      <p>{msg}</p>
    </main>
  );
}