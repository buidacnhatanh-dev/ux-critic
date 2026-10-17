import type { Metadata } from "next";
import { ConnectClaude } from "@/components/setup/ConnectClaude";
import { SampleNotice } from "@/components/states/SampleNotice";

export const metadata: Metadata = { title: "Connect Claude", robots: { index: false } };

export default function SetupStatePage() {
  return (
    <>
      <SampleNotice>On the laptop, every page leads here until an API key is set.</SampleNotice>
      <ConnectClaude sample />
    </>
  );
}
