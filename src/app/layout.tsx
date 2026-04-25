import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { AppProviders } from "@/components/shell/providers";

export const metadata: Metadata = {
  title: "DIALR — World Dialer",
  description: "Browser-native dialer + CRM. SIP, P2P and least-cost routing to anywhere on Earth.",
  applicationName: "DIALR",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://rsms.me" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/css/jetbrains-mono.css"
        />
      </head>
      <body>
        <AppProviders>
          <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <Header />
              <main className="app-bg flex-1 overflow-y-auto">
                <div className="grid-pattern h-32 -mb-32 pointer-events-none opacity-50" />
                <div className="relative">{children}</div>
              </main>
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
