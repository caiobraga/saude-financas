import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saúde Finanças — Organize suas finanças",
  description: "Conecte suas contas bancárias e visualize suas transações em uma planilha organizada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
      >
        {children}
      </body>
    </html>
  );
}
