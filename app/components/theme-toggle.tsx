"use client";

const THEME_STORAGE_KEY = "cf-probation-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the current page theme even when browser storage is unavailable.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Switch between light and dark theme"
      title="Switch between light and dark theme"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle className="theme-icon-sun" cx="12" cy="12" r="3.5" />
        <path className="theme-icon-sun" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        <path className="theme-icon-moon" d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" />
      </svg>
    </button>
  );
}
