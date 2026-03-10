# Juhudi Kilimo – Microfinance Onboarding & Loan Management Portal

Agricultural microfinance web application for onboarding Yara Kenya customers to Juhudi Kilimo loans. Built for loan officers working in the field.

---

## Architecture

```
┌─────────────────────┐     HTTPS/TLS      ┌──────────────────────────┐
│  React Frontend     │ ──────────────────► │  Express.js API          │
│  (Vite + Tailwind)  │ ◄────────────────── │  (Node.js + TypeScript)  │
└─────────────────────┘   JWT Bearer token  └────────────┬─────────────┘
                                                         │ Prisma ORM
                                                         ▼
                                             ┌──────────────────────────┐
                                             │  PostgreSQL 15            │
                                             │  (PII fields AES-256-GCM │
                                             │   encrypted at app layer) │
                                             └──────────────────────────┘
```

---

## Compliance & Security

| Requirement | Implementation |
|-------------|----------------|
| **Kenya Data Protection Act 2019** | Explicit consent recorded at onboarding; audit log for all PII access; right to access/erasure endpoints planned |
| **CBK AML/CFT Regulations** | PEP flag, AML status workflow (PENDING → CLEAR / FLAGGED / BLOCKED), EDD escalation |
| **CBK KYC Requirements** | National ID, passport photo, proof of residence, next-of-kin – all captured and stored |
| **PII Encryption** | National ID, phone numbers encrypted with AES-256-GCM (field-level, at application layer) |
| **Transport Encryption** | HTTPS enforced via nginx + HSTS header |
| **Authentication** | JWT (HS256), 8-hour expiry, bcrypt-12 passwords, forced password change on first login |
| **Rate Limiting** | 10 login attempts / 15 min; 100 req / 15 min general |
| **Security Headers** | Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) |
| **Audit Trail** | All create/read/update operations on customer/loan data logged with user, IP, timestamp |
| **Role-Based Access** | ADMIN, BRANCH_MANAGER, SUPERVISOR, LOAN_OFFICER |

---

## Credit Scoring Model

Scoring is cashflow-based (not collateral-based), aligned with agricultural microfinance best practice.

### Score Components (100 points total)

| Component | Max | Sub-factors |
|-----------|-----|-------------|
| **Cash Flow** | 35 | Debt-to-Income ratio (15), M-Pesa activity (10), Chama/savings (10) |
| **Ability** | 35 | Farm size & land security (10), Market access (10), Income diversification (8), Loan-to-income ratio (7) |
| **Willingness** | 30 | Yara relationship duration (10), CRB/credit history (12), Social capital/group membership (8) |

### Decision Thresholds

| Score | Decision | Notes |
|-------|----------|-------|
| 70–100 | **APPROVE** | Auto-approve ≤ KES 100k; supervisor review for larger |
| 50–69 | **CONDITIONAL** | Supervisor review required |
| 30–49 | **DECLINE** | Provide improvement recommendations |
| 0–29 | **STRONG DECLINE** | |

### Maximum Loan Calculation

```
net_disposable     = monthly_income - household_expenses - existing_debt
max_by_cashflow    = net_disposable × 0.40 × term_months
max_by_farm_income = annual_farm_income × 0.40
max_loan           = min(max_by_cashflow, max_by_farm_income) × score_factor
                     capped at KES 500,000
```

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (for containerised deployment)

---

## Quick Start (Development)

### 1. Clone & configure

```bash
cp .env.example .env
```

Edit `.env` and set all required values:

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate AES-256 encryption key (32 bytes = 64 hex chars)
openssl rand -hex 32

# Generate IV key (16 bytes = 32 hex chars)
openssl rand -hex 16
```

### 2. Start database

```bash
docker compose up postgres -d
```

### 3. Backend setup

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

The API will be available at `http://localhost:4000`.

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Default admin credentials

```
Email:    admin@juhudikilimo.co.ke
Password: Admin@Juhudi2024!
```

