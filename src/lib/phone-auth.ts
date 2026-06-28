"use client";

import { supabase } from "./supabase";

export interface PhoneAuthSession {
  access_token:  string;
  refresh_token: string;
}

// Step 1: send OTP (falls back silently if provider disabled — just proceed to verify)
export async function sendOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
  if (error && error.code !== "phone_provider_disabled") throw error;
  // phone_provider_disabled → test mode, OTP is static from TEST_PHONES env
}

// Step 2: verify OTP, returns session (tries real Supabase first, then test-login)
export async function verifyOtp(phone: string, otp: string): Promise<PhoneAuthSession> {
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    phone: `+91${phone}`,
    token: otp,
    type:  "sms",
  });

  if (!verifyErr) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return { access_token: session.access_token, refresh_token: session.refresh_token };
    }
  }

  // Supabase phone OTP failed — try test-login fallback
  const res = await fetch("/api/auth/test-login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ phone, otp }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Wrong OTP");

  // Set session in browser cookies so proxy.ts and client getUser() both work
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token:  json.data.session.access_token,
    refresh_token: json.data.session.refresh_token,
  });
  if (sessionErr) throw sessionErr;

  return json.data.session as PhoneAuthSession;
}
