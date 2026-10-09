import { config } from "dotenv";

import { OWNER, ensureUser } from "../integration/helpers";

/** Makes sure the owner account exists and starts empty. */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  await ensureUser(OWNER);
}
