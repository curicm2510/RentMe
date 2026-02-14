"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const url = window.location.href;
        const hasCode = url.includes("code=");
        if (hasCode && "exchangeCodeForSession" in supabase.auth) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            setMsg(`${t("common_error_prefix")} ${error.message}`);
            setHasSession(false);
            setReady(true);
            return;
          }
          const { data } = await supabase.auth.getSession();
          setHasSession(!!data.session);
          if (!data.session) setMsg(t("auth_reset_missing_session"));
          setReady(true);
          return;
        }

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            setMsg(`${t("common_error_prefix")} ${error.message}`);
          }
          const { data } = await supabase.auth.getSession();
          setHasSession(!!data.session);
          if (!data.session) setMsg(t("auth_reset_missing_session"));
          setReady(true);
          return;
        }

        setMsg(t("auth_reset_missing_session"));
        setHasSession(false);
        setReady(true);
      } catch (e: any) {
        setMsg(`${t("common_error_prefix")} ${e?.message || "Error"}`);
        setHasSession(false);
        setReady(true);
      }
    };
    init();
  }, [t]);

  const submit = async () => {
    setMsg("");
    if (!hasSession) {
      setMsg(t("auth_reset_missing_session"));
      return;
    }
    if (!password || !password2) {
      setMsg(t("auth_password_required"));
      return;
    }
    if (password.length < 8) {
      setMsg(t("auth_password_min"));
      return;
    }
    if (password !== password2) {
      setMsg(t("auth_passwords_no_match"));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }
    setMsg(t("auth_reset_success"));
  };

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>{t("auth_reset_title")}</h1>
      <label>{t("auth_reset_new_password")}</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          padding: 8,
          marginBottom: 12,
          border: "1px solid #111",
          borderRadius: 8,
          outline: "none",
        }}
      />
      <label>{t("auth_reset_new_password2")}</label>
      <input
        type="password"
        value={password2}
        onChange={(e) => setPassword2(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          padding: 8,
          marginBottom: 12,
          border: "1px solid #111",
          borderRadius: 8,
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        style={{ padding: 10, width: "100%" }}
        disabled={!ready || !hasSession}
      >
        {t("auth_reset_submit")}
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
