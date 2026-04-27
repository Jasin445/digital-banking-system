# Digital Bank Backend

A full backend banking system built with Node.js, Express, and MongoDB, integrated with the **NIBSS by Phoenix** API for identity verification and interbank settlement.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **External API**: NIBSS by Phoenix (`https://nibssbyphoenix.onrender.com`)
- **Validation**: express-validator
- **Testing**: Jest + Supertest

---

## Project Structure

```
digital-bank-backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js   # Register, login, profile
│   │   ├── account.controller.js
│   │   └── transaction.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT guard, KYC guard
│   │   ├── error.middleware.js  # Central error handler
│   │   └── validation.middleware.js
│   ├── models/
│   │   ├── customer.model.js
│   │   ├── account.model.js
│   │   └── transaction.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── account.routes.js
│   │   └── transaction.routes.js
│   ├── scripts/
│   │   ├── nibss-onboard.js     # One-time bank onboarding with NIBSS
│   │   └── seed-identity.js    # Seed test BVN/NIN records
│   ├── services/
│   │   └── nibss.service.js    # All NIBSS API calls (token cached)
│   ├── utils/
│   │   └── jwt.utils.js
│   ├── app.js                  # Express app (no server.listen)
│   └── server.js               # Entry point
├── tests/
│   ├── auth.test.js
│   ├── account.test.js
│   └── transaction.test.js
├── .env.example
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd digital-bank-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/digital_bank
JWT_SECRET=change_this_to_a_strong_random_string
JWT_EXPIRES_IN=7d
NIBSS_BASE_URL=https://nibssbyphoenix.onrender.com
NIBSS_API_KEY=        # filled after step 3
NIBSS_API_SECRET=     # filled after step 3
BANK_CODE=            # filled after step 3
BANK_NAME=            # filled after step 3
```

### 3. Onboard Your Bank with NIBSS (run once)

```bash
BANK_NAME="YourBankName" BANK_EMAIL="you@example.com" node src/scripts/nibss-onboard.js
```

Copy the printed credentials into your `.env`.

### 4. (Optional) Seed Test Identities

```bash
node src/scripts/seed-identity.js
```

Creates two test identities (BVN + NIN) in NIBSS you can use for registration.

### 5. Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 6. Run Tests

```bash
npm test
```

---

## API Reference

### Base URL
```
http://localhost:5000
```

### Authentication
All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```

---

### Auth Endpoints

#### `POST /api/auth/register`
Register a new customer. KYC is created and verified against NIBSS during registration. Name and DOB must match NIBSS records exactly.

**Body:**
```json
{
  "firstName": "Amaka",
  "lastName": "Okafor",
  "email": "amaka@example.com",
  "phone": "08099887766",
  "password": "securepassword",
  "dob": "1995-06-15",
  "kycType": "bvn",
  "kycID": "22345678901"
}
```

**Response `201`:**
```json
{
  "token": "<jwt>",
  "customer": { "firstName": "Amaka", "lastName": "Okafor", "email": "...", "onboardingStatus": "verified" },
  "message": "Registration successful. Please create your bank account to complete onboarding."
}
```

---

#### `POST /api/auth/login`

**Body:**
```json
{ "email": "amaka@example.com", "password": "securepassword" }
```

**Response `200`:**
```json
{ "token": "<jwt>", "customer": { ... } }
```

---

#### `GET /api/auth/me` 🔒
Returns the authenticated customer's profile.

---

### Account Endpoints

All require `Authorization: Bearer <token>`.

#### `POST /api/accounts/create` 🔒
Creates a NIBSS-backed account. Requires KYC to be verified (happens at registration). One account per customer.

**Response `201`:**
```json
{
  "message": "Account created successfully.",
  "account": {
    "accountNumber": "1084071287",
    "accountName": "Amaka Okafor",
    "bankCode": "108",
    "bankName": "YourBank",
    "balance": 15000
  }
}
```

---

#### `GET /api/accounts/me` 🔒
Returns authenticated customer's account details with live balance from NIBSS.

---

#### `GET /api/accounts/balance` 🔒
Returns current account balance (refreshed from NIBSS).

```json
{ "accountNumber": "1084071287", "balance": 14000 }
```

---

#### `GET /api/accounts/name-enquiry/:accountNumber` 🔒
Look up any account number to get the holder's name before a transfer.

```json
{
  "accountNumber": "1087207670",
  "accountName": "Chukwuemeka Nwosu",
  "bankName": "PHC Bank"
}
```

---

### Transaction Endpoints

All require `Authorization: Bearer <token>` **and** completed onboarding.

#### `POST /api/transactions/transfer` 🔒
Initiates intra-bank or inter-bank transfer. Automatically performs name enquiry, balance check, and routes via NIBSS.

**Body:**
```json
{
  "toAccount": "1087207670",
  "amount": 5000,
  "description": "Rent payment"
}
```

**Response `200`:**
```json
{
  "message": "Transfer successful.",
  "transaction": {
    "transactionId": "TX1776340463722",
    "amount": 5000,
    "from": "1084071287",
    "to": "1087207670",
    "recipientName": "Chukwuemeka Nwosu",
    "transferType": "inter-bank",
    "status": "SUCCESS",
    "balanceBefore": 15000,
    "balanceAfter": 10000,
    "timestamp": "2026-04-26T10:00:00.000Z"
  }
}
```

**Error `400`** — insufficient funds:
```json
{ "message": "Insufficient funds.", "availableBalance": 500 }
```

---

#### `GET /api/transactions` 🔒
Returns the authenticated customer's own transaction history. Supports pagination and filtering.

**Query params:**
| Param | Values | Default |
|-------|--------|---------|
| `page` | number | 1 |
| `limit` | number | 20 |
| `type` | `debit` \| `credit` | — |
| `status` | `SUCCESS` \| `FAILED` \| `PENDING` | — |

**Response:**
```json
{
  "total": 5,
  "page": 1,
  "pages": 1,
  "transactions": [ ... ]
}
```

---

#### `GET /api/transactions/:transactionId` 🔒
Returns a single transaction. Returns `404` if the transaction does not belong to the authenticated customer (data isolation enforced).

---

#### `GET /api/transactions/status/:nibssTransactionId` 🔒
Queries NIBSS directly for transaction status (TSQ). Also updates local record.

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad request / business rule violation |
| `401` | Missing or expired JWT |
| `403` | Forbidden (KYC not done / onboarding incomplete) |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, BVN already linked, etc.) |
| `422` | Validation failed |
| `500` | Internal server error |

---

## Data Privacy & Isolation

- Customers can only view **their own** transactions — enforced by filtering on `customerId` in every DB query.
- Passwords are hashed with **bcrypt** (salt rounds: 12).
- KYC IDs are **never returned** in any API response (`toJSON()` strips them).
- JWTs expire per `JWT_EXPIRES_IN` setting (default 7 days).

---

## Full Customer Journey

```
1. POST /api/auth/register        — KYC created and verified with NIBSS inline
2. POST /api/accounts/create      — Account created on NIBSS, pre-funded ₦15,000
3. GET  /api/accounts/name-enquiry/:no — Confirm recipient before transfer
4. POST /api/transactions/transfer — Send funds (intra or inter-bank)
5. GET  /api/transactions          — Review transaction history
6. GET  /api/transactions/status/:nibssTxId — TSQ if needed
```
