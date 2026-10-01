-- Local development only. The production allowlist is set by hand (see DEPLOYMENT.md).
-- `npm run local:setup` also adds your ALLOWED_EMAIL from .env.local.
insert into private.allowed_emails (email)
values ('owner@test.local'), ('other@test.local')
on conflict do nothing;
