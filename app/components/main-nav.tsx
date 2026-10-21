"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/user", label: "User sheet" },
  { href: "/admin", label: "Admin" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Main navigation">
      {links.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
      <ThemeToggle />
    </nav>
  );
}
