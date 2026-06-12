import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AnalyticsProvider } from "@/components/shared/AnalyticsProvider";
import { ServiceWorker } from "@/components/shared/ServiceWorker";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const APP_URL = "https://greenrides.co.in";

export const metadata: Metadata = {
  title: "Green — Odisha Hill Routes",
  description:
    "Premium ride platform connecting Koraput, Jeypore, and Odisha hill towns. Book intercity rides with verified drivers.",
  keywords: ["koraput", "jeypore", "odisha", "rides", "cab", "intercity"],
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Green Rides",
  },
  openGraph: {
    title: "Green — Odisha Hill Routes",
    description: "Book intercity rides with verified drivers on Odisha's hill routes.",
    url: APP_URL,
    siteName: "Green Rides",
    images: [{ url: "/og", width: 1200, height: 630, alt: "Green Rides" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Green — Odisha Hill Routes",
    description: "Book intercity rides with verified drivers on Odisha's hill routes.",
    images: ["/og"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon-32.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2818",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream font-sans">
        <AnalyticsProvider />
        <ServiceWorker />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
