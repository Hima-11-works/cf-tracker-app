"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Problem = { contestId: string; index: string; name: string; rating: string; section: string };
type AdminData = { whitelist: string[]; problems: Array<{ contestId: number; index: string; name: string; rating: number | null; section: string }> };
type NewProblemDraft = { url: string; section: string };
const blankProblem: NewProblemDraft = { url: "", section: "Probation Sheet" };

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

export function AdminPanel() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasLoadedAdminData, setHasLoadedAdminData] = useState(false);
  const [password, setPassword] = useState("");
  const [whitelistText, setWhitelistText] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [draft, setDraft] = useState<NewProblemDraft>(blankProblem);
  const [busy, setBusy] = useState(false);
  const [lookingUpProblem, setLookingUpProblem] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAdminData = useCallback(async () => {
    const response = await fetch("/api/admin/data", { cache: "no-store" });
    const data = (await readJson(response)) as AdminData;
    setWhitelistText(data.whitelist.join("\n"));
    setProblems(data.problems.map((problem) => ({
      contestId: String(problem.contestId),
      index: problem.index,
      name: problem.name,
      rating: problem.rating == null ? "" : String(problem.rating),
      section: problem.section,
    })));
    setHasLoadedAdminData(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then(readJson)
      .then(async (result) => {
        if (!active) return;
        setIsAdmin(Boolean(result.isAdmin));
        if (result.isAdmin) await loadAdminData();
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not check the admin session.");
      })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [loadAdminData]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readJson(await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      setPassword("");
      setIsAdmin(true);
      await loadAdminData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await readJson(await fetch("/api/admin/session", { method: "DELETE" }));
      setIsAdmin(false);
      setHasLoadedAdminData(false);
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function retryLoadAdminData() {
    setBusy(true);
    setError("");
    try {
      await loadAdminData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load tracker data.");
    } finally {
      setBusy(false);
    }
  }

  function editProblem(position: number, value: string) {
    setProblems((current) => current.map((problem, index) => index === position ? { ...problem, section: value } : problem));
    setNotice("");
  }

  async function addProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.url.trim()) {
      setError("Paste a Codeforces problem link first.");
      return;
    }
    setError("");
    setNotice("");
    setLookingUpProblem(true);
    try {
      const result = await readJson(await fetch("/api/admin/problem-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.url }),
      })) as { contestId: number; index: string; name: string; rating: number | null };
      if (problems.some((problem) => problem.contestId === String(result.contestId) && problem.index.toUpperCase() === result.index.toUpperCase())) {
        throw new Error("That problem is already on the sheet.");
      }
      setProblems((current) => [...current, {
        contestId: String(result.contestId),
        index: result.index,
        name: result.name,
        rating: result.rating == null ? "" : String(result.rating),
        section: draft.section.trim() || "Probation Sheet",
      }]);
      setDraft(blankProblem);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not look up that Codeforces problem.");
    } finally {
      setLookingUpProblem(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    const whitelist = whitelistText.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
    const payload = {
      whitelist,
      problems: problems.map((problem) => ({
        contestId: Number(problem.contestId),
        index: problem.index,
        name: problem.name,
        rating: problem.rating.trim() ? Number(problem.rating) : null,
        section: problem.section,
      })),
    };
    try {
      const result = await readJson(await fetch("/api/admin/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      await loadAdminData();
      setNotice(`Saved ${result.whitelistCount} handles and ${result.problemCount} problems.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save tracker data.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) return <p className="loading-line" role="status">Checking admin session…</p>;

  if (isAdmin && !hasLoadedAdminData) {
    return (
      <>
        <section className="login-panel" aria-live="polite">
          <h2>{error ? "Tracker data didn’t load" : "Loading tracker data"}</h2>
          <p>{error || "Your saved whitelist and problem sheet will appear here shortly."}</p>
          <div className="toolbar-controls">
            <button className="button" type="button" onClick={() => void retryLoadAdminData()} disabled={busy}>{busy ? "Loading…" : "Retry loading"}</button>
            <button className="button button-quiet" type="button" onClick={() => void signOut()} disabled={busy}>Sign out</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {!isAdmin ? (
        <section className="login-panel">
          <h2>Admin sign in</h2>
          <p>Enter the password configured in the server environment to edit tracker data.</p>
          <form className="login-form" onSubmit={signIn}>
            <div className="field password-input">
              <label htmlFor="admin-password">Admin password</label>
              <input id="admin-password" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <button className="button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="small muted">First run? Set <code>ADMIN_PASSWORD</code> and Supabase credentials in your local environment.</p>
        </section>
      ) : (
        <>
          <div className="admin-topline">
            <div className="admin-status">Signed in</div>
            <button className="button button-quiet" type="button" onClick={() => void signOut()} disabled={busy}>Sign out</button>
          </div>

          <div>
            <div className="admin-grid">
              <section className="admin-section">
                <h2>Whitelist</h2>
                <p>One Codeforces handle per line. Prefix IoT Lab members with an asterisk (*). Removing a handle hides it and preserves its saved progress.</p>
                <label className="field" htmlFor="whitelist-handles">
                  <span className="small muted">Active handles</span>
                  <textarea
                    id="whitelist-handles"
                    className="text-area"
                    value={whitelistText}
                    onChange={(event) => { setWhitelistText(event.target.value); setNotice(""); }}
                    placeholder="handle_one&#10;*iot_lab_member"
                    disabled={busy}
                    spellCheck={false}
                  />
                </label>
                <p className="small muted">The asterisk is a marker; the stored Codeforces handle stays unchanged.</p>
              </section>

              <section className="admin-section">
                <h2>Probation sheet</h2>
                <p>Paste a Codeforces problem link to fill in its name and rating. Sections group the rows.</p>
                {problems.length === 0 ? (
                  <p className="admin-empty">No problems on the sheet yet. Paste a Codeforces link below to add the first one.</p>
                ) : (
                  <div className="admin-problems" role="list" aria-label="Problems on the sheet">
                    {problems.map((problem, position) => (
                      <div className="admin-problem" role="listitem" key={`${position}-${problem.contestId}-${problem.index}`}>
                        <div className="admin-problem-details">
                          <a href={`https://codeforces.com/contest/${encodeURIComponent(problem.contestId)}/problem/${encodeURIComponent(problem.index)}`} target="_blank" rel="noreferrer">
                            <span className="mono">{problem.contestId}{problem.index}</span> · {problem.name}
                          </a>
                          <span className="small muted">{problem.rating ? `Rating ${problem.rating}` : "No rating listed"}</span>
                        </div>
                        <input className="problem-input section-input" aria-label={`Problem ${position + 1} section`} value={problem.section} onChange={(event) => editProblem(position, event.target.value)} placeholder="Section" disabled={busy} />
                        <button className="button button-quiet remove-problem" type="button" aria-label={`Remove ${problem.name || `problem ${position + 1}`}`} onClick={() => { setProblems((current) => current.filter((_, index) => index !== position)); setNotice(""); }} disabled={busy}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}

                <form className="admin-add-grid" onSubmit={addProblem} aria-label="Add a problem">
                  <input className="problem-input problem-url-input" aria-label="Codeforces problem link" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://codeforces.com/contest/1915/problem/A" disabled={busy || lookingUpProblem} />
                  <input className="problem-input section-input" aria-label="New problem section" value={draft.section} onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value }))} placeholder="Section" disabled={busy || lookingUpProblem} />
                  <button className="button button-secondary" type="submit" disabled={busy || lookingUpProblem}>{lookingUpProblem ? "Looking up…" : "Add problem"}</button>
                </form>
              </section>
            </div>

            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {notice ? <p className="form-success" role="status">{notice}</p> : null}
            <div className="admin-actions">
              <span>Saving replaces the active whitelist and sheet order. Removing sheet problems deletes their saved results.</span>
              <button className="button" type="button" onClick={() => void save()} disabled={busy || lookingUpProblem}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </>
      )}
      {!isAdmin && error ? <p className="form-error" role="alert">{error}</p> : null}
    </>
  );
}
