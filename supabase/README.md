# Waste-Wise Supabase foundation

This directory version-controls the database and authorization baseline for the unified Waste-Wise application.

## Apply the baseline

1. Create a Supabase project for the appropriate municipality/agency environment.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and enter only the public project URL and publishable key.
3. Apply `migrations/20260902000000_foundation.sql` through the Supabase CLI (`supabase db push`) or the Supabase Dashboard SQL editor. Docker and the Supabase CLI are not available in this development sandbox, so the migration has not been executed locally here.
4. Provision a tenant, then create the corresponding `auth.users`, `profiles`, and `user_roles` records from a trusted admin/server workflow. Do not expose a service-role key to the browser.
5. In **Auth → Hooks**, enable `public.custom_access_token_hook` only after controlled profile provisioning is working. It injects the tenant ID and default role into verified access-token claims. RLS does not rely on the hook, but it gives server/UI code a consistent role hint.
6. Test every policy with separate driver, dispatcher, admin, cross-tenant, and unauthenticated identities before loading operational data.

## Security notes

- Every operational record carries a tenant ID; RLS and same-tenant reference triggers provide defense in depth.
- Device telemetry has no authenticated browser `INSERT` policy. A trusted HTTPS/MQTT ingestion service must validate device credentials and write server-side.
- Driver collection, hazard, and SOS requests require server-side validation of assignment, shift state, GPS accuracy, idempotency, and audit logging before production use.
- Before production volume, configure retention/partitioning for telemetry and policy-driven evidence/GPS retention in accordance with the approved privacy design.

## Next migrations

The next migrations should add controlled provisioning RPCs, audit logs, route publication transactions, telemetry alert rules, notification tables, and retention jobs. Keep each change additive and versioned.
