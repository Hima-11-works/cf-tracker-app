import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="not-found">
      <h1>That page isn’t on the sheet.</h1>
      <p>Check the address or return to the current leaderboard.</p>
      <Link className={buttonVariants({ size: "lg" })} href="/leaderboard">Go to leaderboard</Link>
    </section>
  );
}
