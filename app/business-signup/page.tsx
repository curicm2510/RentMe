"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";

type Errors = {
  accountEmail?: string;
  accountPassword?: string;
  accountPassword2?: string;
  storeName?: string;
  bookingsEmail?: string;
  oib?: string;
  contactName?: string;
  category?: string;
  contactNumber?: string;
  yearEstablished?: string;
  locationsCount?: string;
};

export default function BusinessSignupPage() {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPassword2, setAccountPassword2] = useState("");

  const [storeName, setStoreName] = useState("");
  const [bookingsEmail, setBookingsEmail] = useState("");
  const [sameBookingsEmail, setSameBookingsEmail] = useState(false);
  const [oib, setOib] = useState("");
  const [contactName, setContactName] = useState("");
  const [category, setCategory] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [locationsCount, setLocationsCount] = useState("");

  const emailOk = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validate = () => {
    const next: Errors = {};
    if (!accountEmail.trim()) next.accountEmail = t("business_error_email_required");
    else if (!emailOk(accountEmail))
      next.accountEmail = t("business_error_email_invalid");
    if (!accountPassword) next.accountPassword = t("business_error_password_required");
    else if (accountPassword.length < 8)
      next.accountPassword = t("business_error_password_min");
    if (!accountPassword2) next.accountPassword2 = t("business_error_password2_required");
    else if (accountPassword2 !== accountPassword)
      next.accountPassword2 = t("business_error_passwords_no_match");

    if (!storeName.trim()) next.storeName = t("business_error_store_name");
    if (!bookingsEmail.trim())
      next.bookingsEmail = t("business_error_bookings_email_required");
    else if (!emailOk(bookingsEmail))
      next.bookingsEmail = t("business_error_bookings_email_invalid");
    if (!oib.trim()) next.oib = t("business_error_oib_required");
    else if (!/^\d+$/.test(oib.trim())) next.oib = t("business_error_oib_digits");
    else if (oib.trim().length !== 11) next.oib = t("business_error_oib_len");
    if (!contactName.trim()) next.contactName = t("business_error_contact_name");
    if (!category.trim()) next.category = t("business_error_category");
    if (!contactNumber.trim()) next.contactNumber = t("business_error_contact_number");
    if (!yearEstablished.trim())
      next.yearEstablished = t("business_error_year_required");
    else if (!/^\d{4}$/.test(yearEstablished.trim()))
      next.yearEstablished = t("business_error_year_format");
    if (!locationsCount.trim())
      next.locationsCount = t("business_error_locations_required");
    else if (!/^\d+$/.test(locationsCount.trim()))
      next.locationsCount = t("business_error_locations_number");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setMsg("");
    if (sameBookingsEmail && accountEmail.trim()) {
      setBookingsEmail(accountEmail.trim());
    }
    if (!validate()) return;
    setMsg(t("business_signup_in_progress"));

    const { data, error } = await supabase.auth.signUp({
      email: accountEmail.trim(),
      password: accountPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: contactName.trim(),
        },
      },
    });

    if (error) {
      const raw = error.message || "";
      if (raw.toLowerCase().includes("rate limit")) {
        setMsg(t("business_error_rate_limit"));
      } else {
        setMsg(`${t("common_error_prefix")} ${raw}`);
      }
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setMsg(t("business_signup_user_created"));
      return;
    }

    const res = await fetch("/api/business-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: userId,
        store_name: storeName.trim(),
        bookings_email: bookingsEmail.trim(),
        oib: oib.trim(),
        contact_name: contactName.trim(),
        category: category.trim(),
        contact_number: contactNumber.trim(),
        year_established: Number(yearEstablished),
        locations_count: Number(locationsCount),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      setMsg(`${t("business_signup_partial_fail")} ${errText}`);
      return;
    }

    setMsg(t("business_signup_received"));
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>{t("business_signup_title")}</h1>
      <p style={{ marginTop: 0, opacity: 0.7 }}>{t("business_signup_subtitle")}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <div>
          <label>{t("business_signup_account_email")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_signup_email_ph")}
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            onBlur={validate}
          />
          {errors.accountEmail && <div style={errorStyle}>{errors.accountEmail}</div>}
        </div>
        <div>
          <label>{t("business_signup_account_password")} *</label>
          <input
            type="password"
            style={inputStyle}
            value={accountPassword}
            onChange={(e) => setAccountPassword(e.target.value)}
            onBlur={validate}
          />
          {errors.accountPassword && (
            <div style={errorStyle}>{errors.accountPassword}</div>
          )}
        </div>
        <div>
          <label>{t("business_signup_account_password2")} *</label>
          <input
            type="password"
            style={inputStyle}
            value={accountPassword2}
            onChange={(e) => setAccountPassword2(e.target.value)}
            onBlur={validate}
          />
          {errors.accountPassword2 && (
            <div style={errorStyle}>{errors.accountPassword2}</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div>
          <label>{t("business_store_name")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_store_name_ph")}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            onBlur={validate}
          />
          <div style={hintStyle}>{t("business_store_name_hint")}</div>
          {errors.storeName && <div style={errorStyle}>{errors.storeName}</div>}
        </div>
        <div>
          <label>{t("business_bookings_email")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_signup_email_ph")}
            value={bookingsEmail}
            onChange={(e) => setBookingsEmail(e.target.value)}
            onBlur={validate}
            disabled={sameBookingsEmail}
          />
          <div style={hintStyle}>{t("business_bookings_email_hint")}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={sameBookingsEmail}
              onChange={(e) => {
                const checked = e.target.checked;
                setSameBookingsEmail(checked);
                if (checked) {
                  setBookingsEmail(accountEmail.trim());
                }
              }}
            />
            {t("business_bookings_email_same")}
          </label>
          {errors.bookingsEmail && (
            <div style={errorStyle}>{errors.bookingsEmail}</div>
          )}
        </div>
        <div>
          <label>{t("business_oib")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_oib_ph")}
            value={oib}
            onChange={(e) => setOib(e.target.value)}
            onBlur={validate}
          />
          <div style={hintStyle}>{t("business_oib_hint")}</div>
          {errors.oib && <div style={errorStyle}>{errors.oib}</div>}
        </div>
        <div>
          <label>{t("business_contact_name")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_contact_name_ph")}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onBlur={validate}
          />
          {errors.contactName && (
            <div style={errorStyle}>{errors.contactName}</div>
          )}
        </div>
        <div>
          <label>{t("business_category")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_category_ph")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={validate}
          />
          {errors.category && <div style={errorStyle}>{errors.category}</div>}
        </div>
        <div>
          <label>{t("business_contact_number")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_contact_number_ph")}
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            onBlur={validate}
          />
          {errors.contactNumber && (
            <div style={errorStyle}>{errors.contactNumber}</div>
          )}
        </div>
        <div>
          <label>{t("business_year_established")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_year_established_ph")}
            value={yearEstablished}
            onChange={(e) => setYearEstablished(e.target.value)}
            onBlur={validate}
          />
          {errors.yearEstablished && (
            <div style={errorStyle}>{errors.yearEstablished}</div>
          )}
        </div>
        <div>
          <label>{t("business_locations_count")} *</label>
          <input
            style={inputStyle}
            placeholder={t("business_locations_count_ph")}
            value={locationsCount}
            onChange={(e) => setLocationsCount(e.target.value)}
            onBlur={validate}
          />
          {errors.locationsCount && (
            <div style={errorStyle}>{errors.locationsCount}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={onSubmit}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {t("business_next")}
        </button>
      </div>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  outline: "none",
  marginTop: 6,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginTop: 6,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#c00",
  marginTop: 6,
};
