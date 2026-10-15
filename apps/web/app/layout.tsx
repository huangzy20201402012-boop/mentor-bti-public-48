import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnalyticsPageView } from "../components/AnalyticsPageView";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "导师BTI｜硕博生科研生态测试",
  description: "不是给导师排名，而是看清你身处怎样的科研生态。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "导师BTI｜硕博生科研生态测试",
    description: "不是给导师排名，而是看清你身处怎样的科研生态。",
    locale: "zh_CN",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AnalyticsPageView />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
