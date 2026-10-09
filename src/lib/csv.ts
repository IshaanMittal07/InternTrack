import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  REFERRAL_LABELS,
  STAGE_LABELS,
} from "@/lib/domain/constants";
import type { OpportunityWithRelations, Tag } from "@/lib/domain/types";

/**
 * Characters that make spreadsheet apps treat a cell as a formula. A value
 * like `=HYPERLINK(...)` in a company name could otherwise run when the CSV
 * is opened, so such values are prefixed with a single quote.
 */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function neutralizeFormula(value: string): string {
  return value.length > 0 && FORMULA_TRIGGERS.has(value[0]!) ? `'${value}` : value;
}

/** One CSV cell: formula-neutralized, then quoted if needed (RFC 4180). */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = neutralizeFormula(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

export const EXPORT_HEADERS = [
  "Category",
  "Company",
  "Role",
  "Posting URL",
  "Location",
  "Term",
  "Deadline",
  "Date applied",
  "Stage",
  "Priority",
  "Referral status",
  "Referred by",
  "Tags",
  "Contacts",
  "Contacts spoken to",
  "Posting notes",
  "Notes",
  "Created",
  "Updated",
] as const;

/** One row per opportunity, tags comma-separated, contacts summarized. */
export function buildExportRows(
  opportunities: OpportunityWithRelations[],
  tags: Pick<Tag, "id" | "name">[],
): string[][] {
  const tagNames = new Map(tags.map((t) => [t.id, t.name]));

  const rows = opportunities.map((o) => {
    const referrer = o.contacts.find((c) => c.id === o.referred_by_contact_id);
    const contacts = o.contacts
      .map((c) => {
        const details = [c.title, c.email].filter(Boolean).join(", ");
        return `${c.name ?? "Unnamed contact"}${details ? ` (${details})` : ""} - ${c.has_spoken ? "spoken" : "not yet"}`;
      })
      .join("; ");

    return [
      CATEGORY_LABELS[o.category],
      o.company,
      o.role_title ?? "",
      o.posting_url ?? "",
      o.location ?? "",
      o.term ?? "",
      o.deadline ?? "",
      o.date_applied ?? "",
      o.application_stage ? STAGE_LABELS[o.application_stage] : "",
      PRIORITY_LABELS[o.priority].replace(" priority", ""),
      REFERRAL_LABELS[o.referral_status].replace("Referral ", ""),
      referrer?.name ?? "",
      o.tagIds
        .map((id) => tagNames.get(id))
        .filter(Boolean)
        .join(", "),
      contacts,
      `${o.contacts.filter((c) => c.has_spoken).length}/${o.contacts.length}`,
      o.posting_notes ?? "",
      o.notes ?? "",
      o.created_at.slice(0, 10),
      o.updated_at.slice(0, 10),
    ];
  });

  return [[...EXPORT_HEADERS], ...rows];
}
