import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/shared/service-worker-registrar";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RejoFood — Pesan, Masak, Antar, Atur",
  description:
    "RejoFood: ekosistem jasa antar makanan lokal — Pelanggan, Merchant, Driver, dan Admin dalam satu aplikasi terintegrasi.",
  keywords: [
    "RejoFood",
    "antar makanan",
    "food delivery",
    "Indonesia",
    "pesanan online",
  ],
  authors: [{ name: "RejoFood Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RejoFood",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "RejoFood",
    description: "Pesan, Masak, Antar, Atur — semua dalam satu aplikasi.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D1B4E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <ServiceWorkerRegistrar />
          <Toaster />
          <SonnerToaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
