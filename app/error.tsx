"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="not-found" role="alert">
      <h1>This page couldn’t load.</h1>
      <p>Refresh the page or try again.</p>
      <Button size="lg" type="button" onClick={() => reset()}>Try again</Button>
    </section>
  );
}
