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

### Setup

1. Clone the repository
2. Install dependencies: `npm ci`
3. Set up your database connection in `.env`
4. Run migrations: `npm run db:migrate`
5. Start development server: `npm run dev`

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

### CI/CD

This project uses GitHub Actions for continuous integration. Every pull request must pass:
- TypeScript type checking
- ESLint linting
- Unit tests
- Integration tests with PostgreSQL
- End-to-end tests
- Production build

## License

ISC