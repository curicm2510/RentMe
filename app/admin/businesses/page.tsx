"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import { formatDate } from "../../../lib/formatDate";

type Business = {
  id: string;
  owner_id: string;
  store_name: string;
  bookings_email: string;
  oib: string;
  contact_name: string;
  category: string;
  contact_number: string;
  year_established: number;
  locations_count: number;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  language: string | null;
};

export default function AdminBusinessesPage() {
  const { t } = useI18n();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ownersById, setOwnersById] = useState<Record<string, Profile>>({});
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const renderMsg = () => {
    if (!msg) return null;
    if (msg === t("auth_not_logged_go")) {
      return (
        <p>
          {t("auth_not_logged")}. <a href="/auth">{t("auth_go_to_login")}</a>.
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
      setIsAdmin(false);
      setMsg(t("auth_not_logged_go"));
      setBusinesses([]);
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (prof?.role !== "admin") {
      setIsAdmin(false);
      setBusinesses([]);
      setMsg(t("admin_only"));
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,owner_id,store_name,bookings_email,oib,contact_name,category,contact_number,year_established,locations_count,status,created_at,rejection_reason"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      setBusinesses([]);
      return;
    }

    const list = (data ?? []) as Business[];
    setBusinesses(list);

    const ownerIds = Array.from(new Set(list.map((b) => b.owner_id)));
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("profiles")
        .select("id,full_name,email,language")
        .in("id", ownerIds);
      const map: Record<string, Profile> = {};
      for (const o of (owners ?? []) as Profile[]) {
        map[o.id] = o;
      }
      setOwnersById(map);
    } else {
      setOwnersById({});
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (
    id: string,
    status: "approved" | "rejected",
    reasonInput?: string
  ) => {
    if (status === "rejected" && reasonInput === undefined) {
      const ok = confirm(t("admin_business_reject_confirm"));
      if (!ok) return;
    }
    let rejectionReason = "";
    if (status === "rejected") {
      rejectionReason = (reasonInput ?? "").trim();
    }
    const { error } = await supabase
      .from("businesses")
      .update({
        status,
        rejection_reason: status === "rejected" ? rejectionReason || null : null,
      })
      .eq("id", id);
    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }
    const business = businesses.find((b) => b.id === id);
    const owner = business ? ownersById[business.owner_id] : undefined;
    if (business && owner?.email) {
      const approved = status === "approved";
      const lang =
        owner.language === "en" || owner.language === "hr" ? owner.language : "hr";
      const subject =
        lang === "hr"
          ? approved
            ? "Odobrenje registracije firme"
            : "Odbijanje registracije firme"
          : approved
          ? "Business registration approved"
          : "Business registration rejected";
      const reasonLine =
        status === "rejected" && rejectionReason
          ? lang === "hr"
            ? `<p>Razlog: ${rejectionReason}</p>`
            : `<p>Reason: ${rejectionReason}</p>`
          : "";
      const bodyLine =
        lang === "hr"
          ? approved
            ? "Vaša registracija firme je odobrena."
            : "Vaša registracija firme je odbijena."
          : approved
          ? "Your business registration has been approved."
          : "Your business registration has been rejected.";
      const autoNote =
        lang === "hr"
          ? "Ovo je automatski e-mail. Molimo vas da ne odgovarate na ovu poruku."
          : "This is an automated email. Please do not reply to this message.";

      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
          <p>${lang === "hr" ? "Pozdrav," : "Hello,"}</p>
          <p>${bodyLine}</p>
          <p>${lang === "hr" ? "Trgovina" : "Store"}: <strong>${business.store_name}</strong></p>
          ${reasonLine}
          <p style="color:#666;font-size:12px;">${autoNote}</p>
        </div>
      `;
      const text = [
        lang === "hr" ? "Pozdrav," : "Hello,",
        bodyLine,
        `${lang === "hr" ? "Trgovina" : "Store"}: ${business.store_name}`,
        status === "rejected" && rejectionReason
          ? `${lang === "hr" ? "Razlog" : "Reason"}: ${rejectionReason}`
          : "",
        autoNote,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: owner.email,
          subject,
          html,
          text,
          contextType: "business_status",
          contextId: business.id,
        }),
      });
      if (!res.ok) {
        setMsg(t("admin_business_email_failed"));
      }
    }
    await load();
  };

  const filtered =
    statusFilter === "all"
      ? businesses
      : businesses.filter((b) => b.status === statusFilter);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>{t("admin_businesses_title")}</h1>
        <div>
          {t("admin_business_status")}:{" "}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 8px" }}
          >
            <option value="pending">{t("status_pending")}</option>
            <option value="approved">{t("status_approved")}</option>
            <option value="rejected">{t("status_rejected")}</option>
            <option value="all">{t("common_all")}</option>
          </select>
        </div>
      </div>

      {renderMsg()}

      {isAdmin && filtered.length === 0 && !msg && (
        <p style={{ marginTop: 16 }}>{t("admin_businesses_no_items")}</p>
      )}

      {isAdmin &&
        filtered.map((b) => {
          const owner = ownersById[b.owner_id];
          return (
            <div
              key={b.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>{b.store_name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(b.created_at)}</div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                {owner?.full_name ? owner.full_name : owner?.email ?? b.owner_id}
              </div>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <div>{t("admin_business_field_oib")}: {b.oib}</div>
                <div>{t("admin_business_field_email")}: {b.bookings_email}</div>
                <div>{t("admin_business_field_contact")}: {b.contact_name}</div>
                <div>{t("admin_business_field_number")}: {b.contact_number}</div>
                <div>{t("admin_business_field_category")}: {b.category}</div>
                <div>
                  {t("admin_business_field_year")}: {b.year_established} •{" "}
                  {t("admin_business_field_locations")}: {b.locations_count}
                </div>
                <div>
                  {t("admin_business_field_status")}:{" "}
                  {b.status === "pending"
                    ? t("status_pending")
                    : b.status === "approved"
                    ? t("status_approved")
                    : b.status === "rejected"
                    ? t("status_rejected")
                    : b.status}
                </div>
              </div>
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => setStatus(b.id, "approved")}>
                    {t("admin_business_approve")}
                  </button>
                  <button
                    onClick={() => {
                      setRejectId(b.id);
                      setRejectReason("");
                    }}
                  >
                    {t("admin_business_reject")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      {rejectId && (
        <div
          onClick={() => {
            setRejectId(null);
            setRejectReason("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{t("admin_business_reject_title")}</h2>
            <p style={{ marginTop: 0, opacity: 0.7 }}>
              {t("admin_business_reject_hint")}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("admin_business_reject_ph")}
              style={{
                width: "100%",
                minHeight: 90,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #111",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={() => {
                  const id = rejectId;
                  setRejectId(null);
                  const reason = rejectReason;
                  setRejectReason("");
                  if (id) setStatus(id, "rejected", reason);
                }}
                style={{ width: "100%" }}
              >
                {t("admin_business_reject")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason("");
                }}
                style={{ width: "100%", background: "white" }}
              >
                {t("auth_cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
