# Juhudi Kilimo — Architecture & Deployment Review

*Last updated: 2026-02-28*

---

## 1. Codebase Overview

| Area | Files | LOC |
|------|-------|-----|
| Backend (TypeScript / Express) | 14 controllers, 6 services, 17 routes | ~8,400 |
| Frontend (React / Vite / Tailwind) | 35 pages, 21 components | ~19,300 |
| Prisma schema | 30+ models | 47 KB |
| Seed data | 5 seed scripts | — |

---

## 2. Frontend ↔ Backend Alignment

**Status: Complete.** All ~85 frontend API calls have matching backend routes. No orphaned endpoints, no missing implementations.

**Bug fixed (2026-02-28):** `nginx.conf` Permissions-Policy header was blocking
`geolocation`, `camera`, and `microphone`. Fixed to `(self)` to allow the PWA itself
to use GPS pings and camera capture.

---

## 3. Architecture Evaluation

### Strengths

| Area | Assessment |
|------|-----------|
| Data model | Comprehensive — full MFI lifecycle, 30+ Prisma models |
| Security | AES-256-GCM field encryption, JWT, Helmet CSP, RBAC, audit trail, rate limiting |
| API structure | Clean REST, consistent hierarchy, async error handling |
| Type safety | TypeScript end-to-end; Zod config validation; express-validator on inputs |
| Compliance | KDPA 2019 consent, CBK KYC/AML fields, CRB status, PEP flag |
| Containerisation | Multi-stage Dockerfiles, dumb-init, Postgres healthcheck |
| Offline support | Dexie IndexedDB + offlineSync for field LOs |
| Frontend state | React Query (server) + Zustand (auth) — appropriate split |

### Known Concerns

1. **Local file storage** — KYC docs and M-Pesa PDFs go to `/app/uploads` (container disk).
   Won't persist on ECS Fargate or survive container replacement. Must move to S3.

2. **No backend health endpoint** — No `GET /api/health` for ALB health probes.

3. **Migrations not run at startup** — Dockerfile starts server directly; `prisma migrate deploy`
   must precede it in an entrypoint script.

4. **No JWT refresh endpoint** — `POST /auth/refresh` is absent. Field officers are silently
   logged out every 8 hours with no silent-refresh path.

5. **Postgres port 5432 exposed to host** in `docker-compose.yml` — Remove for production.

6. **`ANTHROPIC_API_KEY` not in `.env.example`** — M-Pesa AI analysis will silently fail
   without it. Add to docs.

7. **No structured CloudWatch log shipping** for production (stdout only today).

---

## 4. Recommended AWS Architecture

```
Users (browser / PWA)
        │
        ▼
┌─────────────────┐
│   CloudFront    │  CDN, HTTPS, 1-year cache for hashed assets
│   + ACM cert    │
└────────┬────────┘
         │ /api/* → origin
         ▼
┌─────────────────┐
│  ALB (HTTPS)    │  TLS termination, health checks, WAF attachment
└────────┬────────┘
         ▼
┌─────────────────┐
│  ECS Fargate    │  Backend Node.js container (stateless, auto-scaling 1–3 tasks)
└────┬────────────┘
     │          │
     ▼          ▼
┌─────────┐ ┌─────────────┐
│  RDS    │ │  S3 bucket  │  KYC docs, M-Pesa PDFs (replace local /uploads)
│ PG 15   │ └─────────────┘
│ Multi-AZ│
└─────────┘
     │
     ▼
┌─────────────────┐
│ Secrets Manager │  JWT_SECRET, ENCRYPTION_KEY, DB_PASSWORD, ANTHROPIC_API_KEY
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   CloudWatch    │  Container logs, metrics, alarms
└─────────────────┘
```

### Service Choices

| Service | Purpose |
|---------|---------|
| CloudFront + S3 | SPA static bundle — immutable asset caching, edge delivery |
| ALB | HTTPS termination, path routing `/api/*`, health checks |
| ECS Fargate | Backend — no EC2 to patch, scales to zero |
| RDS PostgreSQL 15 | Managed DB — automated backups, Multi-AZ standby, PITR |
| S3 (uploads) | Replace `/app/uploads` — durable, versioned, no container dependency |
| Secrets Manager | Rotatable secrets — no plaintext in env files |
| ACM | Free TLS cert, auto-renews, ALB/CloudFront integrated |
| CloudWatch | Log shipping (`awslogs` ECS driver), custom metrics, alarms |
| WAF (optional) | DDoS/bot protection on ALB — important for a financial app |
| VPC | RDS and ECS in private subnets; only ALB in public subnet |

**Recommended region:** `af-south-1` (Cape Town) — closest to Kenya, within Africa for CBK/KDPA data residency.

---

## 5. Pre-Deployment Checklist

### Critical (blockers)

