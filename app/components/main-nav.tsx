"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { CommandMenu } from "./command-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchDeduped } from "@/lib/client-fetch";
import { readStaleRecord, writeStaleCache } from "@/lib/stale-cache";

const links = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/user", label: "User sheet" },
  { href: "/admin", label: "Admin" },
];

type LeaderboardSeed = {
  leaderboard: Array<{ handle: string; solved: number; rank: number; isIotLabMember: boolean }>;
  totalCount: number;
  problemCount: number;
  hasMore: boolean;
};

const LEADERBOARD_CACHE_KEY = "leaderboard:exclude-iot:false";
const PREFETCH_FRESH_MS = 15_000;

function prefetchLeaderboard() {
  const cached = readStaleRecord<LeaderboardSeed>(LEADERBOARD_CACHE_KEY);
  if (cached && Date.now() - cached.savedAt < PREFETCH_FRESH_MS) return;
  void fetchDeduped("/api/leaderboard?page=1&excludeIotLabMembers=false", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return;
      writeStaleCache(LEADERBOARD_CACHE_KEY, await response.json() as LeaderboardSeed);
    })
    .catch(() => {
      // The page will report an error if its own request also fails.
    });
}

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Main navigation">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          onMouseEnter={link.href === "/leaderboard" && pathname !== link.href ? prefetchLeaderboard : undefined}
          onFocus={link.href === "/leaderboard" && pathname !== link.href ? prefetchLeaderboard : undefined}
          className={cn(
            buttonVariants({ variant: pathname === link.href ? "default" : "ghost" }),
            "nav-link"
          )}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
      <CommandMenu />
      <ThemeToggle />
    </nav>
  );
}
