import type { Metadata } from "next";

import { DispatchWorkspace } from "@/components/workspace-views";

export const metadata: Metadata = {
  title: "Dispatch workspace",
};

export default function DispatchPage() {
  return <DispatchWorkspace />;
}
