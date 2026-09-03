import type { Metadata } from "next";

import { AdminWorkspace } from "@/components/workspace-views";

export const metadata: Metadata = {
  title: "HR & Admin workspace",
};

export default function AdminPage() {
  return <AdminWorkspace />;
}
