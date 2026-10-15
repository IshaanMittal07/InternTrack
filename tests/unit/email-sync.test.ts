import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { gmailAppsScript } = await import("@/lib/email/apps-script");
const { decryptSecret, encryptSecret, parseKey } = await import("@/lib/email/crypto");
const { processEmails, syncMicrosoft } = await import("@/server/services/email-sync");

type Db = Parameters<typeof processEmails>[0];
type Call = { fn: string; args: Record<string, unknown> };

const ID_STRIPE = "11111111-1111-4111-8111-111111111111";
const ID_SHOPIFY = "22222222-2222-4222-8222-222222222222";

/**
 * A stand-in for Supabase that mimics the email_sync_* functions: it keeps
 * the postings and recorded emails in memory, re-checks the stage like the
 * SQL does, and treats a repeated message id as already recorded.
 */
function fakeDb(options: { connections?: Record<string, unknown>[]; failRecord?: boolean } = {}) {
  const calls: Call[] = [];
  const postings = [
    {
      id: ID_STRIPE,
      company: "Stripe",
      role_title: "Software Engineer Intern",
      date_applied: "2026-09-01",
      application_stage: "submitted",
    },
    {
      id: ID_SHOPIFY,
      company: "Shopify",
      role_title: null,
      date_applied: "2026-09-01",
      application_stage: "offer",
    },
  ];
  const recorded = new Set<string>();

  const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    switch (fn) {
      case "email_sync_applied":
        return { data: postings.map((p) => ({ ...p })), error: null };
      case "email_sync_connections":
        return { data: options.connections ?? [], error: null };
      case "email_sync_update_connection":
        return { data: null, error: null };
      case "email_sync_record": {
        if (options.failRecord) return { data: null, error: { message: "boom" } };
        const key = `${String(args.p_source)}:${String(args.p_message_id)}`;
        if (recorded.has(key)) return { data: null, error: null };
        recorded.add(key);
        let outcome = args.p_outcome as string;
        const posting = postings.find((p) => p.id === args.p_opportunity_id);
        if (
          outcome === "rejected" &&
          !["submitted", "online_assessment", "interviewing"].includes(
            posting?.application_stage ?? "",
          )
        ) {
          outcome = "skipped";
        }
        if (outcome === "rejected" && posting) posting.application_stage = "rejected";
        return { data: outcome, error: null };
      }
      default:
        throw new Error(`unexpected rpc ${fn}`);
    }
  };
  return { db: { rpc } as unknown as Db, calls, postings };
}

const rejection = (id: string, from: string, receivedAt = "2026-10-10T15:00:00Z") => ({
  id,
  from,
  subject: "Your application",
  body: "Unfortunately, we will not be moving forward with your application.",
  receivedAt,
});

describe("processEmails", () => {
  it("does not touch the database when nothing is a rejection", async () => {
    const { db, calls } = fakeDb();
    const summary = await processEmails(
      db,
      "k",
      "gmail",
      [{ ...rejection("1", "Stripe <a@stripe.com>"), body: "Thanks for applying!" }],
      "America/Toronto",
    );
    expect(summary).toEqual({ checked: 1, rejected: 0, needsReview: 0 });
    expect(calls).toEqual([]);
  });

  it("marks the matching application rejected, passing the sync key", async () => {
    const { db, calls, postings } = fakeDb();
    const summary = await processEmails(
      db,
      "key123",
      "gmail",
      [rejection("m1", "Stripe Recruiting <no-reply@stripe.com>")],
      "America/Toronto",
    );
    expect(summary.rejected).toBe(1);
    expect(postings[0]!.application_stage).toBe("rejected");
    const record = calls.find((c) => c.fn === "email_sync_record")!;
    expect(record.args).toMatchObject({
      p_token: "key123",
      p_source: "gmail",
      p_message_id: "m1",
      p_outcome: "rejected",
      p_opportunity_id: ID_STRIPE,
    });
  });

  it("acts for the signed-in user when there is no sync key", async () => {
    const { db, calls } = fakeDb();
    await processEmails(
      db,
      undefined,
      "microsoft",
      [rejection("m1", "Stripe <a@stripe.com>")],
      "UTC",
    );
    for (const call of calls) expect(call.args).not.toHaveProperty("p_token");
  });

  it("never applies the same email twice", async () => {
    const { db } = fakeDb();
    const email = rejection("m1", "Stripe <a@stripe.com>");
    const first = await processEmails(db, "k", "gmail", [email], "UTC");
    const again = await processEmails(db, "k", "gmail", [email], "UTC");
    expect(first.rejected).toBe(1);
    expect(again.rejected).toBe(0);
  });

  it("leaves offers alone and reports unknown companies for review", async () => {
    const { db, postings } = fakeDb();
    const summary = await processEmails(
      db,
      "k",
      "gmail",
      [rejection("m1", "Shopify <a@shopify.com>"), rejection("m2", "Acme <jobs@acme.com>")],
      "UTC",
    );
    expect(postings[1]!.application_stage).toBe("offer");
    expect(summary).toEqual({ checked: 2, rejected: 0, needsReview: 1 });
  });

  it("throws when an email can't be recorded, so the sender retries", async () => {
    const { db } = fakeDb({ failRecord: true });
    await expect(
      processEmails(db, "k", "gmail", [rejection("m1", "Stripe <a@stripe.com>")], "UTC"),
    ).rejects.toThrow(/record/);
  });

  it("dates the email in the app's time zone when comparing with the applied date", async () => {
    const { db, calls } = fakeDb();
    // 02:00 UTC on Sep 1 is still Aug 31 in Toronto: before the application.
    await processEmails(
      db,
      "k",
      "gmail",
      [rejection("m1", "Stripe <a@stripe.com>", "2026-09-01T02:00:00Z")],
      "America/Toronto",
    );
    expect(calls.find((c) => c.fn === "email_sync_record")!.args.p_outcome).toBe("skipped");
  });
});

