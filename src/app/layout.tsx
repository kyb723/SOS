import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SOS — Café team rota",
  description: "A local café scheduling prototype for ST, CSW and SOHO W.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
