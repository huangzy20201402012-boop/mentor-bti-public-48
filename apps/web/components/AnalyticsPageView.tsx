"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent, type EventFields } from "../lib/analytics/client";
import type { EventName } from "../lib/analytics/contracts";
import { isCountedPagePath } from "../lib/public-stats";

export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    const path = pathname || "/";
    if (isCountedPagePath(path)) trackEvent("page_view", { pagePath: path });
  }, [pathname]);

  return null;
}

export function AnalyticsEventOnMount({ eventName, fields }: { eventName: EventName; fields?: EventFields }) {
  useEffect(() => {
    trackEvent(eventName, fields);
  }, [eventName, fields]);

  return null;
}
