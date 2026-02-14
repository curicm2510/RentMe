"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Lang, t as tr } from "./i18n";

type I18nContextValue = {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLang = "hr",
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!mounted) return;
      setUserId(user?.id ?? null);

      if (user) {
        const local =
          typeof window !== "undefined"
            ? ((window.localStorage.getItem("lang") as Lang | null) ?? null)
            : null;
        const { data: prof } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", user.id)
          .single();
        const profileLang = (prof?.language as Lang) || null;

        if (local) {
          if (profileLang && profileLang !== local) {
            await supabase.from("profiles").update({ language: local }).eq("id", user.id);
          }
          if (mounted) setLangState(local);
          if (typeof window !== "undefined") {
            document.cookie = `lang=${local}; path=/; max-age=31536000`;
          }
        } else if (profileLang) {
          if (mounted) setLangState(profileLang);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("lang", profileLang);
            document.cookie = `lang=${profileLang}; path=/; max-age=31536000`;
          }
        }
      }
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      if (id) {
        const local =
          typeof window !== "undefined"
            ? ((window.localStorage.getItem("lang") as Lang | null) ?? null)
            : null;
        const { data: prof } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", id)
          .single();
        const profileLang = (prof?.language as Lang) || null;

        if (local) {
          if (profileLang && profileLang !== local) {
            await supabase.from("profiles").update({ language: local }).eq("id", id);
          }
          setLangState(local);
          if (typeof window !== "undefined") {
            document.cookie = `lang=${local}; path=/; max-age=31536000`;
          }
        } else if (profileLang) {
          setLangState(profileLang);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("lang", profileLang);
            document.cookie = `lang=${profileLang}; path=/; max-age=31536000`;
          }
        }
      } else {
        setLangState(initialLang);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setLang = async (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lang", next);
      document.cookie = `lang=${next}; path=/; max-age=31536000`;
    }
    if (userId) {
      await supabase.from("profiles").update({ language: next }).eq("id", userId);
    }
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      t: (key: string) => tr(lang, key),
      setLang,
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
