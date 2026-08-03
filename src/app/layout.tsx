import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gaya — Inspeções inteligentes", template: "%s | Gaya" },
  description: "Gestão completa de inspeções e visitas técnicas.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#f7faf9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
