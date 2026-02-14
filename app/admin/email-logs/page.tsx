"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useI18n } from "../../I18nProvider";
import { formatDate } from "../../../lib/formatDate";

type EmailLog = {
  id: string;
  to_email: string;
  subject: string;
  context_type: string | null;
  context_id: string | null;
  error: string;
  created_at: string;
};

export default function AdminEmailLogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
      setLogs([]);
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (prof?.role !== "admin") {
      setIsAdmin(false);
      setLogs([]);
      setMsg(t("admin_only"));
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("email_logs")
      .select("id,to_email,subject,context_type,context_id,error,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMsg(`${t("common_error_prefix")} ${error.message}`);
      setLogs([]);
      return;
    }
    setLogs((data ?? []) as EmailLog[]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ margin: 0 }}>{t("admin_email_logs_title")}</h1>
      {renderMsg()}
      {isAdmin && logs.length === 0 && !msg && (
        <p style={{ marginTop: 16 }}>{t("admin_email_logs_empty")}</p>
      )}
      {isAdmin &&
        logs.map((log) => (
          <div
            key={log.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              marginTop: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 600 }}>{log.to_email}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(log.created_at)}</div>
            </div>
            <div style={{ marginTop: 6 }}>
              <div>{t("admin_email_logs_subject")}: {log.subject}</div>
              {log.context_type && (
                <div>{t("admin_email_logs_context")}: {log.context_type}</div>
              )}
              {log.context_id && (
                <div>{t("admin_email_logs_context_id")}: {log.context_id}</div>
              )}
            </div>
            <div style={{ marginTop: 8, color: "#a00" }}>{log.error}</div>
          </div>
        ))}
    </main>
  );
}
