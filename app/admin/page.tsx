import { AdminPanel } from "../components/admin-panel";

export const metadata = {
  title: "Admin",
  description: "Manage the Codeforces probation roster and problem sheet.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
