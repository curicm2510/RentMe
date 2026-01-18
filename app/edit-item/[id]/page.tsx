"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Item = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string;
};

export default function EditItemPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setMsg("");
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setMsg("Not logged in.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("id,owner_id,title,description,price_per_day,city")
        .eq("id", id)
        .single();

      if (error) {
        setMsg("Error: " + error.message);
        setLoading(false);
        return;
      }

      const item = data as Item;

      if (item.owner_id !== user.id) {
        setMsg("You are not the owner of this item.");
        setLoading(false);
        return;
      }

      setTitle(item.title);
      setPrice(String(item.price_per_day));
      setCity(item.city);
      setDescription(item.description ?? "");
      setLoading(false);
    };

    load();
  }, [id]);

  const save = async () => {
    if (!id) return;

    setMsg("Saving...");

    const { error } = await supabase
      .from("items")
      .update({
        title,
        price_per_day: Number(price),
        city,
        description: description || null,
      })
      .eq("id", id);

    if (error) setMsg("Error: " + error.message);
    else setMsg("Saved!");
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Edit item</h1>
      {msg && <p>{msg}</p>}

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <input
        placeholder="Price per day"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <input
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8 }}
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%", padding: 8, minHeight: 90 }}
      />

      <button onClick={save} style={{ padding: 10, width: "100%" }}>
        Save
      </button>
    </main>
  );
}