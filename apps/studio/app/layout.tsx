import "@faden/ui/styles.css";
import "@faden/ui/offers.css";
import "@faden/ui/design-review.css";
import "@faden/ui/production.css";
import "@faden/ui/appointments.css";
import "@faden/ui/fulfilment.css";
import "@faden/ui/order-messages.css";
import "./studio-refresh.css";

import type { Metadata } from "next";
import { Karla, Syne } from "next/font/google";
import type { ReactNode } from "react";

const karla = Karla({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-karla",
});

const syne = Syne({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "FADEN Studio",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${karla.variable} ${syne.variable}`}>{children}</body>
    </html>
  );
}
