# AEGIS

> The Subscription Reliability Layer for Nomba-Powered Businesses

AEGIS is a multi-tenant subscription infrastructure engine built on top of the Nomba API ecosystem. It provides the missing billing layer between payment processing and subscription-based applications, allowing developers to integrate recurring billing without building complex payment lifecycle logic from scratch.

The project was developed as part of the **Nomba Infrastructure Hackathon**.

---

## Overview

AEGIS handles the complete subscription lifecycle for merchants, including:

* Subscription plan management
* Customer subscriptions
* Automated recurring billing
* Smart retry & dunning workflows
* Subscription state management
* Webhook reliability
* Multi-tenant merchant isolation

Rather than replacing Nomba, AEGIS extends its APIs with infrastructure that subscription-based businesses need in production.

---

## Features

### Plan Management

* Create and manage subscription plans
* Flexible billing intervals
* Merchant-scoped plans
* Prorated plan upgrades and downgrades

### Subscription Engine

* Customer subscription management
* Automatic state transitions
* Trial support
* Subscription history

Supported states:

* `TRIALING`
* `ACTIVE`
* `PAST_DUE`
* `SUSPENDED`
* `CANCELLED`
* `EXPIRED`

### Billing Engine

* Scheduled recurring billing
* Tokenized card charging
* Renewal processing
* Payment verification

### Retry & Dunning

* Automatic retry scheduling
* Failure classification
* Payment recovery workflows
* Automatic subscription reactivation

### Webhooks

* Inbound webhook processing
* Outbound merchant webhooks
* Signed payload verification
* Retry with exponential backoff

### Multi-Tenant Architecture

* Merchant registration
* API key authentication
* Tenant-scoped resources
* Secure merchant isolation

---

## Tech Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion
* React Router
* Lucide React

### Backend

* Node.js
* Express
* TypeScript
* PostgreSQL
* Redis
* BullMQ

### Integrations

* Nomba Checkout API
* Nomba Charge API
* Nomba Tokenization API
* Nomba Transactions API
* Nomba Webhooks

---

## Project Structure

```text
src/
├── app/
├── components/
│   ├── common/
│   ├── dashboard/
│   ├── forms/
│   └── ui/
├── pages/
├── hooks/
├── lib/
├── services/
├── types/
├── utils/
├── data/
└── assets/
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/<username>/aegis.git
cd aegis
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

---

## Current Development Status

This repository currently contains the frontend MVP.

Implemented:

* Dashboard UI
* Plan management interface
* Subscription overview
* Responsive layouts
* Mock data
* Component architecture

In Progress:

* Backend API
* Merchant authentication
* Database integration
* Nomba API integration
* Billing scheduler
* Webhook processing

---

## Using Mock Data

The current frontend uses local mock data to simulate backend responses.

This allows UI development to continue independently while backend endpoints are being implemented.

Future integration will replace mock data with API requests without requiring significant UI changes.

Example:

```ts
// Current
import { plans } from "@/data/mockPlans";

// Future
const plans = await api.get("/plans");
```

---

## Planned API

```http
POST   /plans
GET    /plans
GET    /plans/:id
PATCH  /plans/:id
DELETE /plans/:id

POST   /subscriptions
GET    /subscriptions
GET    /subscriptions/:id

GET    /transactions

POST   /webhooks/nomba
POST   /webhooks/merchant
```

---

## Roadmap

* Merchant onboarding
* Plan CRUD
* Customer management
* Subscription lifecycle engine
* Recurring billing scheduler
* Smart retry & dunning
* Webhook reconciliation
* Analytics dashboard
* Customer self-service portal
* SDK for merchant integrations

---

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request.

---

## License

This project was developed for the Nomba Infrastructure Hackathon and is intended as a demonstration of subscription infrastructure built on the Nomba platform.
