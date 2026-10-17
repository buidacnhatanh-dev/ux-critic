import type { Metadata } from "next";
import { FailedSample } from "@/components/states/StateSamples";

export const metadata: Metadata = { title: "Review failed", robots: { index: false } };

export default function StatePage() {
  return <FailedSample />;
}
