import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { AppProviders } from "@/components/shell/providers";

export const metadata: Metadata = {
  title: "DIALR — World Dialer",
  description: "The world's most powerful browser dialer. WebRTC + SIP + P2P, anywhere on Earth.",
  applicationName: "DIALR",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#10e6a5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="overflow-hidden">
        <AppProviders>
          <div className="flex h-screen w-screen">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <Header />
              <main className="flex-1 overflow-y-auto relative">
                <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />
                <div className="relative">{children}</div>
              </main>
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
