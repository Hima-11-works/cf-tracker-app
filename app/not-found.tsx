import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found">
      <p className="not-found-code mono">404 · NOT FOUND</p>
      <h1>That page isn’t on the sheet.</h1>
      <p>Check the address or return to the current leaderboard.</p>
      <Link className="button" href="/leaderboard">Go to leaderboard</Link>
    </section>
  );
}
