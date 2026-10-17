import type { Metadata } from "next";
import { NewReviewScreen } from "@/components/new/NewReviewScreen";

export const metadata: Metadata = { title: "New review" };

type Search = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  return (
    <NewReviewScreen
      initial={{
        project: one(search.project),
        projectName: one(search.projectName),
        version: one(search.version),
        context: one(search.context),
        sample: one(search.sample),
      }}
    />
  );
}
