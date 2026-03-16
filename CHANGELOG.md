# Changelog

All notable changes to Juhudi Kilimo will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), using [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-03-14

### Added
- **Backend API** (Express 4, Prisma ORM, PostgreSQL)
  - Authentication module with JWT, bcrypt password hashing
  - Customer management: onboarding, profiles, groups, interviews
  - Loan processing: applications, approvals, disbursement, amortisation
  - Credit scoring engine with configurable scoring models
  - ILP (Individual Lending Product) system: applications, scoring, follow-up, collateral
  - BCC (Branch Credit Committee): case presentation, meetings, conditions, flags
  - Collections management and tracking
  - M-Pesa integration: payment processing, statement analysis, monitoring
  - AI module: document analysis, extraction (PDF/DOCX/XLSX), Claude integration
  - Weather data service for agricultural risk assessment
  - Benchmark management and KPI tracking
  - Quality assurance: flags, scoring, dashboard
  - System configuration management
  - Admin module: users, branches, locations, activity logs
  - Notification system with SSE (Server-Sent Events)
  - Audit middleware for change tracking
  - Document upload and encrypted storage
- **Frontend** (React 18, Vite, Tailwind CSS, TanStack Query, Zustand)
  - Login and authentication
  - Dashboard with KPIs and portfolio overview
  - Customer pages: list, profile, onboarding wizard, edit, M-Pesa statements
  - Loan pages: applications, detail, worklist, application form, ILP application
  - Interview system: customer interviews, ILP interviews, interview list
  - BCC pages: case list, case detail, meeting detail, analytics
  - Group management: list, profile, form
  - Collections management page
  - Credit scoring page
  - Quality dashboard
  - Benchmarks page with charts (Recharts)
  - Field hub: farm survey, health assessment with camera capture
  - Weather widget with agricultural advisories
  - Admin pages: users, branches, locations, activity, ILP eligibility, M-Pesa monitor, system config
  - Sidebar navigation with role-based menu items
  - Notification bell with SSE real-time updates
  - Offline support: IndexedDB storage, offline sync, PWA
  - Speech recognition for interview data entry
  - Map integration (Leaflet) for location tracking
  - Award tier badges and customer journey tracking
- **Infrastructure**: Docker Compose (PostgreSQL, Redis), Docker deployment configs (backend + frontend with Nginx)
- **Documentation**: System overview, architecture and deployment guide
- **Database seed**: sample users, customers, loans, benchmarks, system config
