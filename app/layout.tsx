import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prospecta Easy by Comlink",
  description: "Sistema de prospecção e gestão de contatos comerciais",
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
