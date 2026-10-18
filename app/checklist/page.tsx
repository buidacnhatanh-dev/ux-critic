import type { Metadata } from "next";
import { ChecklistScreen } from "@/components/checklist/ChecklistScreen";

export const metadata: Metadata = { title: "My checklist" };
// Reads the environment when the page is requested, not at build time.
export const dynamic = "force-dynamic";

/** Euros per million tokens, or null unless both prices are set (docs/01). */
function prices(input: string | undefined, output: string | undefined) {
  const inputPerM = Number(input?.trim() || NaN);
  const outputPerM = Number(output?.trim() || NaN);
  return Number.isFinite(inputPerM) && Number.isFinite(outputPerM)
    ? { inputPerM, outputPerM }
    : null;
}

export default function ChecklistPage() {
  // Server only: the key itself never leaves the server, only whether it is set.
  const connection = {
    model: process.env.UXC_MODEL?.trim() || null,
    keySaved: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    prices: prices(process.env.UXC_PRICE_INPUT_PER_M, process.env.UXC_PRICE_OUTPUT_PER_M),
  };
  return <ChecklistScreen connection={connection} />;
}
