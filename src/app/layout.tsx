import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import AppShell from "@/components/app/app-shell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "@/styles/tokens.css";
import "./globals.css";

// A variable font: weights 400 to 800 come from one file.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

// Title, description and home-screen name are the prototype's (`redesign/design/prototype/index.html`
// and its manifest).
export const metadata: Metadata = {
  title: "Daybook",
  description: "Check your spending, quickly.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Daybook",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

// viewport-fit=cover lets the page reach the edges of a notched phone; the bars add the safe-area
// padding. Zooming is left on.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFCEE",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={hanken.variable}>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
