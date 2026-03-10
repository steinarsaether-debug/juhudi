# Juhudi Kilimo — System Overview & Technical Reference

> **Last updated:** March 2026
> **Stack:** Node.js / Express / TypeScript (backend) · React / TypeScript / Vite (frontend) · PostgreSQL / Prisma ORM

---

## Table of Contents

1. [System Purpose](#1-system-purpose)
2. [Architecture Overview](#2-architecture-overview)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Customer Lifecycle](#4-customer-lifecycle)
5. [Database Models](#5-database-models)
6. [Backend Services](#6-backend-services)
7. [API Endpoints](#7-api-endpoints)
8. [Frontend Pages & Routing](#8-frontend-pages--routing)
9. [Credit Scoring Engine](#9-credit-scoring-engine)
10. [ILP — Individual Loan Product System](#10-ilp--individual-loan-product-system)
11. [KPI Monitoring & Risk Flags](#11-kpi-monitoring--risk-flags)
12. [Customer Award & Loyalty Tiers](#12-customer-award--loyalty-tiers)
13. [M-Pesa AI Analysis](#13-m-pesa-ai-analysis)
14. [Data Quality Engine](#14-data-quality-engine)
15. [Branch Credit Committee (BCC)](#15-branch-credit-committee-bcc)
16. [Collections & Arrears](#16-collections--arrears)
17. [Field Operations](#17-field-operations)
18. [Benchmarks & Market Data](#18-benchmarks--market-data)
19. [System Configuration](#19-system-configuration)
20. [Security & Compliance](#20-security--compliance)
21. [Audit Logging](#21-audit-logging)

---

## 1. System Purpose

Juhudi Kilimo is a **microfinance loan origination and portfolio management platform** built for agricultural lenders operating in rural Kenya. It manages the full lending lifecycle — from customer pre-screening and KYC through credit scoring, BCC approval, disbursement, and repayment tracking — while enforcing regulatory compliance with **CBK Microfinance Guidelines** and the **Kenya Data Protection Act 2019**.

The system supports two distinct loan products:

| Product Type | Description |
|---|---|
| **Group Lending** | Solidarity groups of farmers; shared peer accountability; smaller loans |
| **ILP — Individual Loan Product** | Individual loans for graduating farmers, urban landlords, and shop owners; larger amounts; enhanced assessment |

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript)                         │
│  /frontend/src/                                             │
│  React Router v6 · TanStack Query · Zustand · Tailwind CSS │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTPS / REST API
┌────────────────────────▼───────────────────────────────────┐
│  Express API Server (Node.js + TypeScript)                  │
│  /backend/src/                                              │
│  JWT Auth · RBAC · Rate Limiting · Helmet · CORS            │
└────────────────────────┬───────────────────────────────────┘
                         │ Prisma ORM
┌────────────────────────▼───────────────────────────────────┐
│  PostgreSQL Database                                         │
│  32 models · AES-256-GCM field encryption on PII            │
└────────────────────────────────────────────────────────────┘
```

### Key Technical Characteristics

- **Field-level PII encryption** — National IDs, phone numbers, bank details, and M-Pesa numbers are encrypted at rest using AES-256-GCM before being written to the database.
- **In-memory config cache** — All business constants (interest rates, scoring thresholds) live in the `system_configs` table and are cached in memory with a 5-minute TTL for fast synchronous access.
- **Role-scoped data access** — Every list endpoint filters by the authenticated user's role: LOs see their own customers/loans; BMs see their branch; Admins see all.
- **Audit trail** — Every write operation that modifies customer or loan data writes a record to `audit_logs`.

---

## 3. User Roles & Permissions

| Role | Code | Capabilities |
|---|---|---|
| **Loan Officer** | `LOAN_OFFICER` | Create customers, conduct interviews, submit applications, record repayments, complete ILP follow-ups |
| **Supervisor** | `SUPERVISOR` | All LO capabilities + review/approve applications, update KYC status, resolve quality flags, view quality dashboard |
| **Branch Manager** | `BRANCH_MANAGER` | All Supervisor capabilities + open/decide BCC sessions, view all branch data, manage location pings, resolve ILP risk flags |
| **Admin** | `ADMIN` | All capabilities + manage users/branches, view audit logs, manage system config, grant ILP eligibility |

### Access Control Mechanism

Authentication uses **JWT Bearer tokens**. The token payload contains `{ sub, email, role, branchId }`. Two middleware functions enforce access:

- **`authenticate`** — Validates the JWT; attaches `req.user` to the request. Returns 401 if missing or expired.
- **`authorize(...roles)`** — Checks `req.user.role` against the allowed roles. Returns 403 if not permitted.

---

## 4. Customer Lifecycle

The lending lifecycle follows seven sequential stages:

```
[1] Pre-Screening  →  [2] KYC / Onboarding  →  [3] Interview & M-Pesa
    →  [4] Loan Application  →  [5] BCC Review & Approval
    →  [6] Disbursement  →  [7] Repayment & Collections
    →  (loop) Next Loan Cycle  |  Write-Off / Restructure
```

| Stage | Key Gate | Status Transition |
|---|---|---|
| Pre-Screening | Eligibility checklist (age, geography, agriculture) | Customer record created |
| KYC | All mandatory fields + photo + ID document uploaded | `kycStatus: PENDING → VERIFIED` |
| Interview | Standard or ILP interview completed | `interview.status: DRAFT → COMPLETED` |
| Loan Application | KYC verified + interview completed | `application.status: DRAFT → SUBMITTED` |
| BCC | Quorum vote + BM decision | `application.status → APPROVED / REJECTED` |
| Disbursement | Approved application; checklist ticked | `loan.status: PENDING_DISBURSEMENT → ACTIVE` |
| Repayment | Regular installments recorded | `loan.status: ACTIVE → COMPLETED` |

A **CustomerJourneyBar** component in the frontend visualises the customer's current stage and **JourneyGate** enforces that each step must be satisfied before the next can begin.

---

## 5. Database Models

### 5.1 Core Models

#### `User`
System users. Linked to a branch (except ADMINs).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `email` | String | Unique |
| `passwordHash` | String | bcrypt |
| `role` | `UserRole` | ADMIN / BRANCH_MANAGER / SUPERVISOR / LOAN_OFFICER |
| `firstName`, `lastName` | String | |
| `employeeId` | String | Unique |
| `branchId` | String? | Null for ADMIN |
| `isActive` | Boolean | |
| `mustChangePass` | Boolean | Set on new accounts |
| `lastLogin` | DateTime? | |

#### `Branch`
Organisational branches. Each has a code, county, and address.

| Field | Type | Notes |
|---|---|---|
| `code` | String | Unique short code |
| `county` | String | Kenya county |
| `isActive` | Boolean | |

---

### 5.2 Customer & Profile Models

#### `Customer`
The central customer record. Contains identity data (encrypted), location, and KYC/AML status.

| Field | Type | Notes |
|---|---|---|
| `customerNumber` | String | Auto-generated, unique |
| `nationalIdEnc` | String | AES-256-GCM encrypted |
| `nationalIdHash` | String | HMAC for lookups |
| `phoneEnc` | String | Encrypted |
| `phoneHash` | String | HMAC for lookups |
| `kycStatus` | `KYCStatus` | PENDING / SUBMITTED / VERIFIED / REJECTED / REQUIRES_UPDATE |
| `amlStatus` | `AMLStatus` | PENDING / CLEAR / FLAGGED / BLOCKED |
| `riskRating` | String? | LOW / MEDIUM / HIGH |
| `isPEP` | Boolean | Politically Exposed Person flag |
| `currentTier` | `CustomerTier` | STANDARD / BRONZE / SILVER / GOLD / PLATINUM |
| `gpsLatitude`, `gpsLongitude` | Float? | Home GPS coordinates |

#### `FarmProfile`
Agricultural characteristics of the customer's farm. One-to-one with Customer.

| Field | Notes |
|---|---|
| `farmSize` | Acres (decimal) |
| `landOwnership` | OWNED / LEASED / COMMUNAL / FAMILY |
| `primaryCrop`, `secondaryCrops` | Crop types |
| `irrigationType` | IRRIGATED / RAIN_FED / MIXED |
| `marketAccess` | CONTRACT / COOPERATIVE / LOCAL_MARKET / SUBSISTENCE |
| `yaraMemberSince` | Years as Yara customer |
| `yaraProductsUsed` | Number of Yara products |

#### `FinancialProfile`
Income, expenses, and existing debt. One-to-one with Customer.

| Field | Notes |
|---|---|
| `monthlyFarmIncome` | KES |
| `monthlyOffFarmIncome` | KES |
| `monthlyHouseholdExpenses` | KES |
| `otherMonthlyDebt` | KES (existing repayments) |
| `mpesaMonthlyAvgKes` | Average monthly M-Pesa flow |
| `crbStatus` | CLEAR / LISTED / UNKNOWN / PERFORMING |
| `groupMonthlySavingsKes` | If group member |

#### `KYCDocument`
Uploaded KYC supporting documents (national ID copy, land documents, photos).

| Field | Notes |
|---|---|
| `type` | Document category |
| `filePathEnc` | Encrypted storage path |
| `isVerified` | Verified by a supervisor |
| `verifiedById` | Who verified it |

---

### 5.3 Lending Models

#### `LoanProduct`
Configurable loan product templates defining amounts, terms, and rates.

| Field | Notes |
|---|---|
| `code` | Unique short code (e.g. `ILP-FARM`) |
| `category` | Product category |
| `minAmountKes` / `maxAmountKes` | Amount limits |
| `minTermMonths` / `maxTermMonths` | Term limits |
| `nominalInterestRate` | Annual rate % |
| `processingFeePct` | Fee as % of loan |

**Standard products** seed on deployment. **ILP products** added for the three segments:
- `ILP-FARM`: KES 100,000–500,000, 6–24 months
- `ILP-LAND`: KES 200,000–1,000,000, 6–36 months
- `ILP-SHOP`: KES 100,000–500,000, 6–24 months

#### `LoanApplication`
One record per loan application. Status transitions from `DRAFT` through to `APPROVED` or `REJECTED`.

| Field | Notes |
|---|---|
| `applicationNumber` | Auto-generated |
| `loanType` | INDIVIDUAL or GROUP |
| `ilpSegment` | FARMER / LANDLORD / SHOP_OWNER (ILP only) |
| `requestedAmountKes` | Customer-requested amount |
| `termMonths` | Requested loan term |
| `status` | DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED |
| `approvedAmountKes` | May differ from requested |
| `interestRatePct` | Effective rate (base minus loyalty discount) |
| `customerTierAtApplication` | Snapshot of tier at submission |
| `interestRateDiscountPct` | Loyalty discount applied |
| `processingFeeDiscountPct` | Loyalty fee discount |
| `hadShockPastYear` | Income shock in last 12 months |
| `hasSavingsBuffer` | Emergency savings exist |

#### `Loan`
Created when an application is disbursed. Tracks the active repayment schedule.

| Field | Notes |
|---|---|
| `loanNumber` | Auto-generated |
| `principalKes` | Disbursed amount |
| `installmentKes` | Monthly repayment amount |
| `totalRepayableKes` | Principal + interest |
| `disbursementMethod` | MPESA / BANK_TRANSFER / CASH |
| `disbursementReference` | M-Pesa code or bank reference |
| `disbursedAt` | Disbursement timestamp |
| `maturityDate` | Final repayment due date |
| `status` | PENDING_DISBURSEMENT / ACTIVE / COMPLETED / DEFAULTED / WRITTEN_OFF |
| `daysInArrears` | Current arrears count |
| `outstandingBalKes` | Remaining balance |
| `ilpCycleNumber` | 1 = first ILP loan, 2 = second |

#### `Repayment`
Individual repayment entries linked to a loan.

| Field | Notes |
|---|---|
| `amountKes` | Amount paid |
| `paymentDate` | Date of payment |
| `method` | MPESA / BANK_TRANSFER / CASH / CHEQUE |
| `reference` | Transaction reference |

#### `LoanCollateral`
Security items pledged against a loan application.

| Field | Notes |
|---|---|
| `collateralType` | TITLE_DEED / MOTOR_VEHICLE / CHATTEL / LIVESTOCK / etc. |
| `estimatedValueKes` | Appraised value |
| `isVerified` | Verified by officer |

---

### 5.4 Group Lending Models

#### `LoanGroup`
Solidarity lending group. Members share peer accountability.

| Field | Notes |
|---|---|
| `registrationNo` | Official registration |
| `status` | FORMING / ACTIVE / SUSPENDED / DISSOLVED |
| `meetingFrequency` | WEEKLY / BIWEEKLY / MONTHLY |
| `loanOfficerId` | Responsible LO |

#### `LoanGroupMember`
Membership link between a Customer and a LoanGroup.

| Field | Notes |
|---|---|
| `role` | CHAIR / SECRETARY / TREASURER / MEMBER |
| `joinedAt` / `leftAt` | Tenure dates |
| `isActive` | Current membership status |

---

### 5.5 Interview & Assessment Models

#### `CustomerInterview`
Field interview conducted by a Loan Officer before an application is submitted.

| Field | Notes |
|---|---|
| `interviewType` | STANDARD \| ILP_FARMER \| ILP_LANDLORD \| ILP_SHOP_OWNER |
| `ilpSegment` | Set for ILP interviews |
| `status` | DRAFT → COMPLETED |
| `answers` | JSON — keyed by section and question ID |
| `totalScore` / `scorePercent` | Computed weighted score |
| `recommendation` | APPROVE / APPROVE_WITH_CONDITIONS / FURTHER_EVALUATION / DECLINE |

Standard interviews have 8 weighted sections (S1 Personal through S8 Final). ILP interviews have 5 sections (Background → Cash Flow → Loan Purpose) that map directly to the ILP wizard assessment steps.

---

### 5.6 M-Pesa Analysis Model

#### `MpesaStatement`
Uploaded M-Pesa statement with AI-driven risk analysis results.

| Field | Notes |
|---|---|
| `filePathEnc` | Encrypted storage path |
| `analysisStatus` | PENDING / PROCESSING / COMPLETE / FAILED |
| `overallRiskLevel` | LOW / MEDIUM / HIGH / VERY_HIGH |
| `recommendedAction` | AI recommendation |
| `detectedLoans` | JSON — suspected undisclosed loans |
| `suspiciousPatterns` | JSON — unusual transaction patterns |
| `gamblingTransactions` | JSON — gambling-related flows |
| `avgMonthlyInflow` / `avgMonthlyOutflow` | Computed averages |
| `fulizaUsageCount` | M-Pesa micro-loan usage |

---

### 5.7 BCC Models

#### `BccSession`
Branch Credit Committee review session tied to a loan application.

| Field | Notes |
|---|---|
| `status` | OPEN / DECIDED / OVERRIDDEN / EXPIRED |
| `outcome` | APPROVED / REFUSED / REFERRED / CONDITIONAL |
| `quorumRequired` | Minimum votes needed |
| `expiresAt` | Auto-expiry timestamp |
| `managerOverride` | BM can override committee vote |

#### `BccVote` / `BccComment`
Individual member votes (ENDORSE / REFUSE / ABSTAIN) and discussion comments attached to a BCC session.

---

### 5.8 ILP-Specific Models

#### `BranchILPEligibility`
One row per branch-segment pair. Admin grants eligibility; system snapshots metrics at unlock time.

| Field | Notes |
|---|---|
| `segment` | FARMER / LANDLORD / SHOP_OWNER |
| `status` | NOT_ELIGIBLE / ELIGIBLE / MASTERED |
| `par30AtUnlock` | PAR30 % at time of grant |
| `retentionAtUnlock` | Customer retention % at grant |

Progressive unlock rule: branch must reach MASTERED in one segment before a second segment can be unlocked. Maximum 2 active segments at any time.

#### `ILPAssessment`
5-dimension scorecard linked 1:1 to a LoanApplication (ILP loans only).

| Dimension | Weight | Score Range |
|---|---|---|
| Owner / Character | 20% | 0–100 |
| Business Quality | 25% | 0–100 |
| Operational Risk | 20% | 0–100 |
| Cash Flow (DSR-based) | 25% | 0–100 |
| Collateral | 10% | 0–100 |
| **Composite** | — | 0–100 |

Composite thresholds: ≥75 → APPROVE, 60–74 → CONDITIONAL, <60 → DECLINE. DSR > 50% is a **hard block** — the application cannot be submitted regardless of other scores.

#### `ILPFollowUp`
Auto-generated monitoring schedule at disbursement. One row per scheduled visit or call.

| Field | Notes |
|---|---|
| `visitType` | PHONE_CALL / FIELD_VISIT / DOCUMENT_REVIEW / KPI_CHECK |
| `milestone` | Human-readable label |
| `loanCycle` | 1 (intensive) or 2 (lighter touch) |
| `riskFlagId` | Set for KPI_CHECK entries generated from a risk flag |

#### `CustomerRiskFlag`
KPI risk flags derived from assessment data and repayment behaviour.

| Field | Notes |
|---|---|
| `category` | FINANCIAL_CAPACITY / BUSINESS_PERFORMANCE / REPAYMENT_BEHAVIOR / OPERATIONAL_RISK / COLLATERAL_RISK |
| `severity` | YELLOW (warn) or RED (critical) |
| `indicator` | Machine key e.g. `dsr_elevated`, `arrears_30d` |
| `value` / `threshold` | Measured vs. trigger values |
| `isActive` | Auto-resolves when condition clears |

---

### 5.9 Data Quality Model

#### `DataQualityFlag`
Quality issues detected by the quality engine.

| Flag Type | Description |
|---|---|
| `SIMILAR_NAME_SAME_BRANCH` | >92% name similarity within branch |
| `SIMILAR_NAME_CROSS_BRANCH` | >88% name similarity across branches |
| `NAME_DOB_MATCH` | Same name + date of birth |
| `GPS_PROXIMITY` | GPS coordinates <15 metres from another customer |
| `FINANCIAL_PROFILE_COPY` | Jaccard similarity >65% on financial data |
| `LOAN_PURPOSE_COPY_PASTE` | Purpose text >65% similar to another |
| `ROUND_NUMBER_INCOME` | ≥3 round-number financial fields |
| `NEGATIVE_DISPOSABLE_INCOME` | Income minus expenses is negative |
| `HIGH_DEBT_BURDEN` | DSR > 50% |
| `RAPID_SUCCESSION` | ≥3 applications within 60 minutes |
| `GENERIC_LOAN_PURPOSE` | Overly generic purpose text |

---

### 5.10 System Configuration Model

#### `SystemConfig`
Key-value store for all tunable business constants. Backed by an in-memory cache.

| Field | Notes |
|---|---|
| `key` | Dot-namespaced (e.g. `scoring.group.approve_threshold`) |
| `value` | Stored as text |
| `dataType` | NUMBER / PERCENTAGE / AMOUNT_KES / DAYS / MONTHS / RATIO / BOOLEAN / SCORE_POINTS |
| `category` | Grouping for the admin UI |
| `minValue` / `maxValue` | Validation bounds |
| `isEditable` | False for structurally fixed values (e.g. score component max) |

---

## 6. Backend Services

### 6.1 `configService` — Business Constants Cache
**File:** `src/services/configService.ts`

Singleton service. Loaded at server startup via `configService.initialize()`. Maintains an in-memory `Map<string, string>` that is refreshed from the database every 5 minutes in the background. Falls back to `configDefaults.ts` when a key is not found in the database.

| Method | Description |
|---|---|
| `initialize()` | Called once at startup; awaits first DB refresh |
| `refresh()` | Fetches all rows from `system_configs` into cache |
| `raw(key)` | Returns the raw string value; throws if key unknown |
| `num(key)` | Parses as float |
| `pct(key)` | Parses as float and divides by 100 (e.g. `18` → `0.18`) |
| `int(key)` | Parses as integer |
| `bool(key)` | Parses as boolean (`"true"` / `"false"`) |
| `group(keys)` | Returns a plain object of multiple numeric keys |

**Config namespaces:**

| Namespace | Contents |
|---|---|
| `award.*` | Loyalty tier thresholds and discounts |
| `scoring.group.*` | Group loan credit scoring parameters |
| `ilp.weight.*` | ILP dimension weights |
| `ilp.threshold.*` | ILP decision thresholds |
| `ilp.cashflow.*` | ILP DSR score bands |
| `ilp.collateral.*` | ILP collateral coverage scores |
| `ilp.eligibility.*` | Branch ILP eligibility thresholds |
| `kpi.followup.*` | Follow-up frequency by flag count |
| `kpi.flag.*` | KPI flag trigger thresholds |
| `quality.*` | Data quality detection thresholds |
| `interview.weight.*` | Interview section weights |
| `interview.threshold.*` | Interview decision thresholds |

---

### 6.2 `creditScoring` — Group Loan Credit Engine
**File:** `src/services/creditScoring.ts`

Pure function service (no database access). Implements CBK Microfinance Guidelines.

**Scoring Framework (100 points total):**

| Component | Max Points | What it measures |
|---|---|---|
| Cash Flow | 35 | Farm income, M-Pesa activity, group savings |
| Ability | 35 | Farm size, market access, income diversification, LTIR |
| Willingness | 30 | Yara relationship, CRB history, social capital |

**Decision Thresholds (configurable):**

| Score | Decision |
|---|---|
| 70–100 | APPROVE |
| 50–69 | CONDITIONAL (supervisor review required) |
| 30–49 | DECLINE |
| 0–29 | STRONG_DECLINE |

**Key Input Fields:**

- Cash Flow: `monthlyFarmIncome`, `monthlyOffFarmIncome`, `monthlyHouseholdExpenses`, `otherMonthlyDebt`, `mpesaMonthlyAvgKes`, `groupMonthlySavingsKes`
- Ability: `farmSizeAcres`, `marketAccess`, `irrigationType`, `secondaryCrops`, `requestedAmountKes`
- Willingness: `yaraMemberSinceYears`, `yaraProductsUsedCount`, `crbStatus`, `numberOfDependents`, `previousLoansRepaidOnTime`

**Output:** `ScoringResult` containing component scores, breakdowns, `maxLoanAmountKes`, and `suggestedTermMonths`.

---

### 6.3 `ilpScoringService` — ILP Scorecard Engine
**File:** `src/services/ilpScoringService.ts`

Pure function service for ILP assessments. Five exported scorers per segment plus composite computation.

| Function | Description |
|---|---|
| `computeOwnerScore(data)` | Universal across all segments (experience, CRB, loan history, references) |
| `computeFarmerBusinessScore(data)` | Farm size + market access + group cycles |
| `computeLandlordBusinessScore(data)` | Occupancy % + unit count + title deed (no deed caps at 40) |
| `computeShopOwnerBusinessScore(data)` | Years + licence + bookkeeping + stock/loan ratio |
| `computeFarmerOpsScore(data)` | Irrigation + storage + insurance + alternative income |
| `computeLandlordOpsScore(data)` | Building age + insurance + maintenance + location |
| `computeShopOwnerOpsScore(data)` | Location risk + competition + suppliers + insurance |
| `computeCashFlowScore(data)` | DSR-based; returns `{ score, dsr, hardBlock }` |
| `computeCollateralScore(items, loanAmount)` | Coverage ratio + type bonuses (capped at 100) |
| `computeCompositeScore(scores)` | Applies weights (20/25/20/25/10) |
| `deriveRecommendation(composite)` | `'APPROVE' \| 'CONDITIONAL' \| 'DECLINE'` |

---

### 6.4 `awardService` — Loyalty Tier Engine
**File:** `src/services/awardService.ts`

Computes and updates the customer's loyalty tier after each completed loan cycle.

| Function | Description |
|---|---|
| `computeCustomerTier(completedLoans)` | Pure function; returns tier from loan history |
| `refreshCustomerTier(customerId)` | Fetches loan history, computes tier, writes to DB |
| `getTierDiscounts(tier)` | Returns `{ rateDiscount, feeDiscount }` from configService |

**Tier Algorithm:**
1. Fetch all completed loans for the customer
2. If **any** loan is WRITTEN_OFF → return STANDARD (tier reset)
3. `cycleCount = completedLoans.length`
4. `maxArrears = max(daysInArrears across all completed loans)`
5. Apply tier table top-down (PLATINUM first, STANDARD last)

**Tier Table (thresholds configurable):**

| Tier | Min Cycles | Max Arrears | Rate Discount | Fee Discount |
|---|---|---|---|---|
| STANDARD | 0–1 | — | 0% | 0% |
| BRONZE | ≥2 | ≤30 days | −0.5% p.a. | −10% |
| SILVER | ≥3 | ≤14 days | −1.0% p.a. | −20% |
| GOLD | ≥5 | ≤7 days | −1.5% p.a. | −30% |
| PLATINUM | ≥7 | 0 days | −2.0% p.a. | −40% |

Called after: `recordRepayment`, `completeFollowUp`.

---

### 6.5 `kpiService` — Risk Flag Engine
**File:** `src/services/kpiService.ts`

Derives, refreshes, and schedules KPI risk flags for ILP loans.

| Function | Description |
|---|---|
| `deriveKPIFlags(loanId, applicationId)` | Called at ILP disbursement; reads assessment + application data; creates initial `CustomerRiskFlag` records |
| `refreshKPIFlags(loanId)` | Re-evaluates all flags; resolves cleared flags; returns `{ created, resolved }` |
| `scheduleKPIFollowUps(loanId, activeFlags)` | Creates `ILPFollowUp` records with `visitType = KPI_CHECK` linked to each active flag |
| `computeFollowUpFrequency(redCount, yellowCount)` | Returns next check-in interval in days |

**Follow-up Frequency Logic:**

| Active Flags | Interval |
|---|---|
| ≥1 RED | 7 days (weekly) |
| ≥2 YELLOW, no RED | 14 days |
| 1 YELLOW, no RED | 21 days |
| No flags | 30 days |

**15 KPI Indicators** covering: DSR, savings buffer, income diversity, market access, business score, occupancy (landlord), years in business (shop), irrigation type, storage, insurance, operational risk score, arrears (7d/30d), collateral score.

---

### 6.6 `qualityService` — Data Quality Engine
**File:** `src/services/qualityService.ts`

Detects duplicate customers, copy-pasted data, and suspicious patterns.

| Function | Description |
|---|---|
| `checkNameDuplicate(firstName, lastName, branchId)` | Live check during onboarding; returns similarity matches |
| `scanCustomer(customerId)` | Full quality scan: name similarity, GPS proximity, DOB match |
| `scanApplication(applicationId)` | Checks loan purpose copy-paste, round numbers, financial anomalies |
| `runBranchScan(branchId)` | Batch scan of all customers/applications in a branch |

**Detection Algorithms:**
- **Name similarity:** Jaro-Winkler distance (same branch threshold: 92%; cross-branch: 88%)
- **GPS proximity:** Haversine distance (<15 metres = flag)
- **Loan purpose copy-paste:** Jaccard token similarity (>65%)
- **Round number detection:** ≥3 financial fields are round numbers
- **Rapid succession:** ≥3 applications within 60 minutes

---

### 6.7 `encryption` — PII Field Encryption
**File:** `src/services/encryption.ts`

Kenya Data Protection Act 2019 compliance. Encrypts all sensitive personal data before database storage.

| Function | Description |
|---|---|
| `encrypt(plaintext)` | AES-256-GCM with random IV; returns `base64(iv:authTag:ciphertext)` |
| `decrypt(encryptedValue)` | Reverses encryption; throws on tampered data |

Encrypted fields: `nationalIdEnc`, `phoneEnc`, `alternatePhone`, `mpesaPhoneEnc`, `bankBranchEnc`, `crbReportEnc`, `filePathEnc` (documents and M-Pesa statements).

Search-friendly fields (phone, national ID) also store an HMAC hash (`phoneHash`, `nationalIdHash`) for exact-match lookups without decrypting.

---

## 7. API Endpoints

All endpoints are prefixed `/api/`. Authentication is required for all except `/api/auth/login`.

### 7.1 Authentication — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Issue JWT token |
| GET | `/auth/profile` | Any | Get own profile |
| POST | `/auth/change-password` | Any | Change own password |
| POST | `/auth/users` | ADMIN, BM | Create user account |

---

### 7.2 Customers — `/api/customers`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/customers` | Any | Create customer (pre-screening + KYC data) |
| GET | `/customers` | Any | List customers (role-scoped, paginated) |
| GET | `/customers/:id` | Any | Customer detail (profile + related data) |
| PATCH | `/customers/:id` | Any | Update customer profile |
| PATCH | `/customers/:id/kyc` | SUPERVISOR+ | Update KYC status |
| GET | `/customers/:id/repayments` | Any | All repayments across all loans |
| GET | `/customers/:id/tier` | Any | Loyalty tier + cycle count + discounts |

---

### 7.3 Loans — `/api/loans`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/loans/stats` | Any | Portfolio statistics |
| GET | `/loans/portfolio` | Any | Portfolio overview |
| POST | `/loans/applications` | Any | Submit loan application |
| GET | `/loans/applications` | Any | List applications (role-scoped) |
| PATCH | `/loans/applications/:id/review` | SUPERVISOR+ | Approve / reject application |
| POST | `/loans/applications/:id/disburse` | SUPERVISOR+ | Disburse approved loan |
| GET | `/loans/:id` | Any | Loan detail with repayment schedule |
| POST | `/loans/:loanId/repayments` | Any | Record a repayment |

---

### 7.4 Groups — `/api/groups`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/groups` | Any | List groups (role-scoped) |
| POST | `/groups` | Any | Create new group |
| GET | `/groups/:id` | Any | Group detail + members + loan history |
| PATCH | `/groups/:id` | Any | Update group metadata |
| PATCH | `/groups/:id/toggle-active` | Any | Soft-delete / re-activate |
| POST | `/groups/:id/members` | Any | Add customer to group |
| DELETE | `/groups/:id/members/:memberId` | Any | Remove member |

---

### 7.5 Credit Scoring — `/api/scoring`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/scoring/customers/:customerId` | Any | Run credit score |
| GET | `/scoring/customers/:customerId` | Any | Get score history |

---

### 7.6 Interviews — `/api/interviews`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/interviews` | Any | Global interview list (role-scoped) |
| POST | `/interviews/ilp/:customerId/:segment` | Any | Create/update ILP interview |
| GET | `/interviews/ilp/:customerId/:segment` | Any | Get latest completed ILP interview |
| POST | `/interviews/:customerId` | Any | Create/update standard interview |
| GET | `/interviews/:customerId` | Any | List interviews for customer |
| GET | `/interviews/single/:interviewId` | Any | Get single interview by ID |
| DELETE | `/interviews/single/:interviewId` | Any | Delete draft interview |

---

### 7.7 BCC — `/api/bcc`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bcc` | BM, ADMIN | Open BCC session for application |
| GET | `/bcc` | Any | List BCC sessions |
| GET | `/bcc/:id` | Any | Session detail + votes + comments |
| POST | `/bcc/:id/votes` | BM, SUPERVISOR, LO | Cast vote |
| POST | `/bcc/:id/comments` | Any | Add discussion comment |
| POST | `/bcc/:id/decide` | BM, ADMIN | Close session with final decision |

---

### 7.8 Collections — `/api/collections`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/collections/summary` | Any | Arrears summary statistics |
| GET | `/collections/arrears` | Any | List all loans in arrears |
| GET | `/collections/:loanId` | Any | Collection history for a loan |
| POST | `/collections/:loanId/actions` | Any | Log collection action |

---

### 7.9 Data Quality — `/api/quality`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/quality/check-name` | Any | Live name duplicate check |
| POST | `/quality/scan/customer/:id` | Any | Run quality scan on customer |
| POST | `/quality/scan/application/:id` | Any | Run quality scan on application |
| GET | `/quality/flags/:entityType/:entityId` | Any | Get flags for entity |
| PATCH | `/quality/flags/:flagId/resolve` | Any | Resolve / dismiss flag |
| GET | `/quality/report` | Any | Branch quality summary report |
| POST | `/quality/scan/branch` | BM, ADMIN | Full branch quality sweep |

---

### 7.10 M-Pesa — `/api/customers/:customerId/mpesa`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/mpesa` | Any | List M-Pesa statements for customer |
| POST | `/mpesa` | Any | Upload M-Pesa statement (multipart) |
| GET | `/mpesa/:statementId` | Any | Get statement + analysis results |
| POST | `/mpesa/:statementId/retry` | Any | Retry failed AI analysis |

---

### 7.11 ILP — `/api/ilp`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ilp/branch-eligibility/:branchId` | Any | Branch eligibility + metrics |
| POST | `/ilp/branch-eligibility/:branchId/grant` | ADMIN | Grant segment eligibility |
| PATCH | `/ilp/branch-eligibility/:branchId` | ADMIN | Update segment status |
| POST | `/ilp/assessment/:applicationId` | Any | Save ILP scorecard |
| GET | `/ilp/assessment/:applicationId` | Any | Get ILP scorecard |
| GET | `/ilp/follow-up/:loanId` | Any | Follow-up schedule for loan |
| PATCH | `/ilp/follow-up/:followUpId/complete` | Any | Mark follow-up complete |
| GET | `/ilp/risk-flags/:loanId` | Any | KPI risk flags for loan |
| PATCH | `/ilp/risk-flags/:flagId/resolve` | BM, SUPERVISOR, ADMIN | Resolve risk flag |
| GET | `/lo/worklist` | Any | LO unified follow-up worklist |

---

### 7.12 System Configuration — `/api/config`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/config` | ADMIN | List all configs grouped by category |
| PATCH | `/config/:key` | ADMIN | Update config value (validated against min/max) |
| POST | `/config/reset/:key` | ADMIN | Reset to default value |

---

### 7.13 Admin — `/api/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | Any (role-scoped) | List users |
| POST | `/admin/users` | ADMIN | Create user |
| PATCH | `/admin/users/:id` | ADMIN | Update user |
| POST | `/admin/users/:id/reset-password` | ADMIN | Reset password |
| PATCH | `/admin/users/:id/toggle-active` | ADMIN | Activate/deactivate user |
| GET | `/admin/branches` | Any | List branches |
| POST | `/admin/branches` | ADMIN | Create branch |
| PATCH | `/admin/branches/:id` | ADMIN | Update branch |
| PATCH | `/admin/branches/:id/toggle-active` | ADMIN | Activate/deactivate branch |
| GET | `/admin/activity` | Any | Audit log viewer |
| POST | `/admin/locations/ping` | Any | Submit GPS ping |
| GET | `/admin/locations` | Any | View LO location history |
| GET | `/admin/mpesa-analyses` | Any | M-Pesa analysis monitor |
| GET/PUT/DELETE | `/admin/config/:key` | Any | AI prompt config (separate from business constants) |

---

### 7.14 Benchmarks — `/api/benchmarks`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/benchmarks/sources` | Any | List data sources |
| POST/PUT/DELETE | `/benchmarks/sources[/:id]` | ADMIN | Manage data sources |
| GET | `/benchmarks/items` | Any | List benchmark metrics |
| POST/PUT/DELETE | `/benchmarks/items[/:id]` | ADMIN, BM | Manage benchmark items |
| GET | `/benchmarks/values` | Any | List benchmark values |
| POST/PUT/DELETE | `/benchmarks/values[/:id]` | ADMIN, BM | Manage benchmark values |
| GET | `/benchmarks/lookup` | Any | Lookup relevant values by category/county |
| GET | `/benchmarks/categories` | Any | List categories |

---

## 8. Frontend Pages & Routing

### 8.1 Authentication
| Route | Component | Description |
|---|---|---|
| `/login` | `Login.tsx` | Email/password login form |
| `/change-password` | `ChangePassword.tsx` | Forced password change for new accounts |

### 8.2 Dashboard
| Route | Component | Description |
|---|---|---|
| `/` | `Dashboard.tsx` | Portfolio overview: active loans, PAR, disbursements, collections KPIs |

### 8.3 Customer Management
| Route | Component | Description |
|---|---|---|
| `/customers` | `CustomerList.tsx` | Searchable, paginated customer list |
| `/customers/new` | `CustomerOnboarding.tsx` | Pre-screening checklist + customer creation form |
| `/customers/:id` | `CustomerProfile.tsx` | Full profile: KYC, farm, financial, loans, documents, interviews, ILP status, risk flags, repayment tab |
| `/customers/:id/edit` | `CustomerEdit.tsx` | Edit customer details |

### 8.4 Credit Scoring
| Route | Component | Description |
|---|---|---|
| `/customers/:id/score` | `CreditScoring.tsx` | Run credit score; view score breakdown with component bars; view history |

### 8.5 Interviews
| Route | Component | Description |
|---|---|---|
| `/interviews` | `InterviewList.tsx` | All interviews (LO: own; BM: branch; Admin: all); filterable by status |
| `/customers/:customerId/interview` | `CustomerInterview.tsx` | 8-section standard interview form with auto-scoring |
| `/customers/:id/ilp-interview/:segment` | `ILPInterviewForm.tsx` | 25-question ILP interview (FARMER / LANDLORD / SHOP_OWNER) |

### 8.6 Loan Applications (Standard)
| Route | Component | Description |
|---|---|---|
| `/customers/:id/loan` | `LoanApplicationForm.tsx` | 5-step wizard: Loan Type → Purpose → Cash Flow → Resilience → Collateral → Review |
| `/loans` | `LoanApplications.tsx` | List all applications with ILP badge and filter |
| `/loans/:id` | `LoanDetail.tsx` | Application + loan detail; amortisation schedule; ILP follow-up tab; repeat loan CTA |

### 8.7 ILP Loans
| Route | Component | Description |
|---|---|---|
| `/customers/:id/ilp-apply` | `ILPApplicationForm.tsx` | 7-step ILP wizard with live scoring and interview auto-population |
| `/loans/:id/follow-up` | `ILPFollowUp.tsx` | Unified follow-up worklist for a loan: milestone + KPI_CHECK tasks |
| `/worklist` | `LOWorklist.tsx` | LO cross-customer worklist: all pending follow-ups sorted by urgency |

### 8.8 BCC
| Route | Component | Description |
|---|---|---|
| `/bcc` | `BccList.tsx` | List of BCC sessions with status |
| `/bcc/:id` | `BccDetail.tsx` | Voting panel, comments, BM decision; ILP composite score panel |

### 8.9 Groups
| Route | Component | Description |
|---|---|---|
| `/groups` | `GroupList.tsx` | Searchable group list |
| `/groups/new` | `GroupForm.tsx` | Create new group |
| `/groups/:id` | `GroupProfile.tsx` | Group details, members, loan history |
| `/groups/:id/edit` | `GroupForm.tsx` | Edit group |

### 8.10 Collections & Portfolio
| Route | Component | Description |
|---|---|---|
| `/collections` | `Collections.tsx` | Arrears overview; collection actions log; escalation stages |
| `/benchmarks` | `Benchmarks.tsx` | Benchmark data lookup by category and county |

### 8.11 Field Operations
| Route | Component | Description |
|---|---|---|
| `/field` | `FieldHub.tsx` | GPS ping; farm survey; health assessment photo capture |

### 8.12 Administration
| Route | Component | Roles |
|---|---|---|
| `/quality` | `QualityDashboard.tsx` | SUPERVISOR, BM, ADMIN |
| `/admin/activity` | `AdminActivity.tsx` | BM, ADMIN |
| `/admin/locations` | `AdminLocations.tsx` | BM, ADMIN |
| `/admin/users` | `AdminUsers.tsx` | ADMIN only |
| `/admin/branches` | `AdminBranches.tsx` | ADMIN only |
| `/admin/mpesa` | `MpesaMonitor.tsx` | ADMIN only |
| `/admin/ilp-eligibility` | `AdminILPEligibility.tsx` | ADMIN only |
| `/admin/config` | `SystemConfigPage.tsx` | ADMIN only |

### 8.13 Route Guards

- **`ProtectedRoute`** — Redirects unauthenticated users to `/login`. Redirects users with `mustChangePass = true` to `/change-password`.
- **`RoleRoute`** — Wraps admin pages. Redirects users without the required role to `/`.

---

## 9. Credit Scoring Engine

### 9.1 Scoring Flow

```
LO clicks "Run Credit Score"
    ↓
POST /scoring/customers/:customerId
    ↓
scoringController.runCreditScore()
    ↓
Reads: customer + farmProfile + financialProfile + loanGroup
    ↓
creditScoring.scoreCustomer(input)  ← pure function
    ↓
{ cashflowScore, abilityScore, willingnessScore, totalScore,
  recommendation, maxLoanAmountKes, suggestedTermMonths }
    ↓
Saved to CreditScore record
    ↓
Linked to LoanApplication at submission
```

### 9.2 Cash Flow Component (35 pts)

| Sub-component | Max | Key Driver |
|---|---|---|
| Debt-to-Income (DTI) | 15 | Net disposable income ratio |
| M-Pesa Activity | 10 | Monthly M-Pesa flow in KES |
| Group / Chama Savings | 10 | Monthly savings contributions |

DTI formula: `(existingDebt + newInstallment) / (farmIncome + offFarmIncome) × 100`

### 9.3 Ability Component (35 pts)

| Sub-component | Max | Key Driver |
|---|---|---|
| Farm Size | 10 | Acres under cultivation |
| Market Access | 10 | Buyer relationship quality |
| Income Diversification | 8 | Number of income sources |
| Loan-to-Income Ratio (LTIR) | 7 | Loan amount / annual income |

### 9.4 Willingness Component (30 pts)

| Sub-component | Max | Key Driver |
|---|---|---|
| CRB / Credit History | 12 | Credit bureau status + repayment history |
| Yara Relationship | 10 | Years as Yara customer + product count |
| Social Capital | 8 | Group membership + savings − dependent penalty |

### 9.5 Loan Amount Calculation

`maxLoanAmountKes = creditScore_multiplier × requestedAmountKes`

- APPROVE → 100% of requested (up to product ceiling)
- CONDITIONAL → 80%
- DECLINE → 60%
- STRONG_DECLINE → 0%

Subject to hard ceiling: `scoring.group.max_loan_ceiling_kes` (default: KES 500,000) and supervisor review if `scoring.group.supervisor_review_kes` threshold exceeded.

---

## 10. ILP — Individual Loan Product System

### 10.1 Overview

ILP targets three segments of borrowers who have outgrown group lending:

| Segment | Loan Range | Max Term |
|---|---|---|
| FARMER | KES 100,000–500,000 | 24 months |
| LANDLORD | KES 200,000–1,000,000 | 36 months |
| SHOP_OWNER | KES 100,000–500,000 | 24 months |

### 10.2 Branch Eligibility Gate

Before any ILP loan can be originated, an admin must grant the branch eligibility for that segment. Requirements validated:
- PAR30 < 5%
- Customer retention > 70%
- Portfolio growth > 20%

**Progressive unlock:** Branch must reach MASTERED status (demonstrated sustained performance) in segment 1 before segment 2 can be unlocked. Maximum 2 active segments at any time.

### 10.3 ILP Workflow

```
1. Admin grants branch eligibility for a segment
2. LO conducts ILP interview (25 questions, 5 sections)
3. LO opens ILP wizard on CustomerProfile
4. Wizard Step 0: checks interview completed + branch eligible
5. Steps 1–3: Assessment forms auto-populate from interview answers
6. Step 4: 12-month cash flow table + live DSR indicator
7. Step 5: Collateral with per-item valuation
8. Step 6: Review — composite score + assessor notes
9. Submit → LoanApplication + ILPAssessment saved in transaction
10. → Existing BCC → Approval → Disbursement
11. At disbursement: follow-up schedule auto-generated + KPI flags derived
```

### 10.4 Interview to Wizard Mapping

| Interview Section | ILP Wizard Step |
|---|---|
| A: Background & Experience | Step 1: Owner Assessment |
| B: Business/Property/Shop Profile | Step 2: Business Assessment |
| C: Operational Risk | Step 3: Operational Risk |
| D: Cash Flow | Step 4: Cash Flow (pre-populates fields) |
| E: Loan Purpose & Collateral | Step 5: Collateral + Step 6: Notes |

### 10.5 DSR Hard Block

`DSR = (existingMonthlyDebt + newInstallment) / totalMonthlyIncome × 100`

- **≤30%** → Score 100 (excellent)
- **30–35%** → Score 80
- **35–40%** → Score 60
- **40–45%** → Score 40
- **45–50%** → Score 0
- **>50%** → ❌ **HARD BLOCK** — application cannot be submitted regardless of other scores

### 10.6 Follow-Up Schedule

Auto-generated at disbursement. Cycle 1 (first ILP loan) is intensive:

| Timing | Visit Type | Purpose |
|---|---|---|
| Day 7 | FIELD_VISIT | Fund deployment verification |
| Month 1 | FIELD_VISIT | Business check-in |
| Month 2 | PHONE_CALL | Payment follow-up |
| Month 3 | FIELD_VISIT | Mid-term business review |
| Month 6 | FIELD_VISIT | Closing assessment + cycle 2 eligibility |

Cycle 2 (repeat ILP loan) uses a lighter touch: fewer visits, more phone calls.

---

## 11. KPI Monitoring & Risk Flags

### 11.1 Derivation at Disbursement

When an ILP loan is disbursed, `kpiService.deriveKPIFlags()` reads the ILP assessment and application data to create initial risk flags:

**Financial Capacity Flags:**
- `dsr_elevated` — DSR 40–50% (YELLOW)
- `no_savings_buffer` — No emergency savings (YELLOW)
- `shock_no_buffer` — Income shock + no savings (RED)
- `single_income_source` — Only one income stream (YELLOW)

**Business Performance Flags:**
- `subsistence_market` — Farmer selling only subsistence (YELLOW)
- `low_business_score` — Business dimension score <50 (RED)
- `low_occupancy` — Landlord occupancy <70% (YELLOW)
- `new_business` — Shop open <1 year (YELLOW)

**Operational Risk Flags:**
- `rain_fed_only` — No irrigation (YELLOW)
- `no_storage` — No on-farm storage (YELLOW)
- `no_insurance` — Low operational risk score implies no insurance (YELLOW)
- `high_operational_risk` — Operational risk score <35 (RED)

**Repayment Behaviour Flags (dynamic):**
- `arrears_7d` — 7+ days overdue (YELLOW) — auto-resolves when current
- `arrears_30d` — 30+ days overdue (RED) — auto-resolves when current

**Collateral Flags:**
- `weak_collateral` — Collateral score <40 (YELLOW)

### 11.2 Refresh Cycle

`refreshKPIFlags()` is called after:
- LO marks a follow-up complete
- Repayment is recorded (re-evaluates arrears flags)

Resolved flags get `isActive = false` + `resolvedAt` timestamp. New flags matching still-active conditions remain or are created.

### 11.3 LO Worklist (`/worklist`)

The unified worklist (`LOWorklist.tsx`) shows all pending `ILPFollowUp` records across all of the LO's active ILP customers, sorted:
1. OVERDUE (past due date)
2. TODAY (due today)
3. THIS WEEK
4. UPCOMING

KPI_CHECK tasks display in amber with suggested questions and actions from the `FLAG_GUIDANCE` lookup map. Milestone visits display in blue.

---

## 12. Customer Award & Loyalty Tiers

Loyalty tiers incentivise on-time repayment and customer retention. The tier is computed automatically after each loan completion and applied as a discount on the next loan application.

### Tier Snapshot at Application

When a new application is submitted (`applyForLoan`):
1. `awardService.computeCustomerTier(completedLoans)` is called
2. The tier is **snapshotted** on the application: `customerTierAtApplication`
3. Discounts are applied to `interestRatePct` and stored as `interestRateDiscountPct`, `processingFeeDiscountPct`

The LoanApplicationForm shows a green "Loyalty Discount Applied" box on the review step if the tier is above STANDARD. LoanDetail shows the tier badge at the time of application.

---

## 13. M-Pesa AI Analysis

### 13.1 Upload Flow

```
LO uploads PDF statement → POST /customers/:id/mpesa (multipart)
    ↓
mpesaController.uploadStatement()
    ↓
File stored encrypted → MpesaStatement record (status: PENDING)
    ↓
Background AI analysis job triggered
    ↓
AI reads statement → extracts transactions → applies risk models
    ↓
MpesaStatement updated: status: COMPLETE + analysis fields
```

### 13.2 Analysis Outputs

| Field | Description |
|---|---|
| `overallRiskLevel` | LOW / MEDIUM / HIGH / VERY_HIGH |
| `recommendedAction` | Human-readable recommendation |
| `detectedLoans` | Suspected undisclosed loan repayments |
| `suspiciousPatterns` | Unusual or circular transaction flows |
| `gamblingTransactions` | Betting platform transactions |
| `positiveIndicators` | Evidence of business cash flows |
| `avgMonthlyInflow` | Average monthly income |
| `avgMonthlyOutflow` | Average monthly expenditure |
| `fulizaUsageCount` | M-Pesa Fuliza micro-loan frequency |

### 13.3 Risk Escalation

If analysis returns `VERY_HIGH` risk or a `DECLINE` recommendation, the LO must enter a written justification before proceeding to the loan application. This override is stored and visible to the BCC during review.

### 13.4 AI Health Assessment

**Route:** `POST /api/ai/health-assessment`
**Rate limit:** 10 requests per hour per user
Accepts photos of crops, livestock, or equipment and returns an AI-generated health/condition assessment. Used in the Field Hub for rapid farm surveys.

---

## 14. Data Quality Engine

The quality engine runs automatically at key points and can also be triggered on-demand.

### 14.1 Automatic Triggers

| Trigger Point | Checks Run |
|---|---|
| Customer creation | Name duplicate check (live, before form submit) |
| Customer creation (post-save) | Full customer scan |
| Application submission | Application quality scan |

### 14.2 Flag Severity

| Severity | Meaning |
|---|---|
| INFO | Advisory — no action required |
| WARNING | Should investigate before proceeding |
| CRITICAL | Must resolve before application can be submitted |

### 14.3 Quality Dashboard

`/quality` (visible to SUPERVISOR, BM, ADMIN) shows:
- Total open flags by severity and type
- Customers with unresolved CRITICAL flags
- Branch quality score
- Resolution history

Flags can be dismissed with a note (logged to audit trail).

---

## 15. Branch Credit Committee (BCC)

### 15.1 Purpose

The BCC is the formal credit approval body. A quorum of LOs, Supervisors, and the Branch Manager review each loan application before disbursement.

### 15.2 BCC Flow

```
BM opens BCC session for application
    ↓
LOs and Supervisors cast votes (ENDORSE / REFUSE / ABSTAIN)
    ↓
Discussion via comments thread
    ↓
BM records final decision (APPROVED / REFUSED / REFERRED / CONDITIONAL)
    ↓
Loan application status auto-updates:
    APPROVED → application.status = APPROVED
    REFUSED → application.status = REJECTED
    CONDITIONAL → application.status = CONDITIONALLY_APPROVED
```

### 15.3 BCC Session Visibility

- BCC session shows: full loan application, credit score breakdown, ILP composite score (if ILP), M-Pesa risk summary, collateral details.
- All votes and comments are recorded in the audit trail.
- Sessions expire after a configurable period if no decision is made.

---

## 16. Collections & Arrears

### 16.1 Arrears Detection

Loans are flagged as overdue when `daysInArrears > 0`. The arrears counter is updated when repayments are recorded. A batch check endpoint can be triggered to scan all active loans.

### 16.2 Collection Actions

| Action Type | Trigger |
|---|---|
| `AUTO_ALERT` | System-generated on first overdue day |
| `PHONE_CALL` | LO calls customer |
| `SMS_SENT` | SMS reminder sent |
| `FIELD_VISIT` | LO visits customer in person |
| `PROMISE_TO_PAY` | Customer commits to payment date + amount |
| `PARTIAL_PAYMENT` | Below-schedule payment received |
| `DEMAND_LETTER` | Formal written demand |
| `LEGAL_NOTICE` | Pre-litigation notice |
| `WRITE_OFF_RECOMMENDED` | LO escalates to BM for write-off |
| `RESTRUCTURED` | Repayment terms modified |

### 16.3 Escalation Stages

| Stage | Days Overdue | Action |
|---|---|---|
| 1 | 1–30 days | Reminder; phone call |
| 2 | 31–60 days | Field visit required |
| 3 | 61–90 days | Formal demand notice |
| 4 | 90+ days | Escalate to write-off committee |

---

## 17. Field Operations

### 17.1 Field Hub (`/field`)

Central hub for LOs operating in the field. Provides:

- **GPS Ping** — Records current location (`POST /admin/locations/ping`). Used by management to track field coverage.
- **Farm Survey** — Structured form capturing farm condition, crop status, inputs used.
- **Health Assessment** — Photo capture with AI analysis for crop disease, pest, or animal health issues.

### 17.2 Location Tracking

Location pings are stored in `LocationPing` records. Admins and BMs can view the location history map at `/admin/locations` to verify field visit coverage.

---

## 18. Benchmarks & Market Data

### 18.1 Purpose

The benchmarks module provides LOs and scorers with reference data to contextualise customer-reported figures. If a customer reports monthly farm income of KES 50,000 but the KNBS benchmark for maize farming in their county is KES 8,000–12,000, this is a significant quality concern.

### 18.2 Data Sources

Supported sources include KNBS, KTDA, and internally collected Juhudi data. Each source has a name, update frequency, and last-checked timestamp.

### 18.3 Benchmark Categories

| Category | Description |
|---|---|
| `FOOD_NUTRITION` | Cost of food basket |
| `ACCOMMODATION` | Rent / housing costs |
| `TRANSPORT` | Transport costs |
| `EDUCATION` | School fees |
| `HEALTHCARE_UTILITIES` | Medical and utility costs |
| `CLOTHING_PERSONAL` | Personal expense benchmarks |
| `CROP_INCOME` | Income per acre by crop type |
| `LIVESTOCK_INCOME` | Livestock income benchmarks |
| `LABOUR_WAGES` | Agricultural labour rates |
| `AGRICULTURAL_INPUTS` | Seed, fertiliser, pesticide costs |

### 18.4 Lookup API

`GET /benchmarks/lookup?category=CROP_INCOME&county=Meru` returns the applicable benchmark range (low / mid / high) for the specified criteria.

---

## 19. System Configuration

### 19.1 Business Constants Admin UI

All 162 tunable business constants are editable by Admins via `/admin/config`. The UI groups constants by category, supports inline editing, and shows last-modified user and timestamp.

### 19.2 Config Categories

| Category | Example Keys |
|---|---|
| Award Tiers | `award.bronze.min_cycles`, `award.gold.rate_discount` |
| Group Loan Scoring | `scoring.group.approve_threshold`, `scoring.group.monthly_rate_pct` |
| Group Cashflow | `scoring.group.cashflow.dti.threshold_excellent` |
| Group Ability | `scoring.group.ability.farm.threshold_large` |
| Group Willingness | `scoring.group.will.yara.score_4plus` |
| ILP Weights | `ilp.weight.owner`, `ilp.weight.cashflow` |
| ILP Thresholds | `ilp.threshold.approve`, `ilp.cashflow.dsr.hard_block_pct` |
| ILP Collateral | `ilp.collateral.score_over2`, `ilp.collateral.bonus_title` |
| ILP Eligibility | `ilp.eligibility.max_par30_pct`, `ilp.eligibility.min_retention_pct` |
| KPI Follow-up | `kpi.followup.red_flag_days`, `kpi.followup.no_flag_days` |
| KPI Flags | `kpi.flag.dsr.yellow_pct`, `kpi.flag.arrears.red_days` |
| Data Quality | `quality.name_sim.same_branch_threshold`, `quality.gps_radius_metres` |
| Interview Weights | `interview.weight.s2_farming`, `interview.weight.s5_character` |
| Interview Thresholds | `interview.threshold.approve_pct` |

### 19.3 Config Update Flow

```
Admin edits value in SystemConfigPage
    ↓
PATCH /api/config/:key
    ↓
configController.updateConfig()
    ↓
Validate: isEditable, minValue ≤ value ≤ maxValue, correct type parse
    ↓
Write to system_configs table
    ↓
Write to audit_logs (who changed what, old value → new value)
    ↓
configService.refresh()  ← immediately updates in-memory cache
    ↓
All subsequent scoring/service calls use new value (within seconds)
```

---

## 20. Security & Compliance

### 20.1 Kenya Data Protection Act 2019

All PII is encrypted at rest using AES-256-GCM:
- National ID numbers
- Phone numbers (primary and M-Pesa)
- Bank account details
- Document file paths (KYC documents, M-Pesa statements, CRB reports)

Search on encrypted fields uses HMAC hashes stored in separate columns (`phoneHash`, `nationalIdHash`).

### 20.2 CBK Microfinance Guidelines

- Credit scoring framework follows the Cash Flow / Ability / Willingness model recommended by CBK.
- Maximum repayment ratio (DSR) enforced: 40% for group loans (configurable); 50% hard block for ILP.
- AML checks: each customer has an `amlStatus` (PENDING / CLEAR / FLAGGED / BLOCKED). BLOCKED customers cannot have applications submitted.
- KYC must reach VERIFIED before a loan application can be submitted.

### 20.3 API Security

- **Helmet** sets security headers (CSP, HSTS with preload, no frames, no objects).
- **CORS** — explicit allow-list + LAN subnet (172.16.12.0/24) for field tablets.
- **Rate limiting** — 100 req/15 min globally; 10 req/15 min on `/auth/login`; 10 req/hour on AI health assessment.
- **JWT tokens** — RS256 / HS256 signed; configurable expiry; `mustChangePass` flag forces password change before any other action.

### 20.4 Politically Exposed Persons (PEP)

Customers can be flagged as PEPs (`isPEP = true`) with details stored. PEP status triggers additional review requirements.

---

## 21. Audit Logging

### 21.1 Audit Log Records

Every significant write operation creates an `AuditLog` record containing:

| Field | Description |
|---|---|
| `userId` | Who performed the action |
| `action` | Operation type (e.g. `UPDATE_CUSTOMER`, `DISBURSE_LOAN`, `UPDATE_CONFIG`) |
| `entity` | Table/entity affected |
| `entityId` | ID of the affected record |
| `changes` | JSON diff of old → new values |
| `ipAddress` | Client IP |
| `userAgent` | Client user agent |

### 21.2 Audit Middleware

The `auditLog()` middleware factory can be applied to any route:

```typescript
router.patch('/:key', auditLog({ action: 'UPDATE_CONFIG', entity: 'system_configs' }), asyncHandler(updateConfig));
```

It captures the request body and records the outcome after the handler resolves.

### 21.3 Audit Log Viewer

Admins and BMs can view the audit trail at `/admin/activity`. Filterable by user, action type, and date range.

---

## Appendix A — Enum Reference

| Enum | Values |
|---|---|
| `UserRole` | ADMIN, BRANCH_MANAGER, SUPERVISOR, LOAN_OFFICER |
| `KYCStatus` | PENDING, SUBMITTED, VERIFIED, REJECTED, REQUIRES_UPDATE |
| `AMLStatus` | PENDING, CLEAR, FLAGGED, BLOCKED |
| `LoanStatus` | PENDING_DISBURSEMENT, ACTIVE, COMPLETED, DEFAULTED, WRITTEN_OFF |
| `ApplicationStatus` | DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, CONDITIONALLY_APPROVED, REJECTED, WITHDRAWN |
| `CustomerTier` | STANDARD, BRONZE, SILVER, GOLD, PLATINUM |
| `LoanType` | INDIVIDUAL, GROUP |
| `ILPSegment` | FARMER, LANDLORD, SHOP_OWNER |
| `ILPEligibilityStatus` | NOT_ELIGIBLE, ELIGIBLE, MASTERED |
| `RiskFlagSeverity` | YELLOW, RED |
| `RiskFlagCategory` | FINANCIAL_CAPACITY, BUSINESS_PERFORMANCE, REPAYMENT_BEHAVIOR, OPERATIONAL_RISK, COLLATERAL_RISK |
| `BccStatus` | OPEN, DECIDED, OVERRIDDEN, EXPIRED |
| `BccOutcome` | APPROVED, REFUSED, REFERRED, CONDITIONAL |
| `VoteType` | ENDORSE, REFUSE, ABSTAIN |
| `MpesaAnalysisStatus` | PENDING, PROCESSING, COMPLETE, FAILED |
| `InterviewStatus` | DRAFT, COMPLETED |
| `ConfigDataType` | NUMBER, PERCENTAGE, AMOUNT_KES, DAYS, MONTHS, RATIO, BOOLEAN, SCORE_POINTS |
| `CollateralType` | TITLE_DEED, MOTOR_VEHICLE, CHATTEL, LIVESTOCK, CROP_LIEN, SALARY_ASSIGNMENT, GROUP_GUARANTEE, PERSONAL_GUARANTEE, SAVINGS_DEPOSIT, OTHER |
| `CollectionActionType` | AUTO_ALERT, PHONE_CALL, SMS_SENT, FIELD_VISIT, PROMISE_TO_PAY, PARTIAL_PAYMENT, DEMAND_LETTER, LEGAL_NOTICE, WRITE_OFF_RECOMMENDED, RESTRUCTURED, OTHER |

---

## Appendix B — File Structure

```
juhudi/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # All 32 models + enums
│   │   ├── seed.ts                 # Seed loan products, branch, admin user
│   │   └── seed-config.ts          # Seed 162 system_config defaults with metadata
│   └── src/
│       ├── config/
│       │   ├── index.ts            # Environment variable validation
│       │   └── database.ts         # Prisma client singleton
│       ├── controllers/
│       │   ├── authController.ts
│       │   ├── customerController.ts
│       │   ├── loanController.ts
│       │   ├── groupController.ts
│       │   ├── scoringController.ts
│       │   ├── interviewController.ts
│       │   ├── bccController.ts
│       │   ├── collectionsController.ts
│       │   ├── qualityController.ts
│       │   ├── adminController.ts
│       │   ├── mpesaController.ts
│       │   ├── aiController.ts
│       │   ├── benchmarkController.ts
│       │   ├── ilpController.ts
│       │   └── configController.ts
│       ├── middleware/
│       │   ├── auth.ts             # authenticate + authorize
│       │   ├── errorHandler.ts     # AppError + global error handler
│       │   └── audit.ts            # auditLog() middleware factory
│       ├── routes/
│       │   ├── index.ts            # Route aggregator
│       │   ├── auth.ts
│       │   ├── customers.ts
│       │   ├── loans.ts
│       │   ├── groups.ts
│       │   ├── scoring.ts
│       │   ├── interviews.ts
│       │   ├── bcc.ts
│       │   ├── collections.ts
│       │   ├── quality.ts
│       │   ├── documents.ts
│       │   ├── branches.ts
│       │   ├── benchmarks.ts
│       │   ├── mpesa.ts
│       │   ├── ai.ts
│       │   ├── admin.ts
│       │   ├── ilp.ts
│       │   └── config.ts
│       ├── services/
│       │   ├── configDefaults.ts   # 162 default constant values
│       │   ├── configService.ts    # In-memory cache with 5-min TTL
│       │   ├── creditScoring.ts    # Group loan scoring engine
│       │   ├── ilpScoringService.ts# ILP 5-dimension scoring
│       │   ├── awardService.ts     # Loyalty tier computation
│       │   ├── kpiService.ts       # KPI risk flag derivation + scheduling
│       │   ├── qualityService.ts   # Data quality checks
│       │   └── encryption.ts      # AES-256-GCM PII encryption
│       ├── utils/
│       │   ├── asyncHandler.ts     # Express async error wrapper
│       │   └── logger.ts           # Winston logger
│       ├── app.ts                  # Express app setup (middleware, routes)
│       └── server.ts               # Server startup + graceful shutdown
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Layout/             # Sidebar, Header, Layout wrapper
│       │   ├── common/             # Badges, gates, quality/risk components
│       │   ├── ilp/                # 8 ILP assessment form components
│       │   └── AmortisationTable.tsx
│       ├── pages/
│       │   ├── admin/              # User, branch, config, ILP eligibility, M-Pesa monitor
│       │   ├── bcc/                # BCC session list + detail
│       │   ├── benchmarks/
│       │   ├── collections/
│       │   ├── customers/          # List, onboarding, profile, edit
│       │   ├── field/              # Field hub, farm survey, health assessment
│       │   ├── groups/             # Group list, form, profile
│       │   ├── interviews/         # Standard + ILP interview forms, list
│       │   ├── loans/              # Standard + ILP application, detail, follow-up, worklist
│       │   ├── quality/
│       │   └── scoring/
│       ├── services/
│       │   └── api.ts              # All API functions (axios)
│       ├── types/
│       │   └── index.ts            # TypeScript types for all models
│       ├── utils/
│       │   └── ilpScoring.ts       # Frontend mirror of ILP scoring (live preview)
│       ├── store/                  # Zustand auth store
│       └── App.tsx                 # React Router routes + guards
└── docs/
    └── system-overview.md          # This document
```
