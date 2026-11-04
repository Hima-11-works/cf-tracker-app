"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, LockKeyhole, LogIn, LogOut, Plus, Save, Search, Trash2 } from "lucide-react";
import { fetchDeduped } from "@/lib/client-fetch";

type Problem = { contestId: string; index: string; name: string; rating: string; section: string; orderIndex: number | null };
type AdminData = { whitelist: string[] };
type NewProblemDraft = { url: string; section: string };
const blankProblem: NewProblemDraft = { url: "", section: "Probation Sheet" };

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

function AdminSessionSkeleton() {
  return (
    <div className="admin-session-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Checking admin session…</span>
      <Card className="login-panel admin-session-card" aria-hidden="true">
        <CardHeader className="login-panel-header">
          <Skeleton className="size-10" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="login-panel-content">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDataSkeleton() {
  return (
    <div className="admin-data-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading the saved whitelist and probation sheet…</span>
      <div className="admin-toolbar admin-loading-toolbar" aria-hidden="true">
        <div className="admin-toolbar-copy">
          <div className="admin-toolbar-state">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="admin-toolbar-actions">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="admin-grid" aria-hidden="true">
        <Card className="admin-section whitelist-section">
          <CardHeader>
            <div className="admin-card-heading">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent className="admin-card-content">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </CardContent>
        </Card>

        <Card className="admin-section probation-section">
          <CardHeader>
            <div className="admin-card-heading">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent className="admin-card-content">
            <div className="admin-add-panel admin-add-panel-top">
              <Skeleton className="h-4 w-28" />
              <div className="admin-add-grid">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-full" />
            <div className="admin-problems">
              {Array.from({ length: 10 }, (_, index) => (
                <div className="admin-problem admin-loading-problem" key={index}>
                  <div className="admin-loading-problem-name">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-32 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
            <div className="admin-pagination">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasLoadedAdminData, setHasLoadedAdminData] = useState(false);
  const [password, setPassword] = useState("");
  const [whitelistText, setWhitelistText] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [problemCount, setProblemCount] = useState(0);
  const [problemPage, setProblemPage] = useState(1);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [problemEdits, setProblemEdits] = useState<Record<string, Problem>>({});
  const [newProblems, setNewProblems] = useState<Problem[]>([]);
  const [removedProblems, setRemovedProblems] = useState<Array<{ contestId: number; index: string }>>([]);
  const [draft, setDraft] = useState<NewProblemDraft>(blankProblem);
  const [problemQuery, setProblemQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lookingUpProblem, setLookingUpProblem] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const actionInFlight = useRef(false);
  const problemLookupInFlight = useRef(false);
  const problemPageRequest = useRef(0);
  const loadedProblemQuery = useRef("");
  const loadedProblemPage = useRef(1);
  const pageSize = 10;
  const totalProblemPages = Math.max(1, Math.ceil(problemCount / pageSize));

  const loadProblemPage = useCallback(async (page: number, query: string) => {
    const requestId = ++problemPageRequest.current;
    setLoadingProblems(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await fetchDeduped("/api/admin/problems?" + params.toString(), { cache: "no-store" });
      const data = await readJson(response);
      if (requestId !== problemPageRequest.current) return;
      setProblems((data.problems ?? []).map((problem: {
        contestId: number; index: string; name: string; rating: number | null; section: string; orderIndex: number;
      }) => ({
        contestId: String(problem.contestId),
        index: problem.index,
        name: problem.name,
        rating: problem.rating == null ? "" : String(problem.rating),
        section: problem.section,
        orderIndex: problem.orderIndex,
      })));
      setProblemCount(data.problemCount ?? 0);
      setProblemPage(data.page ?? page);
      loadedProblemQuery.current = query;
      loadedProblemPage.current = page;
    } catch (caught) {
      if (requestId === problemPageRequest.current) {
        setError(caught instanceof Error ? caught.message : "Could not load this problem page.");
      }
    } finally {
      if (requestId === problemPageRequest.current) setLoadingProblems(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    problemPageRequest.current += 1;
    setLoadingProblems(false);
    const [whitelistResponse, problemsResponse] = await Promise.all([
      fetchDeduped("/api/admin/data", { cache: "no-store" }),
      fetchDeduped("/api/admin/problems?page=1", { cache: "no-store" }),
    ]);
    const [whitelistData, problemsData] = await Promise.all([
      readJson(whitelistResponse) as Promise<AdminData>,
      readJson(problemsResponse),
    ]);
    setWhitelistText(whitelistData.whitelist.join("\n"));
    setProblems((problemsData.problems ?? []).map((problem: {
      contestId: number; index: string; name: string; rating: number | null; section: string; orderIndex: number;
    }) => ({
      contestId: String(problem.contestId),
      index: problem.index,
      name: problem.name,
      rating: problem.rating == null ? "" : String(problem.rating),
      section: problem.section,
      orderIndex: problem.orderIndex,
    })));
    setProblemCount(problemsData.problemCount ?? 0);
    setProblemPage(1);
    setProblemQuery("");
    loadedProblemQuery.current = "";
    loadedProblemPage.current = 1;
    setProblemEdits({});
    setNewProblems([]);
    setRemovedProblems([]);
    setHasUnsavedChanges(false);
    setHasLoadedAdminData(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetchDeduped("/api/admin/session", { cache: "no-store" })
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

  useEffect(() => {
    if (!hasLoadedAdminData ||
        (problemQuery === loadedProblemQuery.current && problemPage === loadedProblemPage.current)) return;
    const timer = window.setTimeout(() => {
      void loadProblemPage(problemPage, problemQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hasLoadedAdminData, loadProblemPage, problemPage, problemQuery]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionInFlight.current) return;
    actionInFlight.current = true;
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
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function signOut() {
    if (actionInFlight.current || problemLookupInFlight.current) return;
    actionInFlight.current = true;
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
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function retryLoadAdminData() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await loadAdminData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load tracker data.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  function problemKey(problem: { contestId: string | number; index: string }) {
    return problem.contestId + ":" + problem.index.toUpperCase();
  }

  function editProblem(problem: Problem, value: string) {
    const key = problemKey(problem);
    setProblemEdits((current) => ({
      ...current,
      [key]: { ...problem, section: value },
    }));
    setHasUnsavedChanges(true);
    setError("");
    setNotice("");
  }

  function removeProblem(problem: Problem) {
    const key = problemKey(problem);
    setProblems((current) => current.filter((entry) => problemKey(entry) !== key));
    setProblemEdits((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setRemovedProblems((current) => current.some((entry) => problemKey(entry) === key)
      ? current
      : [...current, { contestId: Number(problem.contestId), index: problem.index }]);
    setHasUnsavedChanges(true);
    setError("");
    setNotice("");
  }

  async function addProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (problemLookupInFlight.current || actionInFlight.current) return;
    if (!draft.url.trim()) {
      setError("Paste a Codeforces problem link first.");
      return;
    }
    problemLookupInFlight.current = true;
    setError("");
    setNotice("");
    setLookingUpProblem(true);
    try {
      const result = await readJson(await fetch("/api/admin/problem-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.url }),
      })) as { contestId: number; index: string; name: string; rating: number | null };
      const newKey = String(result.contestId) + ":" + result.index.toUpperCase();
      const alreadyLoaded = problems.some((problem) => problemKey(problem) === newKey) ||
        Object.values(problemEdits).some((problem) => problemKey(problem) === newKey) ||
        newProblems.some((problem) => problemKey(problem) === newKey);
      if (alreadyLoaded) throw new Error("That problem is already on the sheet.");
      setNewProblems((current) => [...current, {
        contestId: String(result.contestId),
        index: result.index,
        name: result.name,
        rating: result.rating == null ? "" : String(result.rating),
        section: draft.section.trim() || "Probation Sheet",
        orderIndex: null,
      }]);
      setHasUnsavedChanges(true);
      setDraft(blankProblem);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not look up that Codeforces problem.");
    } finally {
      problemLookupInFlight.current = false;
      setLookingUpProblem(false);
    }
  }

  async function save() {
    if (!hasUnsavedChanges || actionInFlight.current || problemLookupInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const whitelist = whitelistText.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
    const payload = {
      whitelist,
      problemUpdates: Object.values(problemEdits).map((problem) => ({
        contestId: Number(problem.contestId),
        index: problem.index,
        name: problem.name,
        rating: problem.rating.trim() ? Number(problem.rating) : null,
        section: problem.section,
        orderIndex: problem.orderIndex,
      })),
      newProblems: newProblems.map((problem) => ({
        contestId: Number(problem.contestId),
        index: problem.index,
        name: problem.name,
        rating: problem.rating.trim() ? Number(problem.rating) : null,
        section: problem.section,
      })),
      removedProblems,
    };

    try {
      const result = await readJson(await fetch("/api/admin/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      await loadAdminData();
      setNotice("Saved " + result.whitelistCount + " handles and " + result.problemCount + " problems.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save tracker data.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  const whitelistCount = whitelistText.split(/\r?\n/).filter((entry) => entry.trim()).length;
  const visibleProblems = problems
    .map((problem) => ({ problem: problemEdits[problemKey(problem)] ?? problem }))
    .filter(({ problem }) => !removedProblems.some((removed) => problemKey(removed) === problemKey(problem)));
  const currentSearch = problemQuery.trim();

  if (checkingSession) {
    return <AdminSessionSkeleton />;
  }

  if (isAdmin && !hasLoadedAdminData && !error) {
    return <AdminDataSkeleton />;
  }

  if (isAdmin && !hasLoadedAdminData && error) {
    return (
      <Card className="login-panel" aria-live="polite">
        <CardHeader>
          <CardTitle><h2>Tracker data didn&apos;t load</h2></CardTitle>
          <CardDescription>Retry the request or sign out and try again.</CardDescription>
        </CardHeader>
        <CardContent className="login-panel-content">
          <Alert variant="destructive" className="form-error"><AlertDescription>{error}</AlertDescription></Alert>
          <div className="toolbar-controls">
            <Button type="button" onClick={() => void retryLoadAdminData()} disabled={busy}>{busy ? "Loading..." : "Retry loading"}</Button>
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
                <LogIn data-icon="inline-start" aria-hidden="true" />{busy ? "Signing in..." : "Sign in"}
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
              <Button variant="outline" type="button" onClick={() => void signOut()} disabled={busy || lookingUpProblem}>
                <LogOut data-icon="inline-start" aria-hidden="true" />Sign out
              </Button>
              <Button type="button" onClick={() => void save()} disabled={busy || lookingUpProblem || !hasUnsavedChanges}>
                <Save data-icon="inline-start" aria-hidden="true" />{busy ? "Saving..." : "Save changes"}
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
                    placeholder={"handle_one\n*iot_lab_member"}
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
                <Badge variant="secondary" className="admin-count-badge">
                  {problemQuery.trim() ? problemCount + " matches" : problemCount + " problems"}
                </Badge>
              </CardHeader>
              <CardContent className="admin-card-content">
                <div className="admin-add-panel admin-add-panel-top">
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
                      <Plus data-icon="inline-start" aria-hidden="true" />{lookingUpProblem ? "Looking up..." : "Add problem"}
                    </Button>
                  </form>
                </div>

                <div className="admin-problem-tools">
                  <div className="admin-search-field">
                    <Search className="admin-search-icon" aria-hidden="true" />
                    <Input
                      id="admin-problem-search"
                      aria-label="Search problems by name, ID, rating, or section"
                      value={problemQuery}
                      onChange={(event) => { setProblemQuery(event.target.value); setProblemPage(1); }}
                      placeholder="Search problems..."
                      disabled={busy || (problemCount === 0 && !problemQuery.trim())}
                    />
                  </div>
                  <span className="admin-result-count" aria-live="polite">
                    {loadingProblems ? "Loading..." : visibleProblems.length + " shown"}
                  </span>
                </div>

                {problemCount === 0 && newProblems.length === 0 ? (
                  <Alert role="status" className="admin-empty">
                    <AlertDescription>{currentSearch ? "No problems match this search." : "No problems on the sheet yet. Add the first one above."}</AlertDescription>
                  </Alert>
                ) : visibleProblems.length === 0 && newProblems.length === 0 ? (
                  <Alert role="status" className="admin-empty"><AlertDescription>No problems on this page match the search. Try another name, ID, rating, or section.</AlertDescription></Alert>
                ) : visibleProblems.length > 0 ? (
                  <div className="admin-problems" role="list" aria-label="Problems on this page">
                    {visibleProblems.map(({ problem }) => (
                      <div className="admin-problem" role="listitem" key={problemKey(problem)}>
                        <div className="admin-problem-details">
                          <a href={"https://codeforces.com/contest/" + encodeURIComponent(problem.contestId) + "/problem/" + encodeURIComponent(problem.index)} target="_blank" rel="noreferrer">
                            <span className="admin-problem-id mono">{problem.contestId}{problem.index}</span>
                            <span className="admin-problem-name">{problem.name}</span>
                          </a>
                          {problem.rating ? <Badge variant="outline" className="admin-problem-rating">Rating {problem.rating}</Badge> : <span className="admin-problem-unrated">No rating</span>}
                        </div>
                        <div className="field admin-section-field">
                          <Label className="sr-only" htmlFor={"problem-section-" + problem.contestId + "-" + problem.index}>Section for {problem.contestId}{problem.index}</Label>
                          <Input id={"problem-section-" + problem.contestId + "-" + problem.index} className="admin-problem-input section-input" value={problem.section} onChange={(event) => editProblem(problem, event.target.value)} placeholder="Section" disabled={busy} />
                        </div>
                        <Button variant="ghost" size="icon" className="remove-problem" type="button" aria-label={"Remove " + (problem.name || "problem " + problem.contestId + problem.index)} title="Remove problem" onClick={() => removeProblem(problem)} disabled={busy}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {newProblems.length > 0 ? (
                  <div className="admin-pending-problems" aria-label="Unsaved problem additions">
                    <div className="admin-pending-heading">
                      <strong>Pending additions</strong>
                      <span>These will be added when you save.</span>
                    </div>
                    {newProblems.map((problem) => (
                      <div className="admin-problem admin-pending-problem" key={problemKey(problem)}>
                        <div className="admin-problem-details">
                          <a href={"https://codeforces.com/contest/" + encodeURIComponent(problem.contestId) + "/problem/" + encodeURIComponent(problem.index)} target="_blank" rel="noreferrer">
                            <span className="admin-problem-id mono">{problem.contestId}{problem.index}</span>
                            <span className="admin-problem-name">{problem.name}</span>
                          </a>
                          {problem.rating ? <Badge variant="outline" className="admin-problem-rating">Rating {problem.rating}</Badge> : <span className="admin-problem-unrated">No rating</span>}
                        </div>
                        <span className="admin-pending-section">{problem.section}</span>
                        <Button variant="ghost" size="icon" className="remove-problem" type="button" aria-label={"Remove pending " + problem.name} title="Remove pending addition" onClick={() => { setNewProblems((current) => current.filter((entry) => problemKey(entry) !== problemKey(problem))); setHasUnsavedChanges(true); }} disabled={busy}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {totalProblemPages > 1 ? (
                  <nav className="admin-pagination" aria-label="Probation sheet pages">
                    <Button variant="outline" size="sm" type="button" onClick={() => void loadProblemPage(problemPage - 1, problemQuery)} disabled={busy || loadingProblems || problemPage <= 1 || problemQuery !== loadedProblemQuery.current}>Previous</Button>
                    <span aria-live="polite">Page {problemPage} of {totalProblemPages}</span>
                    <Button variant="outline" size="sm" type="button" onClick={() => void loadProblemPage(problemPage + 1, problemQuery)} disabled={busy || loadingProblems || problemPage >= totalProblemPages || problemQuery !== loadedProblemQuery.current}>Next</Button>
                  </nav>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