**You will be forced to change the password on first login.**

---

## Production Deployment (Docker Compose)

```bash
# Copy and fill in all values
cp .env.example .env

# Start all services
docker compose up -d

# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Seed initial data
docker compose exec backend node dist/prisma/seed.js
```

---

## User Roles

| Role | Permissions |
|------|-------------|
| **LOAN_OFFICER** | Onboard customers, upload KYC docs, run credit scores, submit loan applications |
| **SUPERVISOR** | All above + review/approve/reject loan applications |
| **BRANCH_MANAGER** | All above + create users, view all branch data, disburse loans |
| **ADMIN** | Full system access |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/profile` | Get current user |
| POST | `/api/auth/users` | Create user (ADMIN/MANAGER) |
| GET | `/api/branches` | List branches |
| POST | `/api/customers` | Create customer (KYC) |
| GET | `/api/customers` | List customers (with pagination/filter) |
| GET | `/api/customers/:id` | Customer profile |
| PATCH | `/api/customers/:id/kyc` | Update KYC status |
| POST | `/api/documents/customers/:id` | Upload KYC document |
| GET | `/api/documents/:id` | Retrieve document (authenticated) |
| POST | `/api/scoring/customers/:id` | Run credit score |
| GET | `/api/scoring/customers/:id` | Score history |
| POST | `/api/loans/applications` | Submit loan application |
| GET | `/api/loans/applications` | List applications |
| PATCH | `/api/loans/applications/:id/review` | Approve/reject |
| POST | `/api/loans/applications/:id/disburse` | Disburse loan |
| GET | `/api/loans/:id` | Loan details + repayments |
| POST | `/api/loans/:loanId/repayments` | Record repayment |
| GET | `/api/loans/stats` | Dashboard statistics |

---

## Customer Onboarding Flow

```
1. Loan Officer logs in
2. Creates customer record (5-step wizard):
   a. Personal information (name, ID, phone, DoB)
   b. Location & next of kin
   c. Farm profile (size, crops, irrigation, Yara history)
   d. Financial profile (income, expenses, M-Pesa, CRB status)
   e. Data consent (KDPA)
3. Uploads KYC documents (National ID front/back, photo, proof of residence)
4. Supervisor/Manager verifies KYC
5. Loan officer runs credit score
6. If recommended, submits loan application
7. Supervisor reviews and approves/rejects
8. Manager disburses via M-Pesa / bank transfer / cash
9. Repayments recorded as received
```

---

## Data Protection (KDPA 2019)

- **Consent**: Captured at onboarding (version-tracked)
- **Encryption**: National ID and phone numbers stored AES-256-GCM encrypted; only decrypted on explicit access
- **Audit trail**: Every read/write of personal data logged with user identity, timestamp, IP
- **Data minimisation**: Only data necessary for credit assessment collected
- **Retention**: 7-year post-loan-closure retention in line with Banking Act requirements
- **Access control**: Role-based; loan officers see only their branch's customers

---

## Project Structure

```
juhudi/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # DB schema (all models)
│   │   └── seed.ts              # Initial branches, products, admin user
│   └── src/
│       ├── config/              # Env validation, DB client
│       ├── middleware/          # Auth (JWT), audit logging, error handler
│       ├── routes/              # Express routers
│       ├── controllers/         # Request handlers
│       ├── services/
│       │   ├── encryption.ts    # AES-256-GCM field encryption
│       │   └── creditScoring.ts # Scoring engine
│       └── utils/               # Logger, async handler
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── customers/       # Customer list, onboarding wizard, profile
│       │   ├── loans/           # Applications, detail, repayments
│       │   └── scoring/         # Credit scoring form + results
│       ├── components/Layout/   # Sidebar, header
│       ├── services/api.ts      # Axios API client
│       └── store/authStore.ts   # Zustand auth state
├── docker-compose.yml
└── .env.example
```
