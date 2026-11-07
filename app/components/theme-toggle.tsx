"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleTheme } from "@/lib/theme";

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Switch theme"
      title="Switch theme (also available in Ctrl/⌘ K)"
    >
      <Sun className="theme-icon-sun" aria-hidden="true" />
      <Moon className="theme-icon-moon" aria-hidden="true" />
    </Button>
  );
}
