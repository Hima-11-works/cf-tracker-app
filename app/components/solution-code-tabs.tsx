"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

const languages = [
  { key: "cpp", label: "C++" },
  { key: "java", label: "Java" },
  { key: "python", label: "Python" },
] as const;

type Language = (typeof languages)[number]["key"];

export function SolutionCodeTabs({ code }: { code: { cpp: string; java: string; python: string } }) {
  const [active, setActive] = useState<Language>("cpp");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const timerRef = useRef<number | null>(null);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const panelId = `${instanceId}-panel`;
  const activeIndex = languages.findIndex((language) => language.key === active);
  const activeLabel = languages[activeIndex].label;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function selectLanguage(next: Language) {
    setActive(next);
    setCopied(false);
    setCopyError(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % languages.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + languages.length) % languages.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = languages.length - 1;
    else return;
    event.preventDefault();
    const next = languages[nextIndex];
    selectLanguage(next.key);
    tabRefs.current[nextIndex]?.focus();
  }

  async function copyCode() {
    setCopied(false);
    setCopyError(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!navigator.clipboard) {
      setCopyError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(code[active]);
      setCopied(true);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="code-tabs-shell">
      <div className="code-tabs-bar">
        <div className="code-tabs-list" role="tablist" aria-label="Solution language">
          {languages.map((language, index) => (
            <button
              key={language.key}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`${instanceId}-tab-${language.key}`}
              aria-selected={active === language.key}
              aria-controls={panelId}
              tabIndex={active === language.key ? 0 : -1}
              className="code-tabs-tab"
              onClick={() => selectLanguage(language.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {language.label}
            </button>
          ))}
        </div>
        <div className="code-tabs-actions">
          <span className="code-tabs-status" role="status" aria-live="polite">
            {copied ? "Copied" : copyError ? "Copy failed" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="code-tabs-copy"
            onClick={copyCode}
            aria-label={`Copy ${activeLabel} solution`}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`${instanceId}-tab-${active}`} className="code-tabs-panel">
        <pre tabIndex={0} aria-label={`${activeLabel} solution`} className="code-tabs-pre"><code>{code[active]}</code></pre>
      </div>
    </div>
  );
}