describe("syncMicrosoft", () => {
  const key = randomBytes(32);
  const config = { clientId: "client", clientSecret: "secret", encryptionKey: key };

  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) =>
      handler(String(url), init),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("refreshes the sign-in, saves the new token, reads mail and records the sync", async () => {
    const { db, calls, postings } = fakeDb({
      connections: [
        {
          id: "c1",
          account_email: "me@uwaterloo.ca",
          refresh_token_enc: encryptSecret("old-refresh", key),
          last_synced_at: null,
        },
      ],
    });
    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/oauth2/v2.0/token")) {
        expect(String(init?.body)).toContain("refresh_token=old-refresh");
        return Response.json({ access_token: "at", refresh_token: "new-refresh" });
      }
      if (url.includes("/mailFolders/inbox/")) {
        return Response.json({
          value: [
            {
              id: "graph-1",
              internetMessageId: "<abc@stripe.com>",
              subject: "Your application to Stripe",
              receivedDateTime: "2026-10-10T15:00:00Z",
              from: { emailAddress: { name: "Stripe", address: "no-reply@stripe.com" } },
              body: { content: "We will not be moving forward with your application." },
            },
          ],
        });
      }
      return Response.json({ value: [] });
    });

    const results = await syncMicrosoft(db, "k", config, "UTC");

    expect(results).toEqual([
      {
        account: "me@uwaterloo.ca",
        ok: true,
        summary: { checked: 1, rejected: 1, needsReview: 0 },
      },
    ]);
    expect(postings[0]!.application_stage).toBe("rejected");
    const updates = calls.filter((c) => c.fn === "email_sync_update_connection");
    expect(decryptSecret(String(updates[0]!.args.p_refresh_token_enc), key)).toBe("new-refresh");
    expect(updates[1]!.args.p_synced_at).toEqual(expect.any(String));
    expect(calls.find((c) => c.fn === "email_sync_record")!.args.p_message_id).toBe(
      "<abc@stripe.com>",
    );
    // Graph calls ask for plain-text bodies.
    const graphCall = fetchMock.mock.calls.find(([u]) => String(u).includes("graph.microsoft.com"));
    expect((graphCall![1]!.headers as Record<string, string>).Prefer).toContain("text");
  });

  it("asks the user to reconnect when Microsoft refuses the saved sign-in", async () => {
    const { db, calls } = fakeDb({
      connections: [
        {
          id: "c1",
          account_email: "me@uwaterloo.ca",
          refresh_token_enc: encryptSecret("old", key),
          last_synced_at: null,
        },
      ],
    });
    stubFetch(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await syncMicrosoft(db, "k", config, "UTC");

    expect(results).toEqual([{ account: "me@uwaterloo.ca", ok: false }]);
    const update = calls.find((c) => c.fn === "email_sync_update_connection")!;
    expect(update.args.p_error).toMatch(/Connect this mailbox again/);
    expect(update.args).not.toHaveProperty("p_synced_at");
  });

  it("skips a mailbox checked in the last few minutes unless forced", async () => {
    const { db } = fakeDb({
      connections: [
        {
          id: "c1",
          account_email: "me@uwaterloo.ca",
          refresh_token_enc: encryptSecret("old", key),
          last_synced_at: new Date().toISOString(),
        },
      ],
    });
    const fetchMock = stubFetch(() => Response.json({ value: [] }));
    expect(await syncMicrosoft(db, "k", config, "UTC")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("token encryption", () => {
  const key = randomBytes(32);

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("refresh-token", key);
    const b = encryptSecret("refresh-token", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe("refresh-token");
  });

  it("refuses a tampered value or the wrong key", () => {
    const sealed = encryptSecret("refresh-token", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(sealed, randomBytes(32))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseKey(key.toString("base64"))).toEqual(key);
  });
});

describe("gmailAppsScript", () => {
  const KEY = "a".repeat(64);
  const NOW = Date.parse("2026-10-15T12:00:00Z");

  /** Runs the generated script against fake Google services. */
  function runScript({
    messages,
    lastSync,
    status = 200,
    props = new Map<string, string>(lastSync ? [["lastSync", String(lastSync)]] : []),
  }: {
    messages: { from: string; date: string; draft?: boolean }[];
    lastSync?: number;
    status?: number;
    props?: Map<string, string>;
  }) {
    const sent: { url: string; options: { headers: Record<string, string>; payload: string } }[] =
      [];
    const fakeMessages = messages.map((m, i) => ({
      getId: () => `id${i}`,
      getFrom: () => m.from,
      getSubject: () => `subject ${i}`,
      getPlainBody: () => "body",
      getDate: () => new Date(m.date),
      isDraft: () => m.draft ?? false,
    }));
    const globals = {
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k: string) => props.get(k) ?? null,
          setProperty: (k: string, v: string) => props.set(k, v),
        }),
      },
      Session: { getActiveUser: () => ({ getEmail: () => "me@gmail.com" }) },
      GmailApp: {
        getAliases: () => ["alias@gmail.com"],
        search: (_q: string, start: number) =>
          start === 0 ? [{ getMessages: () => fakeMessages }] : [],
      },
      UrlFetchApp: {
        fetch: (url: string, options: (typeof sent)[number]["options"]) => {
          sent.push({ url, options });
          return { getResponseCode: () => status, getContentText: () => "error" };
        },
      },
      ScriptApp: {},
    };
    const script = gmailAppsScript({ origin: "https://app.example", key: KEY });
    const { syncInbox } = new Function(...Object.keys(globals), `${script}\nreturn { syncInbox };`)(
      ...Object.values(globals),
    ) as { syncInbox: () => void };
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    try {
      syncInbox();
    } finally {
      vi.useRealTimers();
    }
    const batches = sent.map((s) => JSON.parse(s.options.payload).messages as { id: string }[]);
    return { sent, batches, props };
  }

  it("embeds the endpoint and key as safe string literals", () => {
    const script = gmailAppsScript({ origin: "https://app.example", key: KEY });
    expect(script).toContain('const ENDPOINT = "https://app.example/api/email/sync";');
    expect(script).toContain(`const SYNC_KEY = "${KEY}";`);
  });

  it("sends new mail with the key, skipping the user's own and older messages", () => {
    const { sent, batches, props } = runScript({
      lastSync: NOW - 10 * 60 * 1000,
      messages: [
        { from: "Stripe <no-reply@stripe.com>", date: "2026-10-15T11:55:00Z" },
        { from: "Me <ME@gmail.com>", date: "2026-10-15T11:56:00Z" },
        { from: "alias@gmail.com", date: "2026-10-15T11:57:00Z" },
        { from: "Old <old@x.com>", date: "2026-10-14T09:00:00Z" },
        { from: "Draft <d@x.com>", date: "2026-10-15T11:58:00Z", draft: true },
      ],
    });
    expect(sent[0]!.url).toBe("https://app.example/api/email/sync");
    expect(sent[0]!.options.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(batches).toEqual([[expect.objectContaining({ id: "id0" })]]);
    expect(props.get("lastSync")).toBe(String(NOW));
  });

  it("sends in batches of 25, and once even with no new mail", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      from: "x@y.com",
      date: new Date(NOW - (i + 1) * 1000).toISOString(),
    }));
    expect(runScript({ messages: many }).batches.map((b) => b.length)).toEqual([25, 5]);
    expect(runScript({ messages: [] }).batches).toEqual([[]]);
  });

  it("keeps its place when the tracker refuses a batch, so it is sent again", () => {
    const props = new Map<string, string>();
    expect(() =>
      runScript({
        messages: [{ from: "x@y.com", date: "2026-10-15T11:00:00Z" }],
        status: 503,
        props,
      }),
    ).toThrow(/503/);
    expect(props.get("lastSync")).toBeUndefined();
  });
});
