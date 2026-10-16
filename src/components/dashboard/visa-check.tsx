"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/ui/form-status";
import { describeActionError } from "@/components/ui/use-form-action";
import { VISA_LABELS, VISA_SPONSORSHIPS, type VisaSponsorship } from "@/lib/domain/constants";
import {
  checkVisaSponsorshipAction,
  listVisaUncheckedAction,
} from "@/server/actions/opportunities";

const BATCH = 5;

type Tally = Record<VisaSponsorship, number> & { unreachable: number };

function summarize(tally: Tally): string {
  const parts = VISA_SPONSORSHIPS.filter((v) => tally[v] > 0).map(
    (v) => `${tally[v]} ${VISA_LABELS[v]}`,
  );
  const checked = parts.length ? `Set ${parts.join(", ")}.` : "Nothing could be set.";
  const left =
    tally.unreachable > 0
      ? ` ${tally.unreachable} couldn't be reached right now and will be checked again next time.`
      : "";
  return checked + left;
}

/**
 * Fills in visa sponsorship for postings that don't have it yet, by reading
 * each posting's job description again, a few at a time. Runs on its own
 * when the dashboard opens with any unchecked; the button runs it again.
 */
export function VisaCheck({ unchecked }: { unchecked: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setMessage("");
    setError(null);
    const tally: Tally = { no: 0, maybe: 0, highly_likely: 0, yes: 0, unreachable: 0 };
    try {
      const listed = await listVisaUncheckedAction();
      if (!listed.ok) throw new Error(listed.error);
      const { ids } = listed.data;
      setProgress({ done: 0, total: ids.length });
      for (let i = 0; i < ids.length; i += BATCH) {
        const result = await checkVisaSponsorshipAction(ids.slice(i, i + BATCH));
        if (!result.ok) throw new Error(result.error);
        for (const { visa } of result.data.results) {
          if (visa) tally[visa] += 1;
          else tally.unreachable += 1;
        }
        setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
      }
      setMessage(summarize(tally));
    } catch (err) {
      setError(
        err instanceof Error && !/Server Action/i.test(err.message)
          ? err.message
          : describeActionError(err, navigator.onLine),
      );
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  // Once per visit; the ref keeps React's development double-run from starting two.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || unchecked === 0) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first render
  }, []);

  if (unchecked === 0 && !message && !error) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-card">
      {unchecked > 0 && (
        <Button variant="secondary" size="sm" pending={progress !== null} onClick={run}>
          {progress
            ? `Checking ${progress.done} of ${progress.total}…`
            : `Check visa sponsorship (${unchecked})`}
        </Button>
      )}
      <p className="text-sm text-ink-muted" role="status" aria-live="polite">
        {message ||
          (progress
            ? "Reading each posting's job description…"
            : `${unchecked === 1 ? "1 posting has" : `${unchecked} postings have`} no visa sponsorship set yet.`)}
      </p>
      {error && <FormStatus error={error} />}
    </div>
  );
}
