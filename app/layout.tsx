import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Controlei",
  description: "Sistema de gestão e controle de contatos comerciais",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Controlei",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  openGraph: {
    title: "Controlei",
    description: "Sistema inteligente para gestao de contatos, pipeline de vendas e controle comercial.",
    type: "website",
    locale: "pt_BR",
    siteName: "Controlei",
  },
  twitter: {
    card: "summary",
    title: "Controlei",
    description: "Sistema inteligente para gestao de contatos e pipeline de vendas.",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
