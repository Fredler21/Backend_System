<div align="center">

# ⚙️ Edlight Initiative — Backend System

**A scalable, TypeScript-first backend infrastructure powering the Edlight educational platform.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Overview](#-overview) · [Features](#-key-features) · [Tech Stack](#-technology-stack) · [Architecture](#-architecture-overview) · [Structure](#-project-structure) · [Setup](#-getting-started) · [Roadmap](#-roadmap)

</div>

---

## 📖 Overview

**Edlight Initiative** is an educational technology platform built to connect students, developers, and educators with tools and resources that accelerate learning and collaboration. This repository contains the **core backend infrastructure** — the foundational layer that every service on the platform depends on.

The backend is engineered from the ground up in **TypeScript**, prioritizing type safety, maintainability, and developer experience. It implements a **centralized authentication model**: users create a single account and gain seamless access to every tool, project, and module across the Edlight ecosystem — no repeated registrations, no fragmented identities.

### What this system handles today

- **User Management** — Account creation, profile management, and secure credential storage.
- **Authentication & Authorization** — JWT-based login flows with role-based access control (RBAC).
- **API Gateway** — Structured RESTful API layer for communication between the platform frontend and backend services.

### What it's built to become

The architecture is intentionally modular. Every service boundary, database schema, and middleware layer is designed to support the platform's expansion into a full-scale educational backend — without requiring rewrites.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Centralized Auth** | Single sign-on model — one account unlocks the entire platform. |
| **Role-Based Access Control** | Granular permissions for `student`, `developer`, and `admin` roles. |
| **Secure Credential Storage** | Passwords hashed with bcrypt; sensitive data encrypted at rest. |
| **JWT Authentication** | Stateless, token-based auth with refresh token rotation. |
| **Input Validation** | Request payloads validated and sanitized at the middleware layer. |
| **Modular Architecture** | Service-oriented structure ready for horizontal feature expansion. |
| **Type-Safe Codebase** | End-to-end TypeScript with strict compiler options enabled. |
| **Error Handling** | Centralized error middleware with structured, consistent API responses. |
| **Environment Configuration** | Secure config management via environment variables with validation. |
| **Database Abstraction** | ORM-backed data layer with migration support for safe schema evolution. |

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript 5.x (strict mode) |
| **Runtime** | Node.js 20.x LTS |
| **Framework** | Express.js |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Authentication** | JSON Web Tokens (jsonwebtoken) + bcrypt |
| **Validation** | Zod |
| **Testing** | Jest + Supertest |
| **Linting & Formatting** | ESLint + Prettier |
| **API Documentation** | Swagger / OpenAPI 3.0 |
| **Containerization** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 🏗 Architecture Overview

The system follows a **layered, modular architecture** that cleanly separates concerns and enables independent scaling of each domain.

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                       │
│               (Web App · Mobile · CLI)                  │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│          Rate Limiting · CORS · Request Logging         │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌─────────┐ ┌──────────┐
   │    Auth    │ │  Users  │ │  Roles & │
   │  Service   │ │ Service │ │  Perms   │
   └─────┬──────┘ └────┬────┘ └────┬─────┘
         │              │           │
         ▼              ▼           ▼
┌─────────────────────────────────────────────────────────┐
│                   Middleware Layer                       │
│     Auth Guard · Validation · Error Handler · Logger    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Access Layer                     │
│              Prisma ORM · Query Builders                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     PostgreSQL                          │
│            Migrations · Seeds · Backups                 │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

- **Separation of Concerns** — Routes, controllers, services, and data access are cleanly decoupled.
- **Dependency Injection** — Services are composed, not hard-wired, enabling testability and flexibility.
- **Fail-Safe Defaults** — Secure by default. Auth middleware rejects requests unless explicitly allowed.
- **Schema-Driven Validation** — Every request is validated against a Zod schema before reaching business logic.

---

## 📁 Project Structure

```
backend-system/
├── src/
│   ├── config/              # Environment variables, app configuration
│   │   └── env.ts
│   ├── modules/             # Feature modules (domain-driven)
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schema.ts       # Zod validation schemas
│   │   │   └── auth.test.ts
│   │   └── users/
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       ├── users.routes.ts
│   │       ├── users.schema.ts
│   │       └── users.test.ts
│   ├── middleware/           # Express middleware
│   │   ├── authenticate.ts       # JWT verification guard
│   │   ├── authorize.ts          # Role-based access control
│   │   ├── validate.ts           # Request validation
│   │   └── errorHandler.ts       # Centralized error handling
│   ├── shared/              # Shared utilities & types
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants.ts
│   ├── database/            # Database client & seed scripts
│   │   ├── prisma.ts
│   │   └── seed.ts
│   ├── app.ts               # Express app initialization
│   └── server.ts            # Entry point — starts the server
├── prisma/
│   ├── schema.prisma        # Database schema definition
│   └── migrations/          # Auto-generated migration files
├── tests/                   # Integration & E2E tests
├── docker/
│   └── Dockerfile
├── .env.example             # Environment variable template
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── jest.config.ts
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20.x |
| npm / yarn / pnpm | Latest |
| PostgreSQL | ≥ 15 |
| Docker *(optional)* | ≥ 24.x |

### Installation

```bash
# Clone the repository
git clone https://github.com/Fredler21/Backend_System.git
cd Backend_System

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# → Edit .env with your database URL, JWT secret, etc.
```

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/edlight_db

# Authentication
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
BCRYPT_SALT_ROUNDS=12
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed initial data (roles, admin account)
npx prisma db seed
```

### Run the Server

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### Run with Docker

```bash
# Start all services (app + database)
docker-compose up --build

# Run in detached mode
docker-compose up -d
```

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account | Public |
| `POST` | `/api/auth/login` | Authenticate and receive tokens | Public |
| `POST` | `/api/auth/refresh` | Refresh access token | Token |
| `POST` | `/api/auth/logout` | Invalidate refresh token | Token |

### Users

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/users/me` | Get current user profile | Token |
| `PATCH` | `/api/users/me` | Update current user profile | Token |
| `GET` | `/api/users` | List all users | Admin |
| `GET` | `/api/users/:id` | Get user by ID | Admin |
| `DELETE` | `/api/users/:id` | Delete a user account | Admin |

> Full API documentation available at `/api/docs` when the server is running (Swagger UI).

---

## 🗺 Roadmap

The backend is designed as the **foundation layer** for a growing platform. Here's what's ahead:

### Phase 1 — Core Infrastructure ✅ *(Current)*
- [x] User registration and account management
- [x] JWT authentication with refresh tokens
- [x] Role-based access control (Student / Developer / Admin)
- [x] Secure credential storage (bcrypt)
- [x] Input validation and error handling
- [x] Database schema and migrations

### Phase 2 — Platform Services
- [ ] **Course Module** — CRUD for courses, lessons, and enrollments
- [ ] **Scholarship Module** — Application submissions, review workflows, status tracking
- [ ] **Coding Projects** — Project creation, submission, and peer review system

### Phase 3 — Engagement & Analytics
- [ ] **User Dashboard** — Personalized dashboard with progress tracking
- [ ] **Activity Tracking** — Platform-wide event logging and analytics
- [ ] **Notification Service** — Email and in-app notifications

### Phase 4 — Platform Maturity
- [ ] **OAuth 2.0 Integration** — Sign in with Google, GitHub
- [ ] **File Upload Service** — Secure document and media storage (S3-compatible)
- [ ] **Rate Limiting & Throttling** — API abuse protection
- [ ] **WebSocket Support** — Real-time updates for dashboards and notifications
- [ ] **Admin Panel API** — Platform management endpoints for administrators

### Phase 5 — Scale & Reliability
- [ ] **Caching Layer** — Redis-backed caching for high-traffic endpoints
- [ ] **Queue System** — Background job processing (email delivery, data exports)
- [ ] **Monitoring & Observability** — Structured logging, health checks, APM integration
- [ ] **Multi-Tenancy Support** — Isolated environments for partner institutions

---

## 🤝 Contributing

Contributions are welcome. Please read the contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

> Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with discipline.** Designed to scale.

*Edlight Initiative — Empowering learners through technology.*

</div>
