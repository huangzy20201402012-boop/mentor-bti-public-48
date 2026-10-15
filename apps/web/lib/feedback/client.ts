"use client";

import { getOrCreateAnonymousSession } from "../analytics/client";
import type { FeedbackInput, ResultFeedbackInput } from "../analytics/contracts";

export type FeedbackSubmission = "submitted" | "login_required" | "unavailable" | "failed";
export type FeedbackReceipt =
  | { status: "submitted"; feedbackId: number }
  | { status: "login_required" }
  | { status: "unavailable" }
  | { status: "failed" };

async function submitWithReceipt(path: string, body: unknown): Promise<FeedbackReceipt> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      if (response.status === 401) return { status: "login_required" };
      return response.status === 503 ? { status: "unavailable" } : { status: "failed" };
    }
    const payload = await response.json() as { feedbackId?: unknown };
    return typeof payload.feedbackId === "number" ? { status: "submitted", feedbackId: payload.feedbackId } : { status: "failed" };
  } catch {
    return { status: "unavailable" };
  }
}

async function submitStatus(path: string, body: unknown): Promise<FeedbackSubmission> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.ok) return "submitted";
    if (response.status === 401) return "login_required";
    return response.status === 503 ? "unavailable" : "failed";
  } catch {
    return "unavailable";
  }
}

export async function submitFeedback(input: Omit<FeedbackInput, "sessionId">): Promise<FeedbackSubmission> {
  const receipt = await submitFeedbackWithReceipt(input);
  return receipt.status;
}

export async function submitFeedbackWithReceipt(input: Omit<FeedbackInput, "sessionId">): Promise<FeedbackReceipt> {
  const sessionId = await getOrCreateAnonymousSession();
  return sessionId ? submitWithReceipt("/api/feedback", { sessionId, ...input }) : { status: "unavailable" };
}

export async function submitResultFeedback(input: Omit<ResultFeedbackInput, "sessionId">): Promise<FeedbackSubmission> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return "unavailable";
  return submitStatus("/api/result-feedback", { sessionId, ...input });
}

export async function submitFeedbackContact(input: { feedbackId: number; email: string; privacyVersion: string }): Promise<FeedbackSubmission> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return "unavailable";
  const receipt = await submitWithReceipt("/api/feedback-contacts", { sessionId, ...input, consent: true });
  return receipt.status;
}
