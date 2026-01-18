"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Booking = {
  id: string;
  item_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  created_at: string;
  paid_at: string | null;
};

type Item = {
  id: string;
  title: string;
  city: string;
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [msg, setMsg] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("Not logged in. Go to /auth");
      setBookings([]);
      setItemsById({});
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id,item_id,renter_id,owner_id,start_date,end_date,status,total_price,paid_at,created_at"
      )
      .eq("renter_id", user.id)
      .order("created_at", { ascending: false });

    if (bookingError) {
      setMsg("Error: " + bookingError.message);
      return;
    }

    const list = bookingData ?? [];
    setBookings(list);

    const itemIds = Array.from(new Set(list.map((b) => b.item_id)));
    if (itemIds.length === 0) {
      setItemsById({});
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id,title,city")
      .in("id", itemIds);

    if (itemsError) {
      setMsg("Error loading items: " + itemsError.message);
      return;
    }

    const map: Record<string, Item> = {};
    for (const it of itemsData ?? []) map[it.id] = it;
    setItemsById(map);
  };

  useEffect(() => {
    // ✅ samo poruka iz URL-a (NE upisujemo paid_at ovdje!)
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") setMsg("Payment successful ✅");
    if (params.get("canceled") === "1") setMsg("Payment canceled.");

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async (bookingId: string) => {
    const ok = confirm("Cancel this booking?");
    if (!ok) return;

    setMsg("Cancelling...");

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) setMsg("Error: " + error.message);
    else {
      setMsg("Cancelled.");
      load();
    }
  };

  const pay = async (bookingId: string, title: string, totalPrice: number) => {
    try {
      setPayingId(bookingId);
      setMsg("Redirecting to Stripe...");

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, title, totalPrice }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg("Error: " + (data.error || "Stripe error"));
        setPayingId(null);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setMsg("Error: " + (e?.message || "Unknown error"));
      setPayingId(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "pending") return "Pending ⏳";
    if (s === "approved") return "Approved ✅";
    if (s === "rejected") return "Rejected ❌";
    if (s === "cancelled") return "Cancelled";
    return s;
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>My bookings</h1>
      {msg && <p>{msg}</p>}

      {bookings.length === 0 && !msg && <p>No bookings yet.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {bookings.map((b) => {
          const item = itemsById[b.item_id];
          const title = item?.title ?? "Booking";

          return (
            <li
              key={b.id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>{item ? item.title : "Item"}</h3>

              <p style={{ margin: "6px 0" }}>
                {item ? item.city : ""} • {b.start_date} → {b.end_date}
              </p>

              <p style={{ margin: "6px 0" }}>
                Status: <b>{statusLabel(b.status)}</b>
              </p>

              <p style={{ margin: "6px 0" }}>
                Total: <b>{b.total_price} €</b>
              </p>

              {/* ✅ Pay now: samo ako je approved i NIJE paid */}
              {b.status === "approved" && !b.paid_at && (
                <button
                  onClick={() => pay(b.id, title, b.total_price)}
                  disabled={payingId === b.id}
                  style={{ padding: "8px 10px", marginRight: 8 }}
                >
                  {payingId === b.id ? "Redirecting..." : "Pay now"}
                </button>
              )}

              {/* ✅ Paid label */}
              {b.paid_at && (
                <span style={{ marginRight: 12, fontWeight: 700 }}>Paid ✅</span>
              )}

              {/* Cancel: pending ili approved (ne i paid) */}
              {(b.status === "pending" || b.status === "approved") && !b.paid_at && (
                <button
                  onClick={() => cancel(b.id)}
                  style={{ padding: "8px 10px", marginRight: 12 }}
                >
                  Cancel
                </button>
              )}

              <a href={`/chat/${b.id}`} style={{ marginRight: 12 }}>
                Open chat
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}