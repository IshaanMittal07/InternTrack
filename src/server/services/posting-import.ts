import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

import {
  greenhouseApiUrl,
  parseGreenhouseJob,
  parsePostingHtml,
  type PostingDetails,
} from "@/lib/domain/posting";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_000_000;
// Many job sites (LinkedIn, Workday, ...) refuse or strip pages for clients
// that don't look like a browser.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
    const [a, b, c] = octets as [number, number, number, number];
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return version === 6 && /^[23]/i.test(address);
}

/** Rejects anything that isn't a public HTTPS URL on the default port. */
function assertSafeUrl(url: URL) {
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password
  ) {
    throw new Error("Use a public HTTPS posting link.");
  }
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".internal")
  ) {
    throw new Error("This posting link is not publicly reachable.");
  }
}

type Response = { status: number; location?: string; contentType: string; body: string };

/**
 * One GET request, pinned to an address that was checked to be public, so a
 * DNS answer can't change between the check and the connection.
 */
async function getOnce(url: URL, accept: string): Promise<Response> {
  assertSafeUrl(url);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  const pinnedAddress = addresses[0];
  if (!pinnedAddress || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("This posting link is not publicly reachable.");
  }

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { Accept: accept, "Accept-Language": "en-US,en;q=0.9", "User-Agent": USER_AGENT },
        // Node 20+ asks for every address (`all: true`) to race IPv4/IPv6, and
        // then expects an array; answering with a single address throws
        // "Invalid IP address: undefined".
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, [pinnedAddress])
            : callback(null, pinnedAddress.address, pinnedAddress.family),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = response.headers["content-type"] ?? "";
        if (status !== 200) {
          request.destroy();
          resolve({ status, location: response.headers.location, contentType, body: "" });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy(new Error("The posting page is too large to read."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    request.setTimeout(8_000, () =>
      request.destroy(new Error("The posting site took too long to respond.")),
    );
    request.on("error", reject);
  });
}

/** GET that follows redirects, re-checking every hop. Resolves with a 200 response. */
async function get(source: string, accept: string): Promise<Response> {
  let url = new URL(source);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await getOnce(url, accept);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, url);
      continue;
    }
    if (response.status !== 200) {
      throw new Error("The posting site did not return a readable page.");
    }
    return response;
  }
  throw new Error("The posting link redirects too many times.");
}

export async function fetchPostingHtml(source: string): Promise<string> {
  const response = await get(source, "text/html,application/xhtml+xml");
  if (
    !response.contentType.includes("text/html") &&
    !response.contentType.includes("application/xhtml+xml")
  ) {
    throw new Error("The link did not return an HTML posting.");
  }
  return response.body;
}

/**
 * Reads a posting's details. Greenhouse pages carry little metadata, so
 * their public job API is used instead; everything else is read from HTML.
 */
export async function fetchPostingDetails(source: string): Promise<PostingDetails> {
  const apiUrl = greenhouseApiUrl(source);
  if (apiUrl) {
    try {
      const response = await get(apiUrl, "application/json");
      return parseGreenhouseJob(JSON.parse(response.body));
    } catch {
      // Fall back to reading the page itself.
    }
  }
  return parsePostingHtml(await fetchPostingHtml(source));
}
