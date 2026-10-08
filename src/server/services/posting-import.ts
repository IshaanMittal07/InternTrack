import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

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

export async function fetchPostingHtml(source: string): Promise<string> {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.username || url.password) {
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

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  const pinnedAddress = addresses[0];
  if (!pinnedAddress || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("This posting link is not publicly reachable.");
  }

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { Accept: "text/html,application/xhtml+xml" },
        lookup: (_hostname, _options, callback) =>
          callback(null, pinnedAddress.address, pinnedAddress.family),
      },
      (response) => {
        if (response.statusCode !== 200) {
          request.destroy();
          reject(new Error("The posting site did not return a readable page."));
          return;
        }
        const contentType = response.headers["content-type"] ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
          request.destroy();
          reject(new Error("The link did not return an HTML posting."));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1_000_000) {
            request.destroy(new Error("The posting page is too large to read."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    request.setTimeout(8_000, () =>
      request.destroy(new Error("The posting site took too long to respond.")),
    );
    request.on("error", reject);
  });
}