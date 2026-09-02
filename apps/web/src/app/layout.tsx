import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Waste-Wise | Ahmedabad showcase",
    template: "%s | Waste-Wise",
  },
  description: "A clickable Ahmedabad smart-waste operations showcase prototype.",
  applicationName: "Waste-Wise",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/waste-wise-192.png",
    apple: "/icons/waste-wise-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2d2a",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
