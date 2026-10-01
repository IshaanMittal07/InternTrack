import { config } from "dotenv";

import { OWNER, allowEmail, ensureUser } from "../integration/helpers";

/** Makes sure the owner account exists, is allowlisted, and starts empty. */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  if (process.env.ALLOWED_EMAIL?.trim().toLowerCase() !== OWNER) {
    throw new Error(`E2E tests expect ALLOWED_EMAIL=${OWNER} in .env.local`);
  }
  await allowEmail(OWNER, true);
  await ensureUser(OWNER);
}
