import type { PostingHighlight } from "@/lib/domain/summary";

/** Card outline color for each posting highlight, shared by the cards and the legend. */
export const HIGHLIGHT_BORDERS: Record<PostingHighlight, string> = {
  rejected: "border-status-rejected",
  connection_unsent: "border-status-unsent",
  connection_sent: "border-status-sent",
  messaged_some: "border-status-messaged-some",
  messaged: "border-status-messaged",
  spoken: "border-status-spoken",
};

export const HIGHLIGHT_LABELS: Record<PostingHighlight, string> = {
  rejected: "Rejected",
  connection_unsent: "Connection unsent",
  connection_sent: "Connection sent",
  messaged_some: "Some messaged",
  messaged: "All messaged",
  spoken: "Spoken to",
};
