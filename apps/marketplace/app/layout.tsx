import "@faden/ui/styles.css";
import "./marketplace.css";
import "./requests.css";
import "@faden/ui/offers.css";
import "./checkout.css";
import "@faden/ui/design-review.css";
import "@faden/ui/production.css";
import "@faden/ui/appointments.css";
import "@faden/ui/fulfilment.css";
import "@faden/ui/order-messages.css";

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
  robots:
    process.env.NEXT_PUBLIC_APP_ENV === "production"
      ? undefined
      : { index: false, follow: false },
  title: "FADEN — Made for you",
  description:
    "A luxury marketplace for custom fashion and independent ateliers.",
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
