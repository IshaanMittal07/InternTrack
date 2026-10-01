import { describe, expect, it } from "vitest";

import {
  EXPORT_HEADERS,
  buildExportRows,
  escapeCsvCell,
  neutralizeFormula,
  toCsv,
} from "@/lib/csv";

import { makeContact, makeOpportunity } from "./fixtures";

describe("formula injection", () => {
  it.each(["=SUM(A1:A2)", "+1+1", "-2+3", "@cmd", "\t=1", "\r=1", '=HYPERLINK("http://x")'])(
    "neutralizes %j",
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  it("leaves ordinary values alone", () => {
    for (const value of ["Acme", "", "3M", "a=b", "C++ intern", "e-mail"]) {
      expect(neutralizeFormula(value)).toBe(value);
    }
  });
});

describe("escapeCsvCell", () => {
  it("quotes values with commas, quotes or newlines", () => {
    expect(escapeCsvCell("Smith, Jane")).toBe('"Smith, Jane"');
    expect(escapeCsvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralizes formulas before quoting", () => {
    expect(escapeCsvCell("=1,2")).toBe(`"'=1,2"`);
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it("renders empty values as empty cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(3)).toBe("3");
  });
});

describe("toCsv", () => {
  it("joins with commas and CRLF line endings", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c, d", "-e"],
      ]),
    ).toBe(`a,b\r\n"c, d",'-e\r\n`);
  });
});

describe("buildExportRows", () => {
  const tags = [
    { id: "t1", name: "Cybersecurity" },
    { id: "t2", name: "AI/ML" },
  ];
  const referrer = makeContact({ name: "Jane Doe", title: "Recruiter", has_spoken: true });
  const rows = buildExportRows(
    [
      makeOpportunity({
        company: "=Evil Corp",
        role_title: "Intern",
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "online_assessment",
        referral_status: "received",
        referred_by_contact_id: referrer.id,
        priority: "high",
        tagIds: ["t1", "t2"],
        contacts: [referrer, makeContact({ name: "Sam Lee", email: "sam@x.com" })],
      }),
    ],
    tags,
  );

  it("starts with the header row", () => {
    expect(rows[0]).toEqual([...EXPORT_HEADERS]);
  });

  it("writes one row per opportunity with tags and a contact summary", () => {
    const row = Object.fromEntries(EXPORT_HEADERS.map((h, i) => [h, rows[1]![i]]));
    expect(row).toMatchObject({
      Category: "Applied",
      Company: "=Evil Corp",
      Stage: "Online assessment",
      Priority: "High",
      "Referral status": "received",
      "Referred by": "Jane Doe",
      Tags: "Cybersecurity, AI/ML",
      Contacts: "Jane Doe (Recruiter) - spoken; Sam Lee (sam@x.com) - not yet",
      "Contacts spoken to": "1/2",
    });
  });

  it("produces a CSV where the dangerous company name is neutralized", () => {
    expect(toCsv(rows)).toContain("'=Evil Corp");
  });
});
