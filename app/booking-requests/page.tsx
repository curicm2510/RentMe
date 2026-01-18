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
  paid_at?: string | null;
};

type Item = {
  id: string;
  title: string;
  city: string;
  price_per_day: number;
};

type Profile = {
  id: string;
  username: string | null;
};

const statusLabel = (s: string) => {
  if (s === "pending") return "Pending ⏳";
  if (s === "approved") return "Approved ✅";
  if (s === "rejected") return "Rejected ❌";
  if (s === "cancelled") return "Cancelled 📴";
  if (s === "paid") return "Paid 💳";
  return s;
};

export default function BookingRequestsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("Not logged in. Go to /auth");
      setBookings([]);
      setItemsById({});
      setProfilesById({});
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select("id,item_id,renter_id,owner_id,start_date,end_date,status,total_price,paid_at,created_at")
      .eq("owner_id", user.id)
      .in("status", ["pending", "approved", "rejected", "cancelled", "paid"])
      .order("created_at", { ascending: false });

    if (bookingError) {
      setMsg("Error: " + bookingError.message);
      return;
    }

    const list = bookingData ?? [];
    setBookings(list);

    if (list.length === 0) {
      setItemsById({});
      setProfilesById({});
      return;
    }

    const itemIds = Array.from(new Set(list.map((b) => b.item_id)));
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id,title,city,price_per_day")
      .in("id", itemIds);

    if (itemsError) {
      setMsg("Error loading items: " + itemsError.message);
      return;
    }

    const itemMap: Record<string, Item> = {};
    for (const it of itemsData ?? []) itemMap[it.id] = it;
    setItemsById(itemMap);

    const renterIds = Array.from(new Set(list.map((b) => b.renter_id)));
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("id,username")
      .in("id", renterIds);

    if (profErr) {
      console.warn("Profiles load error:", profErr.message);
      setProfilesById({});
      return;
    }

    const profMap: Record<string, Profile> = {};
    for (const p of profData ?? []) profMap[p.id] = p;
    setProfilesById(profMap);
  };

  useEffect(() => {
    load();
  }, []);

  // ✅ helper: count still-pending overlaps for the same item + dates (for debugging + UX)
  const countStillPendingOverlaps = async (bookingId: string) => {
    const { data: b } = await supabase
      .from("bookings")
      .select("id,item_id,start_date,end_date")
      .eq("id", bookingId)
      .single();

    if (!b) return null;

    const { count, error } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("item_id", b.item_id)
      .eq("status", "pending")
      .lt("start_date", b.end_date)
      .gt("end_date", b.start_date);

    if (error) return null;
    return count ?? 0;
  };

  const setStatus = async (bookingId: string, status: "approved" | "rejected") => {
    setMsg("Updating...");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("Not logged in.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId)
      .eq("owner_id", user.id)
      .eq("status", "pending");

    if (error) {
      setMsg("Error: " + error.message);
      return;
    }

    await load();

    // ✅ after approve/reject, show how many pending overlaps remain (should stay >0 after approve)
    const pendingLeft = await countStillPendingOverlaps(bookingId);
    if (status === "approved") {
      setMsg(
        `Approved ✅. Pending requests still overlapping this period: ${pendingLeft ?? "?"}`
      );
    } else {
      setMsg("Rejected ❌");
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Booking requests</h1>

      {msg && <p>{msg}</p>}
      {bookings.length === 0 && !msg && <p>No requests.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {bookings.map((b) => {
          const item = itemsById[b.item_id];
          const renterName = profilesById[b.renter_id]?.username ?? b.renter_id;
          const isPending = b.status === "pending";

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

              <p style={{ margin: "6px 0", opacity: 0.85 }}>
                From: <b>{renterName}</b>
              </p>

              <p style={{ margin: "6px 0" }}>
                {item ? item.city : ""} • {b.start_date} → {b.end_date}
              </p>

              <p style={{ margin: "6px 0" }}>
                Status: <b>{statusLabel(b.status)}</b>
                {b.paid_at ? <span style={{ marginLeft: 8, opacity: 0.75 }}>(paid)</span> : null}
              </p>

              <p style={{ margin: "6px 0" }}>
                Total: <b>{b.total_price} €</b>
              </p>

              <a href={`/chat/${b.id}`} style={{ marginRight: 12 }}>
                Open chat
              </a>

              {isPending ? (
                <>
                  <button
                    onClick={() => setStatus(b.id, "approved")}
                    style={{ marginRight: 8, padding: "8px 10px" }}
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => setStatus(b.id, "rejected")}
                    style={{ padding: "8px 10px" }}
                  >
                    Reject
                  </button>
                </>
              ) : (
                <span style={{ opacity: 0.7 }}>(request already handled)</span>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
