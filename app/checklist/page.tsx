import type { Metadata } from "next";
import { ChecklistScreen } from "@/components/checklist/ChecklistScreen";

export const metadata: Metadata = { title: "My checklist" };
// Reads the environment when the page is requested, not at build time.
export const dynamic = "force-dynamic";

export default function ChecklistPage() {
  // Server only: the key itself never leaves the server, only whether it is set.
  const connection = {
    model: process.env.UXC_MODEL?.trim() || null,
    keySaved: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    pricesSet: Boolean(
      process.env.UXC_PRICE_INPUT_PER_M?.trim() && process.env.UXC_PRICE_OUTPUT_PER_M?.trim(),
    ),
  };
  return <ChecklistScreen connection={connection} />;
}
