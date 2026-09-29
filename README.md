# Study Club LMS — Engineering Specification

This directory contains the final product/design specification for the Study Club LMS.

## Files

| File              | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `AGENTS.md`       | master instructions for developers/AI agents |
| `architecture.md` | system architecture and service boundaries   |
| `prd.md`          | product requirements                         |
| `ui_ux_brief.md`  | UI/UX and design-system brief                |
| `database.md`     | database/ERD-equivalent specification        |
| `rbac.md`         | multi-role/scoped RBAC                       |
| `security.md`     | security and privacy requirements            |
| `api.md`          | API contracts                                |
| `deployment.md`   | environment/deployment/operations            |
| `testing.md`      | testing strategy                             |
| `tasks.md`        | phased implementation tasks                  |
| `contributing.md` | coding/development workflow                  |

## Final stack

```text
Next.js 16.3.6
Bun (latest, dev/install) + Node 24 (prod runtime)
Vercel
Supabase (latest managed platform)
PostgreSQL
Supabase Auth
Supabase Realtime
Supabase Storage
Prisma ORM 8 RC line
shadcn/ui (Mira / Zinc / Indigo)
next-themes (class)
JetBrains Mono
Sender
```

## Scope

This is an LMS + Study Club Management system.

There is no AI/ML service in this architecture.

## Important version note

As of the specification date (28 September 2026), Prisma ORM 8 is a release-candidate line. Keep the exact resolved Prisma packages in the lockfile and re-check the official Prisma documentation before every RC upgrade. Supabase is a managed platform rather than one package with a single platform version; use the latest available project capabilities and pin CLI/application packages in the repository.
