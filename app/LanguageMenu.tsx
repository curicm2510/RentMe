"use client";

import { useState } from "react";
import { useI18n } from "./I18nProvider";

export default function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        {lang.toUpperCase()}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 34,
            minWidth: 140,
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            padding: 6,
            zIndex: 20,
          }}
        >
          <button
            onClick={() => {
              setLang("hr");
              document.cookie = "lang=hr; path=/; max-age=31536000";
              setOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {t("lang_hr")}
          </button>
          <button
            onClick={() => {
              setLang("en");
              document.cookie = "lang=en; path=/; max-age=31536000";
              setOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {t("lang_en")}
          </button>
        </div>
      )}
    </div>
  );
}
