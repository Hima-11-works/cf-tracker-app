"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, Moon, Search, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleTheme } from "@/lib/theme";

type Action = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  href?: string;
  shortcut?: string;
  theme?: boolean;
};

const actions: Action[] = [
  { id: "leaderboard", label: "Open leaderboard", detail: "View accepted problem standings", keywords: "rank standings solved", href: "/leaderboard" },
  { id: "user", label: "Open user sheet", detail: "Look up a whitelisted Codeforces handle", keywords: "profile sheet progress", href: "/user?focus=handle" },
  { id: "admin", label: "Open admin", detail: "Manage the whitelist and probation sheet", keywords: "settings problems whitelist", href: "/admin?focus=whitelist" },
  { id: "theme", label: "Toggle theme", detail: "Switch between light and dark appearance", keywords: "dark light appearance", theme: true },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const filteredActions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return actions;
    return actions.filter((action) => (action.label + " " + action.detail + " " + action.keywords).toLowerCase().includes(term));
  }, [query]);

  useEffect(() => {
    function onGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(0, filteredActions.length - 1)));
  }, [filteredActions.length]);

  function close() {
    setOpen(false);
  }

  function runAction(action: Action | undefined) {
    if (!action) return;
    close();
    if (action.theme) {
      toggleTheme();
      return;
    }
    if (action.href) {
      const destination = new URL(action.href, window.location.origin);
      if (destination.pathname === pathname && destination.searchParams.has("focus")) {
        const targetId = destination.searchParams.get("focus") === "handle" ? "codeforces-handle" : "whitelist-handles";
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          (document.getElementById(targetId) ?? document.getElementById("admin-password"))?.focus();
        }));
      } else {
        router.push(action.href);
      }
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, filteredActions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAction(filteredActions[selected]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="command-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Open command menu (Ctrl/⌘ K)"
      >
        <Search aria-hidden="true" />
        <span>Search</span>
        <kbd className="command-trigger-hint">Ctrl/⌘ K</kbd>
      </Button>

      {open ? (
        <div className="command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-menu-title" onKeyDown={onMenuKeyDown}>
            <h2 id="command-menu-title" className="sr-only">Command menu</h2>
            <div className="command-search">
              <Search aria-hidden="true" />
              <Input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} placeholder="Search pages and actions…" aria-label="Search commands" aria-controls="command-options" aria-activedescendant={filteredActions[selected] ? "command-option-" + filteredActions[selected].id : undefined} />
              <Button variant="ghost" size="icon" type="button" onClick={close} aria-label="Close command menu" title="Close (Esc)"><X aria-hidden="true" /></Button>
            </div>
            <div className="command-results" id="command-options" role="listbox" aria-label="Actions">
              {filteredActions.length ? filteredActions.map((action, index) => (
                <button
                  type="button"
                  id={"command-option-" + action.id}
                  role="option"
                  aria-selected={selected === index}
                  className="command-option"
                  key={action.id}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => runAction(action)}
                >
                  <span className="command-option-icon" aria-hidden="true">
                    {action.theme ? (document.documentElement.dataset.theme === "dark" ? <Sun /> : <Moon />) : <Command />}
                  </span>
                  <span className="command-option-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
                  {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                </button>
              )) : <p className="command-empty">No matching actions.</p>}
            </div>
            <div className="command-footer" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span><kbd>Esc</kbd> Close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
