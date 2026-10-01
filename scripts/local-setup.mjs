// Local development only: creates the ALLOWED_EMAIL account in the LOCAL
// Supabase stack and adds it to the database allowlist, so you can sign in at
// http://localhost:3000 (the magic link arrives in Mailpit at :54324).
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

if (!url || !serviceKey || !dbUrl || !email) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL or ALLOWED_EMAIL in .env.local",
  );
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to run against a non-local Supabase URL: ${url}`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;

if (data.users.some((u) => u.email === email)) {
  console.log(`User ${email} already exists.`);
} else {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError) throw createError;
  console.log(`Created user ${email}.`);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query(
  "insert into private.allowed_emails (email) values ($1) on conflict do nothing",
  [email],
);
await client.end();
console.log(`Allowlisted ${email}. Start the app with: npm run dev`);
