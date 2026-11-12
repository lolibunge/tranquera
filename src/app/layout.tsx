import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tranquera", template: "%s · Tranquera" },
  description: "Tranquera · gestión de campo",
  applicationName: "Tranquera",
  appleWebApp: { capable: true, title: "Tranquera", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-ground text-ink">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
