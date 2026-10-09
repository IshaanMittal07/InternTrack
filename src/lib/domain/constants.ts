import type { PillTone } from "@/components/ui/pill";
import type { Enums } from "@/lib/supabase/database.types";

export type Category = Enums<"opportunity_category">;
export type Stage = Enums<"application_stage">;
export type ReferralStatus = Enums<"referral_status">;
export type Priority = Enums<"priority_level">;
export type TagColor = Enums<"tag_color">;
export type OutreachStatus = Enums<"outreach_status">;
export type LinkedinConnection = Enums<"linkedin_connection">;

export const CATEGORIES = ["applied", "planning", "interested"] as const satisfies Category[];
export const STAGES = [
  "submitted",
  "online_assessment",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const satisfies Stage[];
export const REFERRAL_STATUSES = [
  "not_requested",
  "requested",
  "received",
  "declined",
] as const satisfies ReferralStatus[];
export const PRIORITIES = ["low", "medium", "high"] as const satisfies Priority[];
export const LINKEDIN_CONNECTIONS = ["not_sent", "sent"] as const satisfies LinkedinConnection[];
export const OUTREACH_STATUSES = [
  "not_sent",
  "sent",
  "read",
  "replied",
] as const satisfies OutreachStatus[];
export const TAG_COLORS = [
  "terracotta",
  "sage",
  "amber",
  "slate",
  "plum",
  "teal",
] as const satisfies TagColor[];

export const CATEGORY_LABELS: Record<Category, string> = {
  applied: "Applied",
  planning: "Planning",
  interested: "Interested",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  applied: "Applications you have submitted.",
  planning: "Postings you intend to apply to.",
  interested: "Companies you like that haven't posted internships yet.",
};

export const STAGE_LABELS: Record<Stage, string> = {
  submitted: "Submitted",
  online_assessment: "Online assessment",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STAGE_TONES: Record<Stage, PillTone> = {
  submitted: "slate",
  online_assessment: "plum",
  interviewing: "accent",
  offer: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

export const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  not_requested: "Not requested",
  requested: "Referral requested",
  received: "Referral received",
  declined: "Referral declined",
};

export const REFERRAL_TONES: Record<ReferralStatus, PillTone> = {
  not_requested: "neutral",
  requested: "amber",
  received: "success",
  declined: "neutral",
};

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  not_sent: "Message not sent",
  sent: "Message sent",
  read: "Message read",
  replied: "Message replied",
};

export const OUTREACH_TONES: Record<OutreachStatus, PillTone> = {
  not_sent: "neutral",
  sent: "slate",
  read: "amber",
  replied: "success",
};

export const LINKEDIN_LABELS: Record<LinkedinConnection, string> = {
  not_sent: "LinkedIn: connection not sent",
  sent: "LinkedIn: connection sent",
};

export const LINKEDIN_TONES: Record<LinkedinConnection, PillTone> = {
  not_sent: "neutral",
  sent: "teal",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  terracotta: "Terracotta",
  sage: "Sage",
  amber: "Amber",
  slate: "Slate",
  plum: "Plum",
  teal: "Teal",
};
