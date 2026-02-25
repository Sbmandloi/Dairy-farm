# Dairy Milk Billing & WhatsApp Invoicing System

A full-stack Next.js 16 application for managing dairy milk delivery, billing, and WhatsApp PDF invoicing.

## Features

- **Daily Milk Entry** — Mobile-optimized grid with morning/evening split or single-entry mode. Quick-add buttons, copy-from-previous-day, bulk save.
- **Customer Management** — Add, edit, activate/deactivate customers with custom per-liter pricing.
- **Billing Engine** — Automatic monthly bill generation with unique invoice numbers.
- **PDF Invoices** — Generate downloadable A4 invoices with day-wise breakdown (Puppeteer).
- **WhatsApp Integration** — Send PDF invoices directly via WhatsApp Cloud API.
- **Payment Tracking** — Full/partial payment recording with outstanding balance tracking.
- **Reports** — Monthly billing summary, top customers, recent payments.
- **Authentication** — Secure JWT login with NextAuth v5.

## Quick Start

### 1. Install

```bash
cd dairy-billing
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
# Edit .env.local with your PostgreSQL URL and secrets
```

### 3. Database

```bash
npm run db:push    # Push schema to DB
npm run db:seed    # Create admin + sample data
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default login:** `admin@dairy.local` / `Admin@123456`

## Database Commands

```bash
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Create and run migration
npm run db:push      # Push schema (dev only)
npm run db:seed      # Seed admin + defaults
npm run db:studio    # Prisma Studio
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret (openssl rand -base64 32) |
| `ENCRYPTION_KEY` | AES-256 key for token storage (openssl rand -hex 32) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verify token |
| `PDF_STORAGE_PATH` | Local path for PDF storage (default: ./storage/invoices) |

## Tech Stack

Next.js 16 · TypeScript · PostgreSQL · Prisma v7 · NextAuth v5 · Tailwind CSS · Radix UI · Puppeteer · WhatsApp Cloud API · Zod
