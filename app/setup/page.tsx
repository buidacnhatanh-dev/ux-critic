import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Connect Claude" };

export default function SetupPage() {
  return (
    <PagePlaceholder
      title="Connect Claude"
      note="Connect Claude with an API key on this laptop. Built in milestone M5."
    />
  );
}
