"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAuthServerClient, getAuthUser } from "../supabase/auth-server";
import { normalizeEmail } from "./email-otp";
import { MIN_PASSWORD_LENGTH } from "./password-policy";
import { getAuthCallbackUrl } from "./redirect-origin";

export type RequestOtpStatus = "sent" | "invalid_email" | "unavailable" | "failed";
export type PasswordSignInStatus = "signed_in" | "invalid_credentials" | "rate_limited" | "unavailable" | "failed";
export type PasswordSignUpStatus = "signed_in" | "signed_in_password_setup_needed" | "confirmation_required" | "account_exists" | "invalid_email" | "too_short" | "mismatch" | "weak_password" | "weak_password_length" | "weak_password_characters" | "weak_password_pwned" | "signup_disabled" | "rate_limited" | "unavailable" | "failed";
export type SetPasswordStatus = "updated" | "signed_out" | "too_short" | "mismatch" | "weak_password" | "weak_password_length" | "weak_password_characters" | "weak_password_pwned" | "same_password" | "reauth_required" | "unavailable" | "failed";

/**
 * Sends a sign-in link to the address.
 *
 * Every outcome is a return value rather than a thrown error, because this runs
 * as a Server Action invoked from a form: an exception would surface as an
 * opaque digest, and the user needs a sentence they can act on.
 *
 * Every valid address gets the same response after the Auth request, including
 * unknown addresses and delivery failures. This prevents account enumeration.
 * The UI describes the result conditionally rather than claiming delivery.
 */
export async function requestEmailOtp(rawEmail: string, rawOrigin: string): Promise<RequestOtpStatus> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid_email";
  const emailRedirectTo = getAuthCallbackUrl(rawOrigin);
  if (!emailRedirectTo) return "failed";

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return "unavailable";

  try {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        // Transitional recovery is only for existing accounts. New users use
        // the separate email-and-password registration flow below.
        shouldCreateUser: false,
        emailRedirectTo
      }
    });
    return "sent";
  } catch {
    return "sent";
  }
}

/** Signs in an existing account; Supabase writes the session to the SSR cookies. */
export async function signInWithPassword(rawEmail: string, password: string): Promise<PasswordSignInStatus> {
  const email = normalizeEmail(rawEmail);
  if (!email || !password) return "invalid_credentials";

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return "unavailable";

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
      // Keep wrong password, missing account, and unconfirmed email indistinguishable.
      return "invalid_credentials";
    }
    return "signed_in";
  } catch {
    return "failed";
  }
}

/** Registers a password account without relying on an email callback. */
export async function signUpWithPassword(
  rawEmail: string,
  password: string,
  confirmation: string
): Promise<PasswordSignUpStatus> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid_email";
  if (password !== confirmation) return "mismatch";
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return "unavailable";

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") return "account_exists";
      if (error.code === "email_address_invalid") return "invalid_email";
      if (error.code === "email_address_not_authorized") return "confirmation_required";
      if (error.code === "signup_disabled" || error.code === "email_provider_disabled") return "signup_disabled";
      if (error.code === "weak_password") {
        const reasons = "reasons" in error && Array.isArray(error.reasons) ? error.reasons : [];
        if (reasons.includes("pwned")) return "weak_password_pwned";
        if (reasons.includes("characters")) return "weak_password_characters";
        if (reasons.includes("length")) return "weak_password_length";
        return "weak_password";
      }
      if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return "rate_limited";
      return "failed";
    }
    if (!data?.user) return "failed";
    // A user without a session still needs email confirmation; do not report
    // successful registration until they can actually submit feedback.
    if (!data.session) return "confirmation_required";

    // A repeated signup may confirm an older unconfirmed account without
    // replacing its password. Make the submitted password work for next login.
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError && passwordError.code !== "same_password") return "signed_in_password_setup_needed";
      return "signed_in";
    } catch {
      return "signed_in_password_setup_needed";
    }
  } catch {
    return "failed";
  }
}

/** Adds or changes a password on the signed-in user, preserving their user ID. */
export async function setAccountPassword(password: string, confirmation: string): Promise<SetPasswordStatus> {
  if (password !== confirmation) return "mismatch";
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (!(await getAuthUser())) return "signed_out";

  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return "unavailable";

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return "updated";
    if (error.code === "weak_password") {
      const reasons = "reasons" in error && Array.isArray(error.reasons) ? error.reasons : [];
      if (reasons.includes("pwned")) return "weak_password_pwned";
      if (reasons.includes("characters")) return "weak_password_characters";
      if (reasons.includes("length")) return "weak_password_length";
      return "weak_password";
    }
    if (error.code === "same_password") return "same_password";
    if (error.code === "reauthentication_needed") return "reauth_required";
    return "failed";
  } catch {
    return "failed";
  }
}

/**
 * Clears the session cookies. Scoped to this browser; other devices stay signed in.
 *
 * Returns nothing so it can be used directly as a `<form action>`: React
 * re-renders the page after the action, and the cleared cookies are what make
 * the header show a signed-out state. There is no outcome the user could act on,
 * so there is none to report.
 */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
  } catch {
    // A session that could not be revoked server-side still loses its cookies
    // on the next successful refresh; throwing here would only show the user an
    // error page while leaving them signed in.
  }
  // The header and account page live in the root layout's tree; without this the
  // router may serve the cached signed-in render.
  revalidatePath("/", "layout");
}
