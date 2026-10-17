import type { Metadata } from "next";
import { ProjectHistory } from "@/components/project/ProjectHistory";

export const metadata: Metadata = { title: "Project history" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectHistory id={decodeURIComponent(id)} />;
}
