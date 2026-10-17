import type { Metadata } from "next";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issue?: string | string[] }>;
}) {
  const { id } = await params;
  const { issue } = await searchParams;
  return (
    <ReviewScreen
      id={decodeURIComponent(id)}
      initialIssueId={typeof issue === "string" ? issue : undefined}
    />
  );
}
