import { describe, expect, it } from "vitest";

import { contactLabel } from "@/lib/domain/contact-label";

describe("contactLabel", () => {
  it("prefers the name, then title, then email", () => {
    expect(contactLabel({ name: "Jane", title: "Recruiter", email: "j@x.com" })).toBe("Jane");
    expect(contactLabel({ name: null, title: "Recruiter", email: "j@x.com" })).toBe("Recruiter");
    expect(contactLabel({ name: null, title: null, email: "j@x.com" })).toBe("j@x.com");
  });

  it("falls back when nothing identifies the contact", () => {
    expect(contactLabel({ name: null, title: null, email: null })).toBe("Unnamed contact");
  });
});
