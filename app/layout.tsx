import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NS AI Check-ins",
  description: "NetworkSpace internal check-in system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-white via-white to-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
