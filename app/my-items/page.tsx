"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  price_per_day: number;
  city: string;
  created_at: string;
};

export default function MyItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState<string>("");

  const load = async () => {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("Not logged in. Go to Login.");
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select("id,title,price_per_day,city,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) setMsg("Error: " + error.message);
    else setItems(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const deleteItem = async (id: string) => {
    const ok = confirm("Delete this item?");
    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) setMsg("Error: " + error.message);
    else {
      setMsg("Deleted.");
      load();
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>My items</h1>
      {msg && <p>{msg}</p>}

      {items.length === 0 && !msg && <p>No items yet.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
            }}
          >
            <h3 style={{ margin: 0 }}>{item.title}</h3>
            <p style={{ margin: "6px 0 10px" }}>
              {item.city} — {item.price_per_day} € / day
            </p>

            <a href={`/edit-item/${item.id}`} style={{ marginRight: 12 }}>
              Edit
            </a>

            <button onClick={() => deleteItem(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}