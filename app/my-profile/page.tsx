"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useI18n } from "../I18nProvider";
import { formatDate } from "../../lib/formatDate";
import Avatar from "../Avatar";

type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
};

type Review = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function MyProfilePage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const missingName = searchParams.get("missingName") === "1";
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewersById, setReviewersById] = useState<Record<string, Profile>>({});
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");

  const renderMsg = () => {
    if (!msg) return null;
    if (msg === t("auth_not_logged_go")) {
      return (
        <p>
          {t("auth_not_logged")}.{" "}
          <a href="/auth">{t("auth_go_to_login")}</a>.
        </p>
      );
    }
    return <p>{msg}</p>;
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        if (mounted) {
          setMsg(t("auth_not_logged_go"));
          setLoading(false);
        }
        return;
      }

      if (mounted) setEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,city,country,avatar_url")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (error) {
        setMsg(`${t("common_error_prefix")} ${error.message}`);
        setLoading(false);
        return;
      }

      setProfile(data as Profile);
      setFullName(data?.full_name ?? "");
      setCity(data?.city ?? "");
      setCountry(data?.country ?? "");
      setAvatarUrl(data?.avatar_url ?? "");

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id,reviewer_id,reviewee_id,item_id,rating,comment,created_at")
        .eq("reviewee_id", user.id)
        .order("created_at", { ascending: false });

      if (!reviewError) {
        const list = (reviewData ?? []) as Review[];
        setReviews(list);
        if (list.length > 0) {
          const sum = list.reduce((acc, r) => acc + r.rating, 0);
          setAvgRating(Math.round((sum / list.length) * 10) / 10);
        } else {
          setAvgRating(null);
        }

        const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_id)));
        if (reviewerIds.length > 0) {
          const { data: reviewerData, error: reviewerError } = await supabase
            .from("profiles")
            .select("id,full_name,city,country,avatar_url")
            .in("id", reviewerIds);

          if (!reviewerError) {
            const map: Record<string, Profile> = {};
            for (const p of reviewerData ?? []) map[p.id] = p as Profile;
            setReviewersById(map);
          }
        }
      }

      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!profile) return;
    setMsg(t("common_saving"));

    const payload = {
      id: profile.id,
      full_name: fullName || null,
      city: city || null,
      country: country || null,
      avatar_url: avatarUrl || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) setMsg(`${t("common_error_prefix")} ${error.message}`);
    else {
      setMsg(t("edit_item_saved"));
      setIsEditing(false);
    }
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>{t("common_loading")}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>{t("profile_my_title")}</h1>
      {email && <p style={{ opacity: 0.7, marginTop: 4 }}>{email}</p>}
      {missingName && (
        <p style={{ color: "#b00", marginTop: 6 }}>{t("profile_full_name_required")}</p>
      )}
      {renderMsg()}

      {!profile && (
        <p style={{ opacity: 0.7 }}>{t("profile_not_loaded")}</p>
      )}

      {profile && !isEditing && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar url={profile.avatar_url ?? null} size={40} alt="Avatar" />
            <p style={{ margin: 0 }}>
              <b>{t("profile_username")}:</b> {profile.full_name ?? "—"}
            </p>
          </div>
          <p>
            <b>{t("profile_city")}:</b> {profile.city ?? "—"}
          </p>
          <p>
            <b>{t("profile_country")}:</b> {profile.country ?? "—"}
          </p>
          <button onClick={() => setIsEditing(true)} style={{ padding: "8px 12px" }}>
            {t("profile_edit")}
          </button>
        </div>
      )}

      {profile && isEditing && (
        <>
          <label>{t("profile_username")}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginBottom: 12 }}
          />

          <label>{t("profile_avatar_label")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar url={avatarUrl || null} size={40} alt="Avatar" />
            <label
              style={{
                padding: "6px 10px",
                border: "1px solid #111",
                borderRadius: 8,
                cursor: "pointer",
                background: "white",
              }}
            >
              {t("profile_avatar_change")}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAvatarMsg(t("profile_avatar_uploading"));
                  const { data: userData } = await supabase.auth.getUser();
                  const user = userData.user;
                  if (!user) {
                    setAvatarMsg(t("auth_not_logged_go"));
                    return;
                  }
                  const ext = file.name.split(".").pop() || "jpg";
                  const uuid =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : String(Date.now());
                  const filePath = `${user.id}/${uuid}.${ext}`;
                  const { error: uploadError } = await supabase.storage
                    .from("avatars")
                    .upload(filePath, file, { upsert: true });
                  if (uploadError) {
                    setAvatarMsg(`${t("common_error_prefix")} ${uploadError.message}`);
                    return;
                  }
                  const { data: publicData } = supabase.storage
                    .from("avatars")
                    .getPublicUrl(filePath);
                  setAvatarUrl(publicData.publicUrl);
                  setAvatarMsg("");
                }}
              />
            </label>
            {avatarMsg && <span style={{ fontSize: 12, opacity: 0.7 }}>{avatarMsg}</span>}
          </div>

          <label>{t("profile_city")}</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginBottom: 12 }}
          />

          <label>{t("profile_country")}</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginBottom: 12 }}
          />


          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ padding: "8px 12px" }}>
              {t("profile_save")}
            </button>
            <button
              onClick={() => {
                setFullName(profile.full_name ?? "");
                setCity(profile.city ?? "");
                setCountry(profile.country ?? "");
                setAvatarUrl(profile.avatar_url ?? "");
                setIsEditing(false);
              }}
              style={{ padding: "8px 12px" }}
            >
              {t("profile_cancel")}
            </button>
          </div>
        </>
      )}

      {profile && (
        <>
          <hr style={{ margin: "24px 0" }} />
          <h2 style={{ marginBottom: 6 }}>{t("profile_reviews_about")}</h2>
          {avgRating !== null && (
            <p style={{ marginTop: 0, opacity: 0.75 }}>
              {t("item_average")}: <b>{avgRating}</b> ({reviews.length})
            </p>
          )}
          {reviews.length === 0 ? (
            <p style={{ marginTop: 0, opacity: 0.7 }}>{t("item_reviews_none")}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {reviews.map((r) => {
                const reviewer = reviewersById[r.reviewer_id];
                return (
                  <li
                    key={r.id}
                    style={{
                      border: "1px solid #eee",
                      padding: 12,
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {reviewer?.full_name ?? "—"} — {r.rating}/5
                    </div>
                    {r.comment && <p style={{ margin: "6px 0 0" }}>{r.comment}</p>}
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                      {formatDate(r.created_at)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}





