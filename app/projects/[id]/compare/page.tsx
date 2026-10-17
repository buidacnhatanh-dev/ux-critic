import type { Metadata } from "next";
import { CompareScreen } from "@/components/compare/CompareScreen";

export const metadata: Metadata = { title: "Compare versions" };

type Search = { from?: string | string[]; to?: string | string[] };
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const search = await searchParams;
  return (
    <CompareScreen
      projectId={decodeURIComponent(id)}
      fromId={one(search.from)}
      toId={one(search.to)}
    />
  );
}
