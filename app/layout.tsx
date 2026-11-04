import type { Metadata } from "next";
import Link from "next/link";
import { MainNav } from "./components/main-nav";
import "./globals.css";
import { DM_Mono, Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

const themeBootstrap = `try {
  const savedTheme = localStorage.getItem("cf-probation-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemTheme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
} catch {
  const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}`;

export const metadata: Metadata = {
  applicationName: "Codeforces Probation Tracker",
  title: { default: "Codeforces Probation Tracker", template: "%s · Codeforces Probation Tracker" },
  description: "Track probation sheet progress and Codeforces problem results.",
  openGraph: {
    type: "website",
    siteName: "Codeforces Probation Tracker",
    title: "Codeforces Probation Tracker",
    description: "Track probation sheet progress and Codeforces problem results.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable, dmMono.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <div className="site-frame">
          <a className="skip-link" href="#main-content">Skip to content</a>
          <header className="site-header">
            <Link href="/leaderboard" className="brand" aria-label="Codeforces Probation Tracker home">
              <span className="brand-mark" aria-hidden="true">CF</span>
              <span className="brand-name">Probation tracker</span>
            </Link>
            <MainNav />
          </header>
          <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
          <footer className="site-footer">
            <span>CODEFORCES · PROBATION SHEET</span>
            <span>Accepted results stay cached in Supabase.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