- [ ] **S3 file storage** — Replace `multer` disk storage in `documents.ts` and
  `mpesaController.ts` with `@aws-sdk/client-s3`. Store S3 key instead of local path.

- [ ] **Health check endpoint** — Add `GET /api/health` returning `{ status: "ok", db: "ok" }`
  with a Prisma ping. ALB won't route traffic without it.
  ```typescript
  // In routes/index.ts (before authenticate middleware)
  router.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  ```

- [ ] **Migration at startup** — Add `entrypoint.sh`:
  ```sh
  #!/bin/sh
  set -e
  npx prisma migrate deploy
  exec node dist/server.js
  ```
  Update Dockerfile `CMD` to use this script.

- [ ] **JWT refresh endpoint** — Add `POST /auth/refresh` accepting HTTP-only refresh cookie
  and returning a new access token.

- [ ] **`ANTHROPIC_API_KEY` in `.env.example`** — Document this required variable.

### Important (should fix)

- [ ] **CORS** — Set `FRONTEND_URL` and `CORS_ORIGINS` to the real production domain.

- [ ] **Remove Postgres port exposure** — Remove `5432:5432` from docker-compose for prod
  (or use a separate `docker-compose.prod.yml`). RDS is in a private VPC subnet on AWS.

- [ ] **CloudWatch log shipping** — Use the ECS `awslogs` log driver to forward stdout/stderr
  to CloudWatch Logs.

- [ ] **DB connection pooling** — With multiple ECS tasks, add PgBouncer or configure
  Prisma's `connection_limit` to avoid exhausting RDS max connections.

- [ ] **Input validation gaps** — Review `ilpController`, `collectionsController`, and
  `groupController` for missing `express-validator` rules.

### Nice to Have

- [ ] **PWA manifest** — Add proper `manifest.webmanifest` with app icons and service worker
  cache strategy for offline field use.

- [ ] **Self-service password reset** — `POST /admin/users/:id/reset-password` is admin-only.
  Field officers need an email OTP or SMS self-service path.

- [ ] **Audit log archival** — Schedule a job to archive `audit_logs` older than 90 days to
  S3/Glacier to keep the table performant.

- [ ] **RDS PITR test** — Enable automated backups and run a point-in-time restore test before
  going live.

---

## 6. Role & Permission Model

### Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full access, cross-branch, user/branch management, ILP eligibility grants |
| `BRANCH_MANAGER` | Branch-scoped oversight, BCC decisions, approve/disburse loans |
| `SUPERVISOR` | Branch-scoped, review/approve/disburse loans, resolve quality flags |
| `LOAN_OFFICER` | Own-customer operations: onboard, interview, apply, follow up |

### What Each Role Can Do

| Action | LO | SUP | BM | ADMIN |
|--------|----|-----|----|-------|
| Onboard customers | ✅ | ✅ | ✅ | ✅ |
| Verify KYC status | ❌ | ✅ | ✅ | ✅ |
| Run credit score | ✅ | ✅ | ✅ | ✅ |
| Submit loan application | ✅ | ✅ | ✅ | ✅ |
| Review / approve loan | ❌ | ✅ | ✅ | ✅ |
| Disburse loan | ❌ | ✅ | ✅ | ✅ |
| Vote in BCC | ✅ | ✅ | ✅ | ✅ |
| Open BCC session | ❌ | ❌ | ✅ | ✅ |
| Decide BCC outcome | ❌ | ❌ | ✅ | ✅ |
| View data quality | ❌ | ✅ | ✅ | ✅ |
| View activity log | ❌ | ❌ | ✅ | ✅ |
| View LO locations | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Manage branches | ❌ | ❌ | ❌ | ✅ |
| Grant ILP eligibility | ❌ | ❌ | ❌ | ✅ |
| M-Pesa AI monitor | ❌ | ❌ | ❌ | ✅ |

### Data Scoping

- **LOAN_OFFICER** — sees only customers in their own branch (`branchId` filter)
- **BRANCH_MANAGER / SUPERVISOR** — sees entire branch
- **ADMIN** — no branch filter; sees all branches

---

## 7. Security Posture

| Control | Status |
|---------|--------|
| KDPA 2019 consent | ✅ |
| CBK AML/CFT (PEP, AML workflow) | ✅ |
| CBK KYC (National ID, photo, NOK) | ✅ |
| PII field encryption (AES-256-GCM) | ✅ |
| Transport (HTTPS/HSTS via nginx) | ✅ |
| JWT auth (HS256, 8h expiry) | ✅ |
| Bcrypt-12 password hashing | ✅ |
| Rate limiting (100 req/15 min) | ✅ |
| Security headers (Helmet) | ✅ |
| Audit trail (all CRUD) | ✅ |
| RBAC (4 roles, route-level) | ✅ |
| Refresh token / session renewal | ❌ Missing |
| Self-service password reset | ❌ Admin-only today |
