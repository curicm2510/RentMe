"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "./I18nProvider";
import LanguageMenu from "./LanguageMenu";
import NotificationsMenu from "./NotificationsMenu";
import ProfileMenu from "./ProfileMenu";

export default function NavBar() {
  const { t } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (mounted) setIsLoggedIn(Boolean(user));
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", user.id)
          .single();
        const fullName = prof?.full_name?.trim() ?? "";
        const profileEmail = prof?.email?.trim() ?? "";
        const meta =
          (user.user_metadata as
            | { full_name?: string; name?: string; given_name?: string; family_name?: string }
            | null) ?? null;
        const metaName =
          meta?.full_name ??
          meta?.name ??
          (meta?.given_name || meta?.family_name
            ? `${meta?.given_name ?? ""} ${meta?.family_name ?? ""}`.trim()
            : "");
        if ((!fullName && metaName) || (!profileEmail && user.email)) {
          await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                full_name: fullName || metaName.trim() || null,
                email: profileEmail || user.email || null,
              },
              { onConflict: "id" }
            );
        }
        if (!fullName && !metaName && window.location.pathname !== "/my-profile") {
          window.location.href = "/my-profile?missingName=1";
        }
      }
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setIsLoggedIn(Boolean(user));
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", user.id)
          .single();
        const fullName = prof?.full_name?.trim() ?? "";
        const profileEmail = prof?.email?.trim() ?? "";
        const meta =
          (user.user_metadata as
            | { full_name?: string; name?: string; given_name?: string; family_name?: string }
            | null) ?? null;
        const metaName =
          meta?.full_name ??
          meta?.name ??
          (meta?.given_name || meta?.family_name
            ? `${meta?.given_name ?? ""} ${meta?.family_name ?? ""}`.trim()
            : "");
        if ((!fullName && metaName) || (!profileEmail && user.email)) {
          await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                full_name: fullName || metaName.trim() || null,
                email: profileEmail || user.email || null,
              },
              { onConflict: "id" }
            );
        }
        if (!fullName && !metaName && window.location.pathname !== "/my-profile") {
          window.location.href = "/my-profile?missingName=1";
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <nav
      style={{
        padding: 16,
        borderBottom: "1px solid #ddd",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <a href="/">{t("nav_home")}</a>
      <a href="/my-items">{t("nav_my_items")}</a>
      <a href="/booking-requests">{t("nav_booking_requests")}</a>
      <a href="/my-bookings">{t("nav_my_bookings")}</a>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {isLoggedIn && (
          <a
            href="/new-item"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
              alignSelf: "center",
            }}
          >
            {t("nav_new_item")}
          </a>
        )}
        {isLoggedIn && <NotificationsMenu />}
        <LanguageMenu />
        {isLoggedIn ? (
          <ProfileMenu />
        ) : (
          <a href="/auth" style={{ alignSelf: "center" }}>
            {t("nav_login")}
          </a>
        )}
      </div>
    </nav>
  );
}
