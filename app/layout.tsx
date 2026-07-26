import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcureFlow — Order Approvals & Payment Control",
  description:
    "Request, approve, validate delivery, and confirm payment — a clean financial checks-and-balances workflow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('procureflow.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
