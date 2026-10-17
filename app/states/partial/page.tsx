import type { Metadata } from "next";
import { PartialSample } from "@/components/states/StateSamples";

export const metadata: Metadata = { title: "Evaluation unreadable", robots: { index: false } };

export default function StatePage() {
  return <PartialSample />;
}
