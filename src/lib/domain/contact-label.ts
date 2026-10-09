import type { Contact } from "./types";

/** A display name for a contact, which may have no name. */
export function contactLabel(contact: Pick<Contact, "name" | "title" | "email">): string {
  return contact.name ?? contact.title ?? contact.email ?? "Unnamed contact";
}
