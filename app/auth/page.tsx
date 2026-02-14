"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";

export default function AuthPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPassword2, setShowSignupPassword2] = useState(false);
  const [signupMsg, setSignupMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [showBusinessLogin, setShowBusinessLogin] = useState(false);
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPassword, setBusinessPassword] = useState("");
  const [businessMsg, setBusinessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    password2?: string;
  }>({});
  const passwordsMatch =
    signupPassword.length > 0 &&
    signupPassword2.length > 0 &&
    signupPassword === signupPassword2;
  const passwordsMismatch =
    signupPassword2.length > 0 && signupPassword !== signupPassword2;
  const isNameOk = (value: string) =>
    /^[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\u017F\u0180-\u024F\s'-]+$/.test(value.trim());
  const emailOk = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setCurrentEmail(data.user?.email ?? null);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = async () => {
    if (currentEmail) {
      setMsg(t("auth_already_logged"));
      return;
    }
    setSignupMsg("");
    if (!firstName.trim() || !lastName.trim()) {
      setSignupMsg(t("auth_full_name_required"));
      return;
    }
    const nameOk = isNameOk(firstName) && isNameOk(lastName);
    if (!nameOk) {
      setSignupMsg(t("auth_name_invalid"));
      return;
    }
    if (!signupEmail.trim()) {
      setSignupMsg(t("auth_email_required"));
      return;
    }
    if (!emailOk(signupEmail)) {
      setSignupMsg(t("auth_email_invalid"));
      return;
    }
    if (!signupPassword || !signupPassword2) {
      setSignupMsg(t("auth_password_required"));
      return;
    }
    if (signupPassword.length < 8) {
      setSignupMsg(t("auth_password_min"));
      return;
    }
    if (signupPassword !== signupPassword2) {
      setSignupMsg(t("auth_passwords_no_match"));
      return;
    }
    setSignupMsg(t("auth_signing_up"));
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });

    if (error) {
      setSignupMsg(`${t("common_error_prefix")} ${error.message}`);
      return;
    }

    if (data?.user && data?.session) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: `${firstName} ${lastName}`.trim(),
      });
    }

    setSignupMsg(`${t("auth_signup_ok")} ${t("auth_check_email")}`);
  };

  const signIn = async () => {
    if (currentEmail) {
      setMsg(t("auth_already_logged"));
      return;
    }
    setMsg(t("auth_signing_in"));
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMsg(`${t("common_error_prefix")} ${error.message}`);
    else window.location.href = "/";
  };

  const signOut = async () => {
    setMsg(t("auth_signing_out"));
    const { error } = await supabase.auth.signOut();
    if (error) setMsg(`${t("common_error_prefix")} ${error.message}`);
    else setMsg(t("auth_signed_out"));
  };

  const signInWithGoogle = async () => {
    if (currentEmail) {
      setMsg(t("auth_already_logged"));
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) setMsg(`${t("common_error_prefix")} ${error.message}`);
  };

  const sendReset = async () => {
    setResetMsg("");
    if (!resetEmail.trim()) {
      setResetMsg(t("auth_email_required"));
      return;
    }
    setResetMsg(t("auth_reset_sending"));
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setResetMsg(`${t("common_error_prefix")} ${error.message}`);
    else setResetMsg(t("auth_reset_sent"));
  };

  const signInBusiness = async () => {
    if (currentEmail) {
      setBusinessMsg(t("auth_already_logged"));
      return;
    }
    if (!businessEmail.trim() || !businessPassword) {
      setBusinessMsg(t("auth_email_required"));
      return;
    }
    setBusinessMsg(t("auth_signing_in"));
    const { data, error } = await supabase.auth.signInWithPassword({
      email: businessEmail,
      password: businessPassword,
    });
    if (error) setBusinessMsg(`${t("common_error_prefix")} ${error.message}`);
    else {
      const userId = data.user?.id;
      if (!userId) {
        setBusinessMsg(t("auth_business_not_found"));
        return;
      }
      const { data: biz } = await supabase
        .from("businesses")
        .select("id,status")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!biz) {
        await supabase.auth.signOut();
        setBusinessMsg(t("auth_business_not_found"));
        return;
      }
      if (biz.status !== "approved") {
        await supabase.auth.signOut();
        setBusinessMsg(t("auth_business_not_approved"));
        return;
      }
      window.location.href = "/business-signup";
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
          maxWidth: 900,
          margin: "0 auto",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 360px", maxWidth: 420 }}>
          <h1>{t("auth_title")}</h1>
          <p style={{ marginTop: 0, opacity: 0.7 }}>
            {currentEmail ? `${t("auth_logged_in_as")} ${currentEmail}` : t("auth_not_logged")}
          </p>

          <label>{t("auth_email")}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
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

          <label>{t("auth_password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
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
            onClick={() => {
              if (currentEmail) setMsg(t("auth_already_logged"));
              else {
                setShowSignup(true);
                setSignupMsg("");
              }
            }}
            disabled={!!currentEmail}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          >
            {t("auth_sign_up")}
          </button>

      <button
        onClick={signIn}
        disabled={!!currentEmail}
        style={{ width: "100%", padding: 10, marginBottom: 8 }}
      >
        {t("auth_sign_in")}
      </button>
      <button
        type="button"
        onClick={() => {
          setResetMsg("");
          setResetEmail(email);
          setShowReset(true);
        }}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 8,
          background: "white",
        }}
      >
        {t("auth_forgot_password")}
      </button>

          <button
            onClick={signInWithGoogle}
            disabled={!!currentEmail}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          >
            {t("auth_google")}
          </button>

          <p style={{ marginTop: 12 }}>{msg}</p>
        </div>

        <aside
          style={{
            flex: "1 1 280px",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fafafa",
            minHeight: 120,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("auth_business_title")}
          </div>
          <div style={{ marginBottom: 12 }}>{t("auth_business_desc")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setBusinessMsg("");
                setShowBusinessLogin(true);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {t("auth_business_login")}
            </button>
            <a
              href="/business-signup"
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                textDecoration: "none",
                color: "inherit",
                background: "white",
                fontWeight: 600,
              }}
            >
              {t("auth_business_register")}
            </a>
          </div>
        </aside>
      </div>

      {showSignup && (
        <div
          onClick={() => {
            setShowSignup(false);
            setFirstName("");
            setLastName("");
            setSignupEmail("");
            setSignupPassword("");
            setSignupPassword2("");
            setShowSignupPassword(false);
            setShowSignupPassword2(false);
            setSignupMsg("");
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
            onClick={(e) => {
              e.stopPropagation();
              const target = e.target as HTMLElement | null;
              if (!target?.closest("[data-pass-field],[data-pass-toggle]")) {
                setShowSignupPassword(false);
                setShowSignupPassword2(false);
              }
            }}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 420,
              border: "1px solid #ddd",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{t("auth_signup_title")}</h2>

            <label>{t("auth_first_name")}</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => {
                const v = firstName.trim();
                if (!v) {
                  setFieldErrors((p) => ({ ...p, firstName: t("auth_full_name_required") }));
                } else if (!isNameOk(v)) {
                  setFieldErrors((p) => ({ ...p, firstName: t("auth_name_invalid") }));
                } else {
                  setFieldErrors((p) => ({ ...p, firstName: "" }));
                }
              }}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                marginBottom: 6,
                border: "1px solid #111",
                borderRadius: 8,
                outline: "none",
              }}
            />
            {fieldErrors.firstName ? (
              <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>
                {fieldErrors.firstName}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}

            <label>{t("auth_last_name")}</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => {
                const v = lastName.trim();
                if (!v) {
                  setFieldErrors((p) => ({ ...p, lastName: t("auth_full_name_required") }));
                } else if (!isNameOk(v)) {
                  setFieldErrors((p) => ({ ...p, lastName: t("auth_name_invalid") }));
                } else {
                  setFieldErrors((p) => ({ ...p, lastName: "" }));
                }
              }}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                marginBottom: 6,
                border: "1px solid #111",
                borderRadius: 8,
                outline: "none",
              }}
            />
            {fieldErrors.lastName ? (
              <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>
                {fieldErrors.lastName}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}

            <label>{t("auth_email")}</label>
            <input
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              onBlur={() => {
                const v = signupEmail.trim();
                if (!v) {
                  setFieldErrors((p) => ({ ...p, email: t("auth_email_required") }));
                } else if (!emailOk(v)) {
                  setFieldErrors((p) => ({ ...p, email: t("auth_email_invalid") }));
                } else {
                  setFieldErrors((p) => ({ ...p, email: "" }));
                }
              }}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                marginBottom: 6,
                border: "1px solid #111",
                borderRadius: 8,
                outline: "none",
              }}
            />
            {fieldErrors.email ? (
              <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>
                {fieldErrors.email}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}

            <label>{t("auth_password")}</label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                type={showSignupPassword ? "text" : "password"}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                onBlur={() => setShowSignupPassword(false)}
                data-pass-field="1"
                onBlurCapture={() => {
                  const v = signupPassword;
                  if (!v) {
                    setFieldErrors((p) => ({ ...p, password: t("auth_password_required") }));
                  } else if (v.length < 8) {
                    setFieldErrors((p) => ({ ...p, password: t("auth_password_min") }));
                  } else {
                    setFieldErrors((p) => ({ ...p, password: "" }));
                  }
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 8,
                  paddingRight: 56,
                  border: `1px solid ${
                    passwordsMatch ? "#1a7f37" : passwordsMismatch ? "#c00" : "#111"
                  }`,
                  borderRadius: 8,
                  outline: "none",
                }}
              />
              {signupPassword.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((v) => !v)}
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                  data-pass-toggle="1"
                  style={{
                    position: "absolute",
                  right: 32,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 14,
                  }}
                >
                  {showSignupPassword ? "👁" : "🙈"}
                </button>
              ) : null}
              {passwordsMatch ? (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#1a7f37",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              ) : passwordsMismatch ? (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#c00",
                    fontWeight: 700,
                  }}
                >
                  ✕
                </span>
              ) : null}
            </div>
            {fieldErrors.password ? (
              <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>
                {fieldErrors.password}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}

            <label>{t("auth_password_confirm")}</label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                type={showSignupPassword2 ? "text" : "password"}
                value={signupPassword2}
                onChange={(e) => setSignupPassword2(e.target.value)}
                onBlur={() => setShowSignupPassword2(false)}
                data-pass-field="1"
                onBlurCapture={() => {
                  const v = signupPassword2;
                  if (!v) {
                    setFieldErrors((p) => ({ ...p, password2: t("auth_password_required") }));
                  } else if (v !== signupPassword) {
                    setFieldErrors((p) => ({ ...p, password2: t("auth_passwords_no_match") }));
                  } else {
                    setFieldErrors((p) => ({ ...p, password2: "" }));
                  }
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 8,
                  paddingRight: 56,
                  border: `1px solid ${
                    passwordsMatch ? "#1a7f37" : passwordsMismatch ? "#c00" : "#111"
                  }`,
                  borderRadius: 8,
                  outline: "none",
                }}
              />
              {signupPassword2.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSignupPassword2((v) => !v)}
                  aria-label={showSignupPassword2 ? "Hide password" : "Show password"}
                  tabIndex={-1}
                  data-pass-toggle="1"
                  style={{
                    position: "absolute",
                  right: 32,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 14,
                  }}
                >
                  {showSignupPassword2 ? "👁" : "🙈"}
                </button>
              ) : null}
              {passwordsMatch ? (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#1a7f37",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              ) : passwordsMismatch ? (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#c00",
                    fontWeight: 700,
                  }}
                >
                  ✕
                </span>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button
                onClick={() => {
                  setShowSignup(false);
            setFirstName("");
            setLastName("");
                  setSignupEmail("");
                  setSignupPassword("");
                  setSignupPassword2("");
                  setShowSignupPassword(false);
                  setShowSignupPassword2(false);
                  setSignupMsg("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                {t("auth_cancel")}
              </button>
              <button
                onClick={signUp}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("auth_sign_up")}
              </button>
            </div>

            {signupMsg && <p style={{ marginTop: 12 }}>{signupMsg}</p>}
          </div>
        </div>
      )}

      {showReset && (
        <div
          onClick={() => {
            setShowReset(false);
            setResetEmail("");
            setResetMsg("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 60,
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
            <h2 style={{ marginTop: 0 }}>{t("auth_reset_title")}</h2>
            <label>{t("auth_reset_email")}</label>
            <input
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
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
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={sendReset} style={{ padding: "8px 12px", width: "100%" }}>
                {t("auth_reset_send")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReset(false);
                  setResetEmail("");
                  setResetMsg("");
                }}
                style={{ padding: "8px 12px", width: "100%", background: "white" }}
              >
                {t("auth_cancel")}
              </button>
            </div>
            {resetMsg && <p style={{ marginTop: 10 }}>{resetMsg}</p>}
          </div>
        </div>
      )}

      {showBusinessLogin && (
        <div
          onClick={() => {
            setShowBusinessLogin(false);
            setBusinessEmail("");
            setBusinessPassword("");
            setBusinessMsg("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 60,
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
            <h2 style={{ marginTop: 0 }}>{t("auth_business_login_title")}</h2>
            <label>{t("auth_email")}</label>
            <input
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
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
            <label>{t("auth_password")}</label>
            <input
              type="password"
              value={businessPassword}
              onChange={(e) => setBusinessPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") signInBusiness();
              }}
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
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={signInBusiness}
                style={{ padding: "8px 12px", width: "100%" }}
              >
                {t("auth_business_login")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBusinessLogin(false);
                  setBusinessEmail("");
                  setBusinessPassword("");
                  setBusinessMsg("");
                }}
                style={{ padding: "8px 12px", width: "100%", background: "white" }}
              >
                {t("auth_cancel")}
              </button>
            </div>
            {businessMsg && <p style={{ marginTop: 10 }}>{businessMsg}</p>}
            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              {t("auth_business_login_hint")}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
