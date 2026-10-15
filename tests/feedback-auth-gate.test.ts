import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("../apps/web/lib/supabase/auth-server", () => ({
  getAuthUser: mocks.getAuthUser
}));
vi.mock("../apps/web/lib/supabase/server", () => ({
  getSupabaseServiceClient: mocks.getSupabaseServiceClient
}));

import { POST as submitFeedback } from "../apps/web/app/api/feedback/route";
import { POST as submitResultFeedback } from "../apps/web/app/api/result-feedback/route";
import { POST as submitFeedbackContact } from "../apps/web/app/api/feedback-contacts/route";

const origin = "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue(null);
});

describe("feedback authentication gate", () => {
  it.each([
    ["general and question feedback", "/api/feedback", submitFeedback],
    ["result feedback", "/api/result-feedback", submitResultFeedback],
    ["feedback contact details", "/api/feedback-contacts", submitFeedbackContact]
  ])("refuses unauthenticated %s before reading or writing data", async (_label, path, handler) => {
    const request = new Request(origin + path, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{}"
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getAuthUser).toHaveBeenCalledOnce();
    expect(mocks.getSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
