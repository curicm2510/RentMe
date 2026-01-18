"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Item = {
  id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string;
  created_at: string;
  owner_id: string;
};

type ItemImage = {
  id: string;
  url: string;
};

type ApprovedBooking = {
  id: string;
  start_date: string;
  end_date: string;
};

export default function ItemPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [item, setItem] = useState<Item | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [approved, setApproved] = useState<ApprovedBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  // booking state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setError(null);

      // 1) load item
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city,created_at,owner_id")
        .eq("id", id)
        .single();

      if (itemError) {
        setError(itemError.message);
        return;
      }
      setItem(itemData);

      // 2) load images
      const { data: imgData, error: imgError } = await supabase
        .from("item_images")
        .select("id,url")
        .eq("item_id", id)
        .order("created_at", { ascending: true });

      if (imgError) {
        setError(imgError.message);
        return;
      }
      setImages(imgData ?? []);

      // 3) load approved bookings (availability)
      const { data: approvedData, error: approvedError } = await supabase
        .from("bookings")
        .select("id,start_date,end_date")
        .eq("item_id", id)
        .eq("status", ["approved", "paid"])
        .order("start_date", { ascending: true });

      if (approvedError) {
        setError(approvedError.message);
        return;
      }
      setApproved(approvedData ?? []);
    };

    load();
  }, [id]);

  const unavailableText = useMemo(() => {
    if (approved.length === 0) return "No booked dates yet.";
    return `Unavailable: ${approved.length} booked period(s)`;
  }, [approved.length]);

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "crimson" }}>Error: {error}</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ marginBottom: 6 }}>{item.title}</h1>
      <p style={{ marginTop: 0 }}>
        {item.city} — <b>{item.price_per_day} € / day</b>
      </p>

      {/* IMAGES */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", margin: "16px 0" }}>
          {images.map((img) => (
            <img
              key={img.id}
              src={img.url}
              alt={item.title}
              style={{
                height: 260,
                borderRadius: 12,
                border: "1px solid #ddd",
              }}
            />
          ))}
        </div>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h3>Description</h3>
      <p>{item.description ?? "No description yet."}</p>

      <p style={{ opacity: 0.7 }}>Posted: {new Date(item.created_at).toLocaleString()}</p>

      {/* BOOKING SECTION */}
      <hr style={{ margin: "24px 0" }} />

      <h3>Request booking</h3>
      <p style={{ marginTop: 0, opacity: 0.75 }}>{unavailableText}</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, opacity: 0.75 }}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14, opacity: 0.75 }}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>
      </div>

      <button
        onClick={async () => {
          setBookingMsg("Sending request...");

          const { data: userData } = await supabase.auth.getUser();
          const user = userData.user;

          if (!user) {
            setBookingMsg("Please login first.");
            return;
          }

          if (!startDate || !endDate) {
            setBookingMsg("Select both dates.");
            return;
          }

          const start = new Date(startDate);
          const end = new Date(endDate);

          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

          if (days <= 0) {
            setBookingMsg("End date must be after start date.");
            return;
          }

          // ✅ UX check: if overlaps approved, tell user immediately
          const overlapsApproved = approved.some((b) => {
            const aStart = new Date(startDate).getTime();
            const aEnd = new Date(endDate).getTime();
            const bStart = new Date(b.start_date).getTime();
            const bEnd = new Date(b.end_date).getTime();
            return aStart < bEnd && aEnd > bStart;
          });

          if (overlapsApproved) {
            setBookingMsg("These dates are already booked. Choose different dates.");
            return;
          }

          const totalPrice = days * item.price_per_day;

          const { error } = await supabase.from("bookings").insert({
            item_id: item.id,
            renter_id: user.id,
            owner_id: item.owner_id,
            start_date: startDate,
            end_date: endDate,
            total_price: totalPrice,
            status: "pending",
          });

          if (error) setBookingMsg("Error: " + error.message);
          else setBookingMsg(`Request sent! Total: ${totalPrice} € (${days} days)`);
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Request booking
      </button>

      {bookingMsg && <p style={{ marginTop: 10 }}>{bookingMsg}</p>}

      {/* ✅ Unavailable (approved) periods list */}
      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Unavailable dates (approved)</h4>

        {approved.length === 0 ? (
          <p style={{ marginTop: 0, opacity: 0.7 }}>None yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {approved.map((b) => (
              <li key={b.id}>
                {b.start_date} → {b.end_date}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}