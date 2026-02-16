"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "./I18nProvider";
import Avatar from "./Avatar";

const hasStoredSession = () => {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
  }
  return false;
};

export default function ProfileMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      let user = data.session?.user ?? null;
      if (!user) {
        const { data: userData } = await supabase.auth.getUser();
        user = userData.user ?? null;
      }
      setHasSession(Boolean(user) || hasStoredSession());
      setEmail(user?.email ?? null);

      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role,avatar_url")
          .eq("id", user.id)
          .single();
        if (mounted) setAvatarUrl(prof?.avatar_url ?? null);
        if (mounted) setIsAdmin(prof?.role === "admin");
      } else {
        setAvatarUrl(null);
        setIsAdmin(false);
      }
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setHasSession(Boolean(session?.user) || hasStoredSession());
      setEmail(session?.user?.email ?? null);
      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role,avatar_url")
          .eq("id", session.user.id)
          .single();
        setAvatarUrl(prof?.avatar_url ?? null);
        setIsAdmin(prof?.role === "admin");
      } else {
        setAvatarUrl(null);
        setIsAdmin(false);
      }
    });

    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("click", onDocClick);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid #ddd",
          background: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        <Avatar url={avatarUrl} size={32} alt="Profile" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            minWidth: 180,
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            padding: 8,
            zIndex: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{hasSession ? email || t("nav_logged_in") : t("nav_not_logged")}</span>
            {isAdmin && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  opacity: 0.9,
                }}
              >
                {t("admin_badge")}
              </span>
            )}
          </div>
          <a href="/my-profile" style={{ display: "block", padding: "6px 8px" }}>
            {t("nav_profile")}
          </a>
          <a href="/saved-items" style={{ display: "block", padding: "6px 8px" }}>
            {t("nav_saved")}
          </a>
          {isAdmin && (
            <>
              <a href="/admin/items" style={{ display: "block", padding: "6px 8px" }}>
                {t("nav_admin")}
              </a>
              <a href="/admin/businesses" style={{ display: "block", padding: "6px 8px" }}>
                {t("nav_admin_businesses")}
              </a>
              <a href="/admin/email-logs" style={{ display: "block", padding: "6px 8px" }}>
                {t("nav_admin_email_logs")}
              </a>
            </>
          )}
          <a href="/my-items" style={{ display: "block", padding: "6px 8px" }}>
            {t("nav_my_items")}
          </a>
          <a href="/booking-requests" style={{ display: "block", padding: "6px 8px" }}>
            {t("nav_requests")}
          </a>
          <a href="/my-bookings" style={{ display: "block", padding: "6px 8px" }}>
            {t("nav_bookings")}
          </a>
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error("Sign out error:", error.message);
                return;
              }
              setOpen(false);
              window.location.href = "/auth";
            }}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #eee",
              background: "white",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            ⎋ {t("nav_sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}
