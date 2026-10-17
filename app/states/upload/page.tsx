import type { Metadata } from "next";
import { UploadSample } from "@/components/states/StateSamples";

export const metadata: Metadata = { title: "Upload and form errors", robots: { index: false } };

export default function StatePage() {
  return <UploadSample />;
}
