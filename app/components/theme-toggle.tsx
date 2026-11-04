"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "cf-probation-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    root.classList.toggle("dark", nextTheme === "dark");

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the current page theme even when browser storage is unavailable.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Switch theme"
      title="Switch theme"
    >
      <Sun className="theme-icon-sun" aria-hidden="true" />
      <Moon className="theme-icon-moon" aria-hidden="true" />
    </Button>
  );
}
