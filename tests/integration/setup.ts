import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env.local", quiet: true });

// Server modules import "server-only", which throws outside a React Server
// environment. Tests run server code directly, so stub it out.
vi.mock("server-only", () => ({}));
