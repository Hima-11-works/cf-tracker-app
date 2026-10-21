import { UserSheet } from "../components/user-sheet";

export const metadata = {
  title: "User sheet",
  description: "Check a whitelisted Codeforces user's probation sheet progress.",
  robots: { index: false, follow: false },
};

export default function UserPage() {
  return <UserSheet />;
}
