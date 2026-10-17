"use client";

import { useState } from "react";
import { LoadStatus } from "@/components/LoadStatus";
import { NewReviewForm } from "@/components/new/NewReviewForm";
import { loadNewReview } from "@/components/new/NewReviewScreen";
import { ReviewFailed } from "@/components/review/ReviewFailed";
import { newReviewHref, ReviewDone } from "@/components/review/ReviewScreen";
import { useToast } from "@/components/ui";
import { useLoad } from "@/components/useLoad";
import { useDataClient } from "@/lib/data/DataClientProvider";
import type { ReviewDetail } from "@/lib/data/types";
import { failedSample, partialSample } from "@/lib/sample-states";
import { SampleNotice } from "./SampleNotice";

const crumbsFor = (review: ReviewDetail) => [
  { label: "Projects", href: "/" },
  { label: review.projectName, href: `/projects/${review.projectId}` },
  { label: review.version.name },
];

/** Screen 10 with the Checkout practice v3 review stopped at the evaluation. */
export function FailedSample() {
  const client = useDataClient();
  const { showToast } = useToast();
  const { state } = useLoad(() => client.getReview("review-checkout-v3"), "failed");
  if (state.status !== "ready") return <LoadStatus state={state} what="sample" />;
  const review = failedSample(state.data);
  return (
    <>
      <SampleNotice>
        The Checkout practice v3 review, shown as if Claude had not answered in time.
      </SampleNotice>
      <ReviewFailed
        review={review}
        crumbs={crumbsFor(review)}
        changeSettingsHref={newReviewHref(state.data)}
        onTryAgain={() =>
          showToast({ message: "Sample state: in live mode this starts the review again." })
        }
      />
    </>
  );
}

/** Screen 11 with the measured issues of the Checkout practice v1 review. */
export function PartialSample() {
  const client = useDataClient();
  const { showToast } = useToast();
  const { state } = useLoad(async () => {
    const [review, checklist] = await Promise.all([
      client.getReview("review-checkout-v1"),
      client.getChecklist(),
    ]);
    return {
      review: partialSample(review),
      rules: new Map(checklist.rules.map((r) => [r.id, r.text])),
    };
  }, "partial");
  const [pushbacks, setPushbacks] = useState<Record<string, string | null>>({});
  if (state.status !== "ready") return <LoadStatus state={state} what="sample" />;
  const review = {
    ...state.data.review,
    issues: state.data.review.issues.map((issue) => {
      const reason = pushbacks[issue.id];
      return reason
        ? { ...issue, pushback: { reason, createdAt: new Date().toISOString() } }
        : issue;
    }),
  };
  return (
    <>
      <SampleNotice>
        The measured results of the Checkout practice v1 review, shown as if the evaluation had come
        back unreadable. Push backs here are not saved.
      </SampleNotice>
      <ReviewDone
        review={review}
        crumbs={crumbsFor(review)}
        compare={null}
        rules={state.data.rules}
        onSetPushback={async (issueId, reason) =>
          setPushbacks((p) => ({ ...p, [issueId]: reason }))
        }
        onRetryEvaluation={async () =>
          showToast({ message: "Sample state: in live mode this runs the evaluation again." })
        }
      />
    </>
  );
}

/** Screen 3 in live mode with screen 13: the upload form validates but never uploads. */
export function UploadSample() {
  const client = useDataClient();
  const { state } = useLoad(() => loadNewReview(client), "upload");
  return (
    <>
      <SampleNotice>
        The upload form from live mode. It checks what you add, but nothing is uploaded or sent.
      </SampleNotice>
      <h1 style={{ marginBottom: "var(--space-7)" }}>New review</h1>
      {state.status === "ready" ? (
        <NewReviewForm form="live" preview initial={{}} {...state.data} />
      ) : (
        <LoadStatus state={state} what="form" />
      )}
    </>
  );
}
