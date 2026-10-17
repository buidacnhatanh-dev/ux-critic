"use client";

import { LoadStatus } from "@/components/LoadStatus";
import { useLoad } from "@/components/useLoad";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { DataClient } from "@/lib/data/client";
import { NewReviewForm, type NewReviewInitial } from "./NewReviewForm";

/** Loads what the form needs through DataClient. */
export async function loadNewReview(client: DataClient) {
  const [projects, checklist, samples] = await Promise.all([
    client.listProjects(),
    client.getChecklist(),
    client.listSamples ? client.listSamples() : Promise.resolve([]),
  ]);
  const details = await Promise.all(projects.map((p) => client.getProject(p.id)));
  return {
    projects: details.map((p) => ({
      id: p.id,
      name: p.name,
      versionNames: p.versions.map((v) => v.name),
    })),
    sources: checklist.sources,
    enabledRuleCount: checklist.rules.filter((r) => r.enabled).length,
    samples,
  };
}

/** Screen 3: the demo sample picker in demo mode, the upload form in live mode. */
export function NewReviewScreen({ initial }: { initial: NewReviewInitial }) {
  const client = useDataClient();
  const { state } = useLoad(() => loadNewReview(client), "new-review");
  return (
    <>
      <h1 style={{ marginBottom: "var(--space-7)" }}>New review</h1>
      {state.status === "ready" ? (
        <NewReviewForm form={client.mode} initial={initial} {...state.data} />
      ) : (
        <LoadStatus state={state} what="form" />
      )}
    </>
  );
}
