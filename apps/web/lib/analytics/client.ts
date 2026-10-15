"use client";

import type { EventName } from "./contracts";
import { PRIVACY_VERSION } from "./version";

const SESSION_KEY = "mentor-bti:anonymous-session:v1";

export interface EventFields {
  pagePath?: string;
  questionIndex?: number;
  questionId?: string;
  typeCode?: string;
  domainCode?: "ED" | "EN" | "MD" | "MN";
  shareMethod?: "native" | "copy";
}

export interface AnonymousResultFields {
  resultKey: string;
  typeCode: string;
  domainCode: "ED" | "EN" | "MD" | "MN";
  axisEm: number;
  axisDn: number;
  axisSf: number;
  axisCo: number;
  confidenceLevel: number;
  boundaryAxes: Array<"em" | "dn" | "sf" | "co">;
  scoringVersion: string;
  contentVersion: string;
}

let sessionPromise: Promise<string | null> | null = null;

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function isDoNotTrackEnabled(): boolean {
  return typeof navigator !== "undefined" && navigator.doNotTrack === "1";
}

/** Explicit anonymous-research consent is handled separately from this L1 signal. */
export function isAnonymousAnalyticsAllowed(): boolean {
  return !isDoNotTrackEnabled();
}

function clientType(): "mobile" | "desktop" | "tablet" | "wechat_webview" | "unknown" {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("micromessenger")) return "wechat_webview";
  if (/ipad|tablet/.test(userAgent)) return "tablet";
  if (/android|iphone|ipod|mobile/.test(userAgent)) return "mobile";
  return userAgent ? "desktop" : "unknown";
}

function optionalUtm(name: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(name)?.trim();
  return value || undefined;
}

function storedSessionId(): string | null {
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

function saveSessionId(id: string): void {
  try { window.localStorage.setItem(SESSION_KEY, id); } catch { /* memory-only analytics is acceptable */ }
}

async function postJson(path: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function getOrCreateAnonymousSession(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = storedSessionId();
  if (existing) return Promise.resolve(existing);
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const referrer = (() => {
      try { return document.referrer ? new URL(document.referrer).hostname : undefined; } catch { return undefined; }
    })();
    try {
      const response = await fetch("/api/analytics/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryPath: currentPath(),
          entryReferrer: referrer,
          clientType: clientType(),
          utmSource: optionalUtm("utm_source"),
          utmMedium: optionalUtm("utm_medium"),
          utmCampaign: optionalUtm("utm_campaign"),
          privacyVersion: PRIVACY_VERSION
        }),
        keepalive: true
      });
      if (!response.ok) return null;
      const payload = await response.json() as { sessionId?: unknown };
      if (typeof payload.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.sessionId)) return null;
      saveSessionId(payload.sessionId);
      return payload.sessionId;
    } catch {
      return null;
    } finally {
      sessionPromise = null;
    }
  })();
  return sessionPromise;
}

export function trackEvent(eventName: EventName, fields: EventFields = {}): void {
  if (!isAnonymousAnalyticsAllowed()) return;
  const { shareMethod, ...eventFields } = fields;
  void getOrCreateAnonymousSession().then((sessionId) => {
    if (!sessionId) return;
    void postJson("/api/analytics/events", {
      sessionId,
      eventName,
      ...eventFields,
      pagePath: eventFields.pagePath ?? currentPath(),
      metadata: shareMethod ? { shareMethod } : {}
    }).then((saved) => {
      if (saved && eventName === "page_view") {
        window.dispatchEvent(new Event("mentor-bti:stats-changed"));
      }
    });
  });
}

export function saveAnonymousResult(fields: AnonymousResultFields): void {
  if (!isAnonymousAnalyticsAllowed()) return;
  void getOrCreateAnonymousSession().then((sessionId) => {
    if (!sessionId) return;
    void postJson("/api/anonymous-results", { sessionId, ...fields });
  });
}
