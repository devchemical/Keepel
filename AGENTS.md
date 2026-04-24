# AGENTS.md - Keepel (CarCare)

**Complete automotive maintenance management system**

This document provides context for AI agents working on this project. It follows the [AGENTS.md](https://agents.md/) open standard — a tool-agnostic interface for specifying project needs.

---

## Project Overview

### Identity

- **Project Name**: Keepel (formerly CarCare)
- **Purpose**: Web application to manage vehicle maintenance
- **Type**: Web Application
- **License**: MIT
- **Repository**: https://github.com/devchemical/CarCare
- **Demo**: https://keepel.chemicaldev.com

### Description

Keepel lets users:

- Register and manage multiple vehicles
- Track complete maintenance history
- Schedule future services
- Monitor maintenance costs
- View statistics and reports
- Access from any device (responsive, mobile-friendly)

---

## Tech Stack (Tool-Agnostic)

This project uses the following technologies. Agents should understand these regardless of which tool is being used.

### Frontend

| Category   | Technology                               |
| ---------- | ---------------------------------------- |
| Framework  | Next.js 16.x (App Router)                |
| UI Library | React 19.x                               |
| Language   | TypeScript 5.x                           |
| Styling    | TailwindCSS 4.x                          |
| Components | shadcn/ui (Radix UI primitives)          |
| Icons      | lucide-react                             |
| Forms      | react-hook-form + zod                    |
| Charts     | recharts                                 |
| Fonts      | next/font/google (Inter, JetBrains Mono), Geist |
| Toasts     | sonner                                   |
| Themes     | next-themes                              |
| Dates      | date-fns                                 |

### Backend & Database

| Category      | Technology                          |
| ------------- | ----------------------------------- |
| Backend       | Supabase (BaaS)                     |
| Database      | PostgreSQL (via Supabase)           |
| Auth          | Supabase Auth (JWT + OAuth Google)  |
| Storage       | Supabase Storage                    |
| Security      | Row Level Security (RLS)            |
| Rate Limiting | @upstash/ratelimit + @upstash/redis |
| Analytics     | @vercel/analytics, @openpanel/nextjs |

### Build & Tools

| Category        | Technology                   |
| --------------- | ---------------------------- |
| Package Manager | bun                          |
| Bundler         | Turbopack (Next.js built-in) |
| Linting         | Oxlint                       |
| Formatting      | Oxfmt                        |

---

## What This Project Needs (Not Which Tools to Use)

### Development Environment

- Node.js 18+ runtime
- A code editor with TypeScript support

### Building & Testing

```bash
bun dev              # Development server
bun build            # Production build
bun start            # Start production build
bun lint             # oxlint
bun type-check       # TypeScript check without emitting
bun format           # oxfmt format
bun format:check     # Check formatting without writing
bun clean            # Remove .next cache
bun clean:install    # Clean + reinstall dependencies
```

### Authentication

This project requires Supabase and Upstash Redis for rate limiting. Configure these environment variables:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Upstash Redis for rate limiting (required in production)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email redirect after signup
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=https://keepel.chemicaldev.com/
```

---

## Project Knowledge (Tool-Agnostic)

### Architecture

The app follows a clean architecture with these layers:

- **App Router** (`app/`) — Pages, layouts, Server Actions, API routes
- **Components** (`components/`) — UI and feature components
- **Contexts** (`contexts/`) — React Contexts for auth and data state
- **Hooks** (`hooks/`) — Custom React hooks
- **Lib** (`lib/`) — Utilities, Supabase clients, auth manager

### Key Patterns

#### Authentication Flow

The auth system is event-driven with three layers:

1. **AuthManager** — Singleton that manages Supabase client and broadcasts state changes via BroadcastChannel
2. **AuthProvider** — React context that exposes user, profile, signOut
3. **DataProvider** — Loads vehicles and maintenance with optimistic updates

#### Data Flow

```
Server Component → createClient() → Supabase
Client Component → useSupabase() from context
```

#### Route Protection

- `/auth/*` — Guest-only (redirects authenticated users to `/`)
- `/vehicles/*` — Protected (redirects unauthenticated users to `/auth/login`)

### Database Schema

Three main tables with RLS:

- **profiles** — User profiles (1:1 with auth.users)
- **vehicles** — User vehicles (1:N with profiles)
- **maintenance_records** — Service records (1:N with vehicles)

### Design System

- **Themes**: Light / Dark / System mode via next-themes
- **Styling**: TailwindCSS 4.x with CSS-based config (no tailwind.config.js)
- **Fonts**: Inter (UI), JetBrains Mono (code), Geist Sans/Mono
- **Toasts**: sonner (not use-toast)

---

## Code Conventions

### Naming

- **Files**: kebab-case.tsx (except contexts and some components use PascalCase)
- **Components**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase

### Import Order

1. React and Next.js
2. External libraries
3. Contexts and hooks
4. UI components
5. Lib utilities
6. Types

### React Patterns

- Use `'use client'` directive when using hooks, state, or browser APIs
- Server Components don't need the directive
- Always authenticate inside Server Actions
- Use optimistic updates for mutations

---

## AI Agent Skills

This project has skills for common tasks. Load them when working on specific areas.

### Project-specific skills

These skills encode architecture and framework guidance specific to this codebase.

### `next-best-practices`

**When to load**: Writing or reviewing Next.js code — pages, layouts, Route Handlers, Server Actions, metadata, fonts, images, RSC boundaries.

### `vercel-react-best-practices`

**When to load**: Writing, reviewing, or refactoring React components — performance, data fetching, bundle size, re-renders.

### `supabase-postgres-best-practices`

**When to load**: Writing, reviewing, or optimizing SQL, database schema, RLS policies, indexes.

### `web-design-guidelines`

**When to load**: Reviewing UI code, checking accessibility, auditing design.

### Workflow skills

These skills define execution process and should be used by OpenCode when the task intent matches.

- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `test-driven-development`
- `debugging-and-error-recovery`
- `code-review-and-quality`
- `code-simplification`
- `api-and-interface-design`
- `frontend-ui-engineering`
- `shipping-and-launch`

---

## OpenCode Execution Rules

For OpenCode, use a skill-first workflow powered by the local `skills/` directory.

### Skill location

- Skills are located in `.agents/skills/<skill-name>/SKILL.md`
- If a task matches a skill, invoke it before implementing directly
- Do not skip an applicable skill just because the task seems small
- Follow the selected skill workflow completely, not partially

### Intent → Skill Mapping

- **Feature / new functionality** → `spec-driven-development`, then `planning-and-task-breakdown`, then `incremental-implementation`, then `test-driven-development`
- **Planning / breakdown** → `planning-and-task-breakdown`
- **Bug / failure / unexpected behavior** → `debugging-and-error-recovery`
- **Code review** → `code-review-and-quality`
- **Refactoring / simplification** → `code-simplification`
- **API or interface design** → `api-and-interface-design`
- **UI work** → `frontend-ui-engineering`
- **Release / deploy / launch** → `shipping-and-launch`

### Preferred composition

When multiple skills apply, combine workflow skills with project-specific skills.

1. Use workflow skills to drive process discipline
2. Use project-specific skills to respect this codebase's architecture and stack
3. Prefer the most specific skill available when two overlap

### Examples

- **New Next.js feature** → `spec-driven-development` + `planning-and-task-breakdown` + `incremental-implementation` + `test-driven-development` + `next-best-practices`
- **Supabase schema or RLS change** → `spec-driven-development` + `supabase-postgres-best-practices`
- **UI page or component work** → `frontend-ui-engineering` + `web-design-guidelines` + `vercel-react-best-practices`
- **Production bug** → `debugging-and-error-recovery` + relevant project-specific skill
- **Pre-merge review** → `code-review-and-quality` + relevant project-specific skill

### Execution lifecycle

OpenCode should internally follow this lifecycle when relevant:

- **DEFINE** → `spec-driven-development`
- **PLAN** → `planning-and-task-breakdown`
- **BUILD** → `incremental-implementation` + `test-driven-development`
- **VERIFY** → `debugging-and-error-recovery`
- **REVIEW** → `code-review-and-quality`
- **SHIP** → `shipping-and-launch`

### Anti-rationalization

The following reasoning is incorrect and should be avoided:

- "This is too small for a skill"
- "I can just implement this quickly"
- "I'll gather context first and maybe use a skill later"

Correct behavior:

- Always check whether a skill applies first
- If a skill applies, use it
- Only implement directly when no skill is relevant

---

## Security

1. **Never commit**: `.env.local`, API keys, real user data
2. **RLS**: Always enable RLS on new tables; policies must validate `auth.uid()`
3. **Server Actions**: Always authenticate inside each action
4. **Rate limiting**: Auth actions use Upstash sliding window limiters
5. **Input validation**: Zod in client forms + RLS + DB constraints

### Vulnerability Reports

Do not open a public issue. Email: security@keepel.dev

---

## Directory Structure

```
CarCare/
├── app/                              # Next.js App Router
│   ├── api/                         # API routes
│   ├── auth/                        # Auth pages + actions
│   ├── vehicles/                    # Vehicle pages
│   ├── globals.css                  # Global styles + Tailwind theme
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Landing/dashboard
│
├── components/                       # React components
│   ├── analytics/                   # Analytics barrel export
│   ├── auth/                        # Auth components
│   ├── dashboard/                   # Dashboard components
│   ├── home/                        # Landing page
│   ├── layout/                      # Header, Layout
│   ├── maintenance/                 # Maintenance CRUD
│   ├── skeletons/                   # Loading skeletons
│   ├── ui/                          # shadcn/ui components
│   └── vehicles/                    # Vehicle CRUD
│
├── contexts/                         # React Contexts
│   ├── AppProviders.tsx             # Root provider tree
│   ├── AuthContext.tsx              # Auth state
│   ├── DataContext.tsx              # App data + optimistic updates
│   └── SupabaseContext.tsx          # Supabase client
│
├── hooks/                            # Custom hooks
├── lib/                              # Utilities
│   ├── auth/                        # AuthManager singleton
│   ├── supabase/                    # Client, server, middleware
│   ├── formatters.ts                # Data formatters
│   ├── ratelimit.ts                 # Rate limiting config
│   └── utils.ts                     # General utilities
├── scripts/                          # SQL migrations
├── styles/                           # Additional styles
├── public/                           # Static assets
├── middleware.ts                     # Next.js middleware
├── next.config.mjs                   # Next.js config
└── package.json
```

---

## Quick Reference

### Key Files

| File                       | Purpose                            |
| -------------------------- | ---------------------------------- |
| `middleware.ts`            | Session refresh + route protection |
| `lib/auth/authManager.ts`  | Auth singleton                     |
| `lib/supabase/client.ts`   | Browser client                     |
| `lib/supabase/server.ts`   | Server client                      |
| `lib/ratelimit.ts`         | Rate limiting configuration        |
| `contexts/AuthContext.tsx` | Auth state                         |
| `contexts/DataContext.tsx` | Data + optimistic mutations        |
| `app/auth/actions.ts`      | Login/signup Server Actions        |
| `app/api/auth/signout/route.ts` | Sign-out API route            |

### Contexts & Hooks

| Item                  | Import       | Exposes                                 |
| --------------------- | ------------ | --------------------------------------- |
| `useAuth()`           | `@/contexts` | user, profile, isAuthenticated, signOut |
| `useData()`           | `@/contexts` | vehicles, maintenance, CRUD methods     |
| `useSupabase()`       | `@/contexts` | Raw Supabase client                     |
| `useProtectedRoute()` | `@/hooks`    | Redirect to login if unauthenticated    |
| `useGuestRoute()`     | `@/hooks`    | Redirect to `/` if authenticated        |
| `useDashboardData()`  | `@/hooks`    | Dashboard data fetching                 |
| `useAnalytics()`      | `@/hooks`    | @openpanel/nextjs analytics integration |
| `useMediaQuery()`     | `@/hooks`    | Responsive breakpoint detection         |

---

## Roadmap

### v1.1 (In Development)

- [ ] Testing setup with Vitest (unit/integration) and Playwright (e2e)
- [ ] Full REST API for integrations
- [ ] Advanced reports with improved charts
- [ ] Internationalization (i18n) Spanish/English
- [ ] Advanced search with multiple filters

### v1.2 (Planned)

- [ ] Native mobile app (React Native)
- [ ] OCR for automatic invoice scanning
- [ ] Integration with repair shops
- [ ] Budget management
- [ ] Cost comparison between vehicles

### v2.0 (Future)

- [ ] AI-based maintenance prediction
- [ ] Advanced performance analytics
- [ ] Manufacturer API integrations
- [ ] Services marketplace
- [ ] Recommendation engine

---

**Last updated**: April 2026
**Format**: AGENTS.md (open standard)
