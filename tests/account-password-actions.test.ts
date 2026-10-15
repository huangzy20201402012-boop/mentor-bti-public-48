import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  revalidate: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../apps/web/lib/supabase/auth-server", () => ({
  createSupabaseAuthServerClient: mocks.createClient,
  getAuthUser: mocks.getUser
}));

import { requestEmailOtp, setAccountPassword, signInWithPassword, signUpWithPassword } from "../apps/web/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "../apps/web/lib/auth/password-policy";

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  updateUser: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth });
  mocks.getUser.mockResolvedValue({ id: "existing-user-id", email: "owner@example.com" });
});

afterEach(() => vi.unstubAllEnvs());

describe("password signup", () => {
  it("uses the requested eight-character minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("does not claim signup succeeded while the project still requires email confirmation", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "new-user" }, session: null }, error: null });

    expect(await signUpWithPassword(" New@Example.com ", "a-long-new-password", "a-long-new-password"))
      .toBe("confirmation_required");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "a-long-new-password"
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("signs in immediately when confirmation is disabled and the password is already current", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "new-user" }, session: { access_token: "test" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: { code: "same_password" } });
    expect(await signUpWithPassword("new@example.com", "a-long-new-password", "a-long-new-password"))
      .toBe("signed_in");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a-long-new-password" });
  });

  it("sets the chosen password on a previously unconfirmed account", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "unconfirmed-user" }, session: { access_token: "test" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await signUpWithPassword("owner@example.com", "new-password", "new-password")).toBe("signed_in");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });

  it("directs a signed-in account to set its password if the update fails", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "unconfirmed-user" }, session: { access_token: "test" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: { code: "reauthentication_needed" } });
    expect(await signUpWithPassword("owner@example.com", "new-password", "new-password"))
      .toBe("signed_in_password_setup_needed");
  });

  it("reports that an existing address cannot create another account", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "user_already_exists" } });
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "email_exists" } });
    expect(await signUpWithPassword("owner@example.com", "a-long-new-password", "a-long-new-password"))
      .toBe("account_exists");
    expect(await signUpWithPassword("owner@example.com", "a-long-new-password", "a-long-new-password"))
      .toBe("account_exists");
  });

  it("explains delivery and configuration failures without claiming registration worked", async () => {
    auth.signUp.mockResolvedValueOnce({ data: null, error: { code: "email_address_not_authorized" } });
    auth.signUp.mockResolvedValueOnce({ data: null, error: { code: "signup_disabled" } });
    auth.signUp.mockResolvedValueOnce({ data: null, error: { code: "over_email_send_rate_limit", status: 429 } });
    const password = "a-long-new-password";
    expect(await signUpWithPassword("new@example.com", password, password)).toBe("confirmation_required");
    expect(await signUpWithPassword("new@example.com", password, password)).toBe("signup_disabled");
    expect(await signUpWithPassword("new@example.com", password, password)).toBe("rate_limited");
  });

  it("rejects invalid form input before contacting Auth", async () => {
    const password = "x".repeat(MIN_PASSWORD_LENGTH);
    expect(await signUpWithPassword("invalid", password, password)).toBe("invalid_email");
    expect(await signUpWithPassword("new@example.com", password, "different")).toBe("mismatch");
    expect(await signUpWithPassword("new@example.com", "short", "short")).toBe("too_short");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("password sign-in", () => {
  it("uses the existing Supabase account for password sign-in", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });

    expect(await signInWithPassword(" Owner@Example.com ", "correct-password"))
      .toBe("signed_in");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "correct-password"
    });
  });

  it("does not disclose whether the account is absent or unconfirmed", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: { code: "invalid_credentials", status: 400 } });
    auth.signInWithPassword.mockResolvedValueOnce({ error: { code: "email_not_confirmed", status: 400 } });

    expect(await signInWithPassword("owner@example.com", "wrong"))
      .toBe("invalid_credentials");
    expect(await signInWithPassword("owner@example.com", "wrong"))
      .toBe("invalid_credentials");
  });

  it("returns a distinct retry state when Supabase rate-limits sign-in", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "over_request_rate_limit", status: 429 } });
    expect(await signInWithPassword("owner@example.com", "wrong"))
      .toBe("rate_limited");
  });
});

it("keeps the transitional email link limited to an existing account", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app");
  auth.signInWithOtp.mockResolvedValue({ error: null });
  expect(await requestEmailOtp(
    "owner@example.com",
    "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app"
  )).toBe("sent");
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: "owner@example.com",
    options: {
      shouldCreateUser: false,
      emailRedirectTo: "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app/auth/callback"
    }
  });
});

it("does not reveal whether an address can receive a transitional link", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app");
  auth.signInWithOtp.mockResolvedValueOnce({ error: { code: "user_not_found", status: 404 } });
  auth.signInWithOtp.mockResolvedValueOnce({ error: { code: "email_address_not_authorized", status: 403 } });
  auth.signInWithOtp.mockRejectedValueOnce(new Error("network unavailable"));
  const origin = "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app";

  expect(await requestEmailOtp("unknown@example.com", origin)).toBe("sent");
  expect(await requestEmailOtp("unknown@example.com", origin)).toBe("sent");
  expect(await requestEmailOtp("unknown@example.com", origin)).toBe("sent");
});

describe("setting a password on the current account", () => {
  it("refuses to update a password without a verified signed-in user", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect(await setAccountPassword("a-long-new-password", "a-long-new-password"))
      .toBe("signed_out");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("updates the current user's password without creating a new user", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await setAccountPassword("a-long-new-password", "a-long-new-password"))
      .toBe("updated");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a-long-new-password" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects a mismatch before contacting Supabase", async () => {
    expect(await setAccountPassword("a-long-new-password", "another-long-password"))
      .toBe("mismatch");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("enforces the shared password-length boundary before contacting Supabase", async () => {
    const short = "x".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(await setAccountPassword(short, short)).toBe("too_short");
    expect(mocks.createClient).not.toHaveBeenCalled();

    auth.updateUser.mockResolvedValue({ error: null });
    const accepted = "x".repeat(MIN_PASSWORD_LENGTH);
    expect(await setAccountPassword(accepted, accepted)).toBe("updated");
  });

  it("surfaces Supabase's password-strength and reauthentication requirements", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { code: "weak_password" } });
    auth.updateUser.mockResolvedValueOnce({ error: { code: "reauthentication_needed" } });

    expect(await setAccountPassword("a-long-new-password", "a-long-new-password"))
      .toBe("weak_password");
    expect(await setAccountPassword("a-long-new-password", "a-long-new-password"))
      .toBe("reauth_required");
  });

  it("explains a reused password and specific weak-password reasons", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { code: "same_password" } });
    auth.updateUser.mockResolvedValueOnce({ error: { code: "weak_password", reasons: ["pwned"] } });
    auth.updateUser.mockResolvedValueOnce({ error: { code: "weak_password", reasons: ["characters"] } });
    auth.updateUser.mockResolvedValueOnce({ error: { code: "weak_password", reasons: ["length"] } });

    const password = "a-long-new-password";
    expect(await setAccountPassword(password, password)).toBe("same_password");
    expect(await setAccountPassword(password, password)).toBe("weak_password_pwned");
    expect(await setAccountPassword(password, password)).toBe("weak_password_characters");
    expect(await setAccountPassword(password, password)).toBe("weak_password_length");
  });
});
