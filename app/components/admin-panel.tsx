"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, LockKeyhole, LogIn, LogOut, Plus, Save, Search, Trash2 } from "lucide-react";

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
  const [problemQuery, setProblemQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
    setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
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
    setHasUnsavedChanges(true);
    setError("");
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
      setHasUnsavedChanges(true);
      setDraft(blankProblem);
      setProblemQuery("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not look up that Codeforces problem.");
    } finally {
      setLookingUpProblem(false);
    }
  }

  async function save() {
    if (!hasUnsavedChanges) return;
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

  const whitelistCount = whitelistText.split(/\r?\n/).filter((entry) => entry.trim()).length;
  const normalizedProblemQuery = problemQuery.trim().toLowerCase();
  const visibleProblems = problems
    .map((problem, position) => ({ problem, position }))
    .filter(({ problem }) => !normalizedProblemQuery || [
      problem.contestId,
      problem.index,
      problem.name,
      problem.rating,
      problem.section,
    ].some((value) => value.toLowerCase().includes(normalizedProblemQuery)));

  if (checkingSession) {
    return (
      <div className="admin-session-loading" role="status">
        <span className="sr-only">Checking admin session…</span>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isAdmin && !hasLoadedAdminData) {
    return (
      <Card className="login-panel" aria-live="polite">
        <CardHeader>
          <CardTitle><h2>{error ? "Tracker data didn’t load" : "Loading tracker data"}</h2></CardTitle>
          <CardDescription>{error ? "Retry the request or sign out and try again." : "Your saved whitelist and problem sheet will appear here shortly."}</CardDescription>
        </CardHeader>
        <CardContent className="login-panel-content">
          {error ? <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="toolbar-controls">
            <Button type="button" onClick={() => void retryLoadAdminData()} disabled={busy}>{busy ? "Loading…" : "Retry loading"}</Button>
            <Button variant="outline" type="button" onClick={() => void signOut()} disabled={busy}><LogOut data-icon="inline-start" aria-hidden="true" />Sign out</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!isAdmin ? (
        <Card className="login-panel">
          <CardHeader className="login-panel-header">
            <span className="admin-login-icon" aria-hidden="true"><LockKeyhole /></span>
            <CardTitle><h2>Admin sign in</h2></CardTitle>
            <CardDescription>Manage the Codeforces whitelist and probation sheet.</CardDescription>
          </CardHeader>
          <CardContent className="login-panel-content">
            {error ? <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert> : null}
            <form className="login-form" onSubmit={signIn}>
              <div className="field password-input">
                <Label htmlFor="admin-password">Admin password</Label>
                <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <Button size="lg" type="submit" disabled={busy}>
                <LogIn data-icon="inline-start" aria-hidden="true" />{busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="small muted setup-note">Use the admin password configured for this deployment.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="admin-workspace" aria-label="Tracker administration">
          <div className="admin-toolbar">
            <div className="admin-toolbar-copy">
              <div className="admin-toolbar-state">
                <Badge variant="secondary" className="admin-status"><span className="admin-status-dot" aria-hidden="true" />Signed in</Badge>
                {hasUnsavedChanges ? (
                  <Badge variant="outline" className="admin-dirty-state">Unsaved changes</Badge>
                ) : (
                  <span className="admin-saved-state"><Check aria-hidden="true" />All changes saved</span>
                )}
              </div>
              <p className="admin-save-note">Removing a problem also removes its saved results. Removing a handle only hides it and keeps its progress.</p>
            </div>
            <div className="admin-toolbar-actions">
              <Button variant="outline" type="button" onClick={() => void signOut()} disabled={busy}>
                <LogOut data-icon="inline-start" aria-hidden="true" />Sign out
              </Button>
              <Button type="button" onClick={() => void save()} disabled={busy || lookingUpProblem || !hasUnsavedChanges}>
                <Save data-icon="inline-start" aria-hidden="true" />{busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>

          {error ? <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {notice ? <Alert role="status" className="form-success"><AlertDescription>{notice}</AlertDescription></Alert> : null}

          <div className="admin-grid">
            <Card className="admin-section whitelist-section">
              <CardHeader>
                <div className="admin-card-heading">
                  <CardTitle><h2>Whitelist</h2></CardTitle>
                  <CardDescription>One handle per line. Prefix IoT Lab members with an asterisk (*).</CardDescription>
                </div>
                <Badge variant="secondary" className="admin-count-badge">{whitelistCount} {whitelistCount === 1 ? "handle" : "handles"}</Badge>
              </CardHeader>
              <CardContent className="admin-card-content">
                <div className="field">
                  <Label htmlFor="whitelist-handles">Codeforces handles</Label>
                  <Textarea
                    id="whitelist-handles"
                    className="whitelist-textarea"
                    aria-describedby="whitelist-help"
                    value={whitelistText}
                    onChange={(event) => { setWhitelistText(event.target.value); setHasUnsavedChanges(true); setError(""); setNotice(""); }}
                    placeholder="handle_one&#10;*iot_lab_member"
                    disabled={busy}
                    spellCheck={false}
                  />
                </div>
                <p id="whitelist-help" className="small muted admin-hint">The asterisk marks IoT Lab membership; it is not part of the Codeforces handle.</p>
              </CardContent>
            </Card>

            <Card className="admin-section probation-section">
              <CardHeader>
                <div className="admin-card-heading">
                  <CardTitle><h2>Probation sheet</h2></CardTitle>
                  <CardDescription>Paste a Codeforces problem link to add it. Edit its section inline.</CardDescription>
                </div>
                <Badge variant="secondary" className="admin-count-badge">{problems.length} {problems.length === 1 ? "problem" : "problems"}</Badge>
              </CardHeader>
              <CardContent className="admin-card-content">
                <div className="admin-problem-tools">
                  <div className="admin-search-field">
                    <Search className="admin-search-icon" aria-hidden="true" />
                    <Input
                      id="admin-problem-search"
                      aria-label="Search problems by name, ID, rating, or section"
                      value={problemQuery}
                      onChange={(event) => setProblemQuery(event.target.value)}
                      placeholder="Search problems…"
                      disabled={busy || problems.length === 0}
                    />
                  </div>
                  <span className="admin-result-count" aria-live="polite">{visibleProblems.length} shown</span>
                </div>

                {problems.length === 0 ? (
                  <Alert role="status" className="admin-empty"><AlertDescription>No problems on the sheet yet. Add the first one below.</AlertDescription></Alert>
                ) : visibleProblems.length === 0 ? (
                  <Alert role="status" className="admin-empty"><AlertDescription>No problems match “{problemQuery}”. Try another name, ID, rating, or section.</AlertDescription></Alert>
                ) : (
                  <div className="admin-problems" role="list" aria-label="Problems on the sheet">
                    {visibleProblems.map(({ problem, position }) => (
                      <div className="admin-problem" role="listitem" key={`${position}-${problem.contestId}-${problem.index}`}>
                        <div className="admin-problem-details">
                          <a href={`https://codeforces.com/contest/${encodeURIComponent(problem.contestId)}/problem/${encodeURIComponent(problem.index)}`} target="_blank" rel="noreferrer">
                            <span className="admin-problem-id mono">{problem.contestId}{problem.index}</span>
                            <span className="admin-problem-name">{problem.name}</span>
                          </a>
                          {problem.rating ? <Badge variant="outline" className="admin-problem-rating">Rating {problem.rating}</Badge> : <span className="admin-problem-unrated">No rating</span>}
                        </div>
                        <div className="field admin-section-field">
                          <Label className="sr-only" htmlFor={`problem-section-${position}`}>Section for {problem.contestId}{problem.index}</Label>
                          <Input id={`problem-section-${position}`} className="admin-problem-input section-input" value={problem.section} onChange={(event) => editProblem(position, event.target.value)} placeholder="Section" disabled={busy} />
                        </div>
                        <Button variant="ghost" size="icon" className="remove-problem" type="button" aria-label={`Remove ${problem.name || `problem ${position + 1}`}`} title="Remove problem" onClick={() => { setProblems((current) => current.filter((_, index) => index !== position)); setHasUnsavedChanges(true); setError(""); setNotice(""); }} disabled={busy}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="admin-add-panel">
                  <div className="admin-add-heading">
                    <h3>Add a problem</h3>
                    <p>Problem name and rating fill in automatically.</p>
                  </div>
                  <form className="admin-add-grid" onSubmit={addProblem} aria-label="Add a problem">
                    <div className="field problem-url-field">
                      <Label htmlFor="new-problem-url">Codeforces problem link</Label>
                      <Input id="new-problem-url" className="admin-problem-input problem-url-input" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://codeforces.com/contest/1915/problem/A" disabled={busy || lookingUpProblem} required />
                    </div>
                    <div className="field section-field">
                      <Label htmlFor="new-problem-section">Section</Label>
                      <Input id="new-problem-section" className="admin-problem-input section-input" value={draft.section} onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value }))} placeholder="Section" disabled={busy || lookingUpProblem} />
                    </div>
                    <Button type="submit" disabled={busy || lookingUpProblem}>
                      <Plus data-icon="inline-start" aria-hidden="true" />{lookingUpProblem ? "Looking up…" : "Add problem"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
