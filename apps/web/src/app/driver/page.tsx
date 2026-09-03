import type { Metadata } from "next";

import { DriverWorkspace } from "@/components/workspace-views";

export const metadata: Metadata = {
  title: "Driver workspace",
};

export default function DriverPage() {
  return <DriverWorkspace />;
}
