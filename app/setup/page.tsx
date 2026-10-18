import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectClaude } from "@/components/setup/ConnectClaude";
import { getMode, hasClaude } from "@/lib/mode";

export const metadata: Metadata = { title: "Connect Claude" };
// Reads the environment when the page is requested, so "Check again" sees a new key.
export const dynamic = "force-dynamic";

/** Screen 8. In live mode with a key there is nothing to connect, so go to Projects. */
export default function SetupPage() {
  if (getMode() === "live" && hasClaude(process.env)) redirect("/");
  return <ConnectClaude />;
}
