"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="not-found" role="alert">
      <p className="not-found-code mono">PAGE ERROR</p>
      <h1>This page couldn’t load.</h1>
      <p>Refresh the page or try again.</p>
      <button className="button" type="button" onClick={() => reset()}>Try again</button>
    </section>
  );
}
