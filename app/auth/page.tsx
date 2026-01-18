"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  const signUp = async () => {
    setMsg("Signing up...");
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) setMsg("Error: " + error.message);
    else setMsg("Signup OK. User id: " + (data.user?.id ?? "no user id"));
  };

  const signIn = async () => {
    setMsg("Signing in...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMsg("Error: " + error.message);
    else setMsg("Login OK. User id: " + (data.user?.id ?? "no user id"));
  };

  const signOut = async () => {
    setMsg("Signing out...");
    const { error } = await supabase.auth.signOut();
    if (error) setMsg("Error: " + error.message);
    else setMsg("Signed out.");
  };

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Auth</h1>

      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", width: "100%", padding: 8, marginBottom: 12 }}
      />

      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", width: "100%", padding: 8, marginBottom: 12 }}
      />

      <button onClick={signUp} style={{ width: "100%", padding: 10, marginBottom: 8 }}>
        Sign up
      </button>

      <button onClick={signIn} style={{ width: "100%", padding: 10, marginBottom: 8 }}>
        Sign in
      </button>

      <button onClick={signOut} style={{ width: "100%", padding: 10 }}>
        Sign out
      </button>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}