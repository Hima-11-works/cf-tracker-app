import { Leaderboard } from "../components/leaderboard";

export const metadata = {
  title: "Leaderboard",
  description: "See Codeforces probation sheet standings by accepted problems.",
};

export default function LeaderboardPage() {
  return <div className="page-compact"><Leaderboard /></div>;
}
