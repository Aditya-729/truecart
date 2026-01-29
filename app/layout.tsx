import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trust Verifier",
  description:
    "Simple, rule-based trust checks for product claims vs policies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
