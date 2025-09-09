# OT-MTA2

Overtime Tracker Application - Multi-Tenant Architecture v2

## Overview

This application helps track employee overtime hours and automatically assigns overtime opportunities to the next eligible employee based on fairness criteria.

## Features

- Employee management with badge-based identification
- Overtime hour tracking with historical data
- Fair assignment algorithm based on least recent overtime
- RESTful API with comprehensive validation
- PostgreSQL database with Drizzle ORM
- Comprehensive test coverage (unit, integration, e2e)

## Development

### Prerequisites

- Node.js 20.x
- PostgreSQL 15+
- npm

### Local Development Setup

1. Clone the repository
2. Install dependencies: `npm ci`
3. Copy environment variables: `cp .env.local .env` (or create your own)
4. Start the database: `npm run db:up`
5. Create databases and run migrations:
   ```bash
   # Create main and test databases
   docker exec -it ot_mta2_db psql -U postgres -c "CREATE DATABASE ot_mta2;"
   docker exec -it ot_mta2_db psql -U postgres -c "CREATE DATABASE ot_mta2_test;"
   
   # Run migrations
   npm run db:migrate
   ```
6. Seed sample data: `npm run db:seed`
7. Start development server: `npm run dev`

The app will be available at http://localhost:3000

#### Quick Commands
- `npm run db:up` - Start PostgreSQL container
- `npm run db:down` - Stop PostgreSQL container  
- `npm run db:migrate` - Apply database schema
- `npm run db:seed` - Insert sample data (3 employees + overtime entries)
- `npm run dev` - Start development server

#### Database Access
- Main DB: `npm run db:psql`
- Test DB: `npm run db:psql:test`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:all` - Run all tests

## Deploy on Render

### Setup
1. Apply diffs → commit → push to main branch
2. In Render: "New +" → Blueprint → select your repo (reads render.yaml automatically)
3. Set `RENDER_API_KEY` as a repository secret in GitHub (for automated deployments)
4. On first deploy, run database setup:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Open the preview/prod URL → test `/health` and `/api/who-is-next?period=YYYY-WW`

### Features
- **Auto-deploy**: Pushes to main automatically deploy via GitHub Actions
- **PR Previews**: Each pull request gets its own preview environment  
- **Health Checks**: Service monitors `/health` endpoint
- **Managed Database**: PostgreSQL automatically provisioned and connected

### CI/CD

This project uses GitHub Actions for continuous integration and deployment:

**Pull Requests:** Every PR must pass:
- TypeScript type checking
- ESLint linting  
- Unit tests
- Integration tests with PostgreSQL
- End-to-end tests
- Production build

**Main Branch:** After tests pass, automatically deploys to Render production

## License

ISC