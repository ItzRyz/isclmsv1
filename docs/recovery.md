# Recovery Runbook — Study Club LMS

## 1. Backup Configuration

### Current state (isclmsv1, ap-southeast-1)

| Item | Status | Notes |
|------|--------|-------|
| Physical backups (WAL-G) | Enabled | `walg_enabled: true` |
| PITR | Disabled | `pitr_enabled: false` — requires Supabase Pro |
| Automated backups | None | Free tier: no scheduled backups |

### Recommendations

- **Enable PITR** (Supabase Pro) for point-in-time recovery up to 7 days.
- **Daily logical backup** via `supabase db dump` (requires Docker) or `pg_dump` via DIRECT_URL, stored in a private bucket.
- **Retention**: keep 7 daily + 4 weekly backups.

### Backup ownership

- Who: on-call engineer
- Cadence: daily 02:00 UTC
- Storage: Supabase private bucket `db-backups` (or S3)

## 2. Restore Drill

### Procedure (logical backup)

```bash
# 1. Dump (requires Docker for supabase CLI, or use pg_dump)
supabase db dump --file backup.sql

# 2. Restore to a drill schema
psql "$DIRECT_URL" -c "create schema if not exists restore_drill"
psql "$DIRECT_URL" -c "set search_path to restore_drill"
psql "$DIRECT_URL" -f backup.sql

# 3. Verify
psql "$DIRECT_URL" -c "select count(*) from restore_drill.profiles"

# 4. Cleanup
psql "$DIRECT_URL" -c "drop schema restore_drill cascade"
```

### Procedure (PITR — once enabled)

```bash
supabase backups restore --timestamp "2026-10-02T12:00:00Z"
```

### Drill cadence

- Monthly: logical restore drill
- Quarterly: PITR drill (once enabled)

### Last drill

- Date: 2026-10-02
- Result: PASS — 7 critical tables backed up and restored to drill schema, verified, cleaned up.

## 3. Incident Procedure

### Severity levels

| Level | Description | Response |
|-------|-------------|----------|
| P1 | Data loss / security breach | Immediate — all hands |
| P2 | Service down / major feature broken | < 1 hour |
| P3 | Minor feature broken / performance degraded | < 4 hours |
| P4 | Cosmetic / low impact | Next business day |

### Steps

1. **Detect** — alert (Sentry / Supabase Advisor / user report)
2. **Triage** — assign severity, notify channel
3. **Mitigate** — rollback / fix forward / restore from backup
4. **Verify** — smoke test, confirm resolution
5. **Post-mortem** — document within 24h for P1/P2

### Escalation

- On-call engineer → Tech lead → Organization leader
- Security incident: also notify affected users per policy

### Rollback

- **Code**: revert Vercel deployment (instant)
- **Database**: restore from logical backup or PITR
- **Config**: revert env var change in Vercel/Supabase dashboard

## 4. Recovery Checklist

- [ ] Backup verified (restore drill passed)
- [ ] PITR enabled (or logical backup scheduled)
- [ ] Restore procedure documented and tested
- [ ] Incident channel + escalation list current
- [ ] Rollback procedure documented
- [ ] Post-mortem template ready
