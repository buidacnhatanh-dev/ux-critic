import type { Metadata } from "next";
import { ConnectClaude } from "@/components/setup/ConnectClaude";

export const metadata: Metadata = { title: "Connect Claude" };

export default function SetupPage() {
  return <ConnectClaude />;
}
