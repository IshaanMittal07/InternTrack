import Link from "next/link";

import { Pill } from "@/components/ui/pill";
import {
  PRIORITY_LABELS,
  REFERRAL_LABELS,
  REFERRAL_TONES,
  STAGE_LABELS,
  STAGE_TONES,
} from "@/lib/domain/constants";
import { deadlineLabel, deadlineStatus, formatDate, isFollowUpOverdue } from "@/lib/domain/dates";
import { contactProgress } from "@/lib/domain/summary";
import type { OpportunityWithRelations } from "@/lib/domain/types";

export function OpportunityCard({
  opportunity: o,
  today,
  href,
}: {
  opportunity: OpportunityWithRelations;
  today: string;
  href: string;
}) {
  const status = o.category === "applied" ? null : deadlineStatus(o.deadline, today);
  const deadlineTone =
    status === "overdue"
      ? "danger"
      : status === "today" || status === "soon"
        ? "warning"
        : "neutral";
  const overdueFollowUps = o.contacts.filter((c) =>
    isFollowUpOverdue(c.next_follow_up, today),
  ).length;
  const progress = contactProgress(o.contacts);

  return (
    <li>
      <Link
        href={href}
        scroll={false}
        className="flex h-full flex-col gap-3 rounded-xl bg-surface p-4 shadow-card transition-shadow hover:shadow-raised"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold break-words">{o.company}</h3>
            {o.role_title && <p className="text-sm break-words text-ink-muted">{o.role_title}</p>}
          </div>
          {o.priority === "high" && <Pill tone="accent">{PRIORITY_LABELS.high}</Pill>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {o.application_stage && (
            <Pill tone={STAGE_TONES[o.application_stage]}>{STAGE_LABELS[o.application_stage]}</Pill>
          )}
          {o.date_applied && <Pill>Applied {formatDate(o.date_applied)}</Pill>}
          {o.deadline && o.category !== "applied" && (
            <Pill tone={deadlineTone}>
              {status === "today" || status === "soon" ? "⚑ " : ""}
              {deadlineLabel(o.deadline, today)}
            </Pill>
          )}
          {o.referral_status !== "not_requested" && (
            <Pill tone={REFERRAL_TONES[o.referral_status]}>
              {REFERRAL_LABELS[o.referral_status]}
            </Pill>
          )}
          {o.term && <Pill>{o.term}</Pill>}
        </div>

        {(progress || overdueFollowUps > 0) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {progress && <span className="text-ink-muted">{progress}</span>}
            {overdueFollowUps > 0 && (
              <Pill tone="danger">
                {overdueFollowUps === 1
                  ? "1 follow-up overdue"
                  : `${overdueFollowUps} follow-ups overdue`}
              </Pill>
            )}
          </div>
        )}
      </Link>
    </li>
  );
}
