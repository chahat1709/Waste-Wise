import type { Metadata } from "next";

import { BinSetup } from "@/components/bin-setup";

export const metadata: Metadata = {
  title: "Configure real bins",
};

export default function SetupPage() {
  return <BinSetup />;
}
