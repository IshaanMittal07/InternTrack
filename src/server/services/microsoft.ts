import "server-only";

import type { MicrosoftConfig } from "@/lib/email/config";

import type { IncomingEmail } from "./email-sync";

/**
 * Microsoft identity platform + Graph, for reading a work or school
 * (e.g. university) Outlook mailbox. Read-only: the app asks for Mail.Read.
 */

const AUTHORITY = "https://login.microsoftonline.com/organizations/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = "offline_access User.Read Mail.Read";
const TIMEOUT_MS = 15_000;
/** Folders that are checked. Junk is included: rejections sometimes land there. */
const FOLDERS = ["inbox", "junkemail"] as const;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/** The saved sign-in no longer works; the user has to connect the mailbox again. */
export class MicrosoftReconnectError extends Error {}

type TokenResponse = { access_token: string; refresh_token?: string };

export function authorizeUrl(
  config: MicrosoftConfig,
  {
    redirectUri,
    state,
    codeChallenge,
  }: { redirectUri: string; state: string; codeChallenge: string },
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORITY}/authorize?${params}`;
}

async function requestToken(
  config: MicrosoftConfig,
  grant: Record<string, string>,
): Promise<TokenResponse> {
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: SCOPES,
      ...grant,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    const detail = `${data.error ?? response.status}: ${data.error_description?.split("\r\n")[0] ?? ""}`;
    if (data.error === "invalid_grant" || data.error === "interaction_required") {
      throw new MicrosoftReconnectError(detail);
    }
    throw new Error(`Microsoft sign-in failed (${detail})`);
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

export function exchangeCode(
  config: MicrosoftConfig,
  { code, redirectUri, codeVerifier }: { code: string; redirectUri: string; codeVerifier: string },
) {
  return requestToken(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

/** Microsoft may hand back a new refresh token; it must replace the old one. */
export function refreshAccessToken(config: MicrosoftConfig, refreshToken: string) {
  return requestToken(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

async function graph<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url.startsWith("https://") ? url : `${GRAPH}${url}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (response.status === 401) throw new MicrosoftReconnectError("Graph returned 401");
  if (!response.ok) throw new Error(`Microsoft Graph request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function getAccountEmail(accessToken: string): Promise<string> {
  const me = await graph<{ mail?: string | null; userPrincipalName?: string | null }>(
    accessToken,
    "/me?$select=mail,userPrincipalName",
  );
  const email = me.mail || me.userPrincipalName;
  if (!email) throw new Error("Microsoft account has no email address");
  return email.toLowerCase();
}

type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  subject?: string | null;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string | null; address?: string | null } } | null;
  body?: { content?: string | null } | null;
};

/** Messages received at or after `since` in the inbox and junk folders, oldest first. */
export async function listMessagesSince(
  accessToken: string,
  since: Date,
): Promise<IncomingEmail[]> {
  const out: IncomingEmail[] = [];
  const select = "id,internetMessageId,subject,receivedDateTime,from,body";
  const filter = encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`);

  for (const folder of FOLDERS) {
    let url: string | undefined =
      `/me/mailFolders/${folder}/messages?$filter=${filter}&$orderby=receivedDateTime asc` +
      `&$select=${select}&$top=${PAGE_SIZE}`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const data: { value: GraphMessage[]; "@odata.nextLink"?: string } = await graph(
        accessToken,
        url,
      );
      for (const m of data.value) {
        const name = m.from?.emailAddress?.name ?? "";
        const address = m.from?.emailAddress?.address ?? "";
        out.push({
          // The Graph id changes when a message is moved between folders;
          // the Internet Message-ID does not.
          id: (m.internetMessageId || m.id).slice(0, 500),
          from: address ? `${name} <${address}>` : name,
          subject: m.subject ?? "",
          body: m.body?.content ?? "",
          receivedAt: m.receivedDateTime,
        });
      }
      url = data["@odata.nextLink"];
    }
  }
  return out.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}
