# Digital Bank Backend

A full backend banking system built with Node.js, Express, and MongoDB, integrated with the **NIBSS by Phoenix** API for identity verification and interbank settlement.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js (v18+) |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| External API | NIBSS by Phoenix |
| Validation | express-validator |

---

## Project Structure

```
digital-bank-backend/
├── src/
│   ├── config/
│   │   └── database.js                 # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── account.controller.js
│   │   └── transaction.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js          # JWT guard, KYC guard
│   │   ├── error.middleware.js         # Central error handler
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
│   │   └── nibss-onboard.js           # One-time bank onboarding with NIBSS
│   ├── services/
│   │   └── nibss.service.js           # All NIBSS API calls (token cached)
│   ├── utils/
│   │   └── jwt.utils.js
│   ├── app.js                         # Express app (no server.listen)
│   └── server.js                      # Entry point
├── .env.example
├── .gitignore
└── package.json
```

---

## Getting Started

### Step 1 — Clone and Install

```bash
git clone <your-repo>
cd digital-bank-backend
npm install
```

### Step 2 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in the following:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/digital_bank
JWT_SECRET=change_this_to_a_strong_random_string
JWT_EXPIRES_IN=7d
NIBSS_BASE_URL=https://nibssbyphoenix.onrender.com
NIBSS_API_KEY=        # filled after Step 3
NIBSS_API_SECRET=     # filled after Step 3
BANK_CODE=            # filled after Step 3
BANK_NAME=            # filled after Step 3
```

### Step 3 — Onboard Your Bank with NIBSS

> This only needs to be run **once**.

```bash
BANK_NAME="YourBankName" BANK_EMAIL="you@example.com" node src/scripts/nibss-onboard.js
```

Copy the printed credentials into your `.env` before proceeding.

### Step 4 — Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

---

## API Reference

**Base URL:** `http://localhost:5000`

All protected routes (`🔒`) require the following header:

```
Authorization: Bearer <your_jwt_token>
```

---

### Auth Endpoints

#### `POST /api/auth/register`

Registers a new customer. KYC is created and verified against NIBSS during registration — the customer's name and date of birth must match NIBSS records exactly.

**Request Body:**

```json
{
  "firstName": "Dora",
  "lastName": "Matthew",
  "email": "dora@example.com",
  "phone": "07098000926",
  "password": "securepassword",
  "dob": "1999-03-09",
  "kycType": "bvn",
  "kycID": "22389837362"
}
```

**Response `201`:**

```json
{
  "token": "<jwt>",
  "customer": {
    "firstName": "Dora",
    "lastName": "Matthew",
    "email": "dora@example.com",
    "onboardingStatus": "verified"
  },
  "message": "Registration successful. Please create your bank account to complete onboarding."
}
```

---

#### `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "amaka@example.com",
  "password": "securepassword"
}
```

**Response `200`:**

```json
{
  "token": "<jwt>",
  "customer": { }
}
```

---

#### `GET /api/auth/me` `🔒`

Returns the authenticated customer's profile. No request body required.

---

### Account Endpoints

All account endpoints require `Authorization: Bearer <token>`.

#### `POST /api/accounts/create` `🔒`

Creates a NIBSS-backed bank account. KYC must be verified (completed at registration) before this can be called. Each customer is limited to one account.

**Response `201`:**

```json
{
  "message": "Account created successfully.",
  "account": {
    "accountNumber": "1084071287",
    "accountName": "Dora Matthew",
    "bankCode": "108",
    "bankName": "YourBank",
    "balance": 15000
  }
}
```

---

#### `GET /api/accounts/me` `🔒`

Returns the authenticated customer's account details with their balance refreshed live from NIBSS. No request body required.

---

#### `GET /api/accounts/balance` `🔒`

Returns the customer's current account balance, refreshed directly from NIBSS.

```json
{
  "accountNumber": "1084071287",
  "balance": 14000
}
```

---

#### `GET /api/accounts/name-enquiry/:accountNumber` `🔒`

Looks up any account number to retrieve the account holder's name. Recommended to call this before initiating a transfer to confirm the recipient.

```json
{
  "accountNumber": "1087207670",
  "accountName": "Jude David",
  "bankName": "JAS Bank"
}
```

---

### Transaction Endpoints

All transaction endpoints require `Authorization: Bearer <token>` and a fully completed onboarding.

#### `POST /api/transactions/transfer` `🔒`

Initiates an intra-bank or inter-bank transfer. Automatically performs a name enquiry, balance check, and routes the transfer via NIBSS.

**Request Body:**

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

**Response `400` — Insufficient Funds:**

```json
{
  "message": "Insufficient funds.",
  "availableBalance": 500
}
```

---

#### `GET /api/transactions` `🔒`

Returns the authenticated customer's own transaction history. Supports pagination and filtering.

**Query Parameters:**

| Parameter | Accepted Values | Default |
| --- | --- | --- |
| `page` | number | `1` |
| `limit` | number | `20` |
| `type` | `debit` or `credit` | — |
| `status` | `SUCCESS`, `FAILED`, or `PENDING` | — |

**Response `200`:**

```json
{
  "total": 5,
  "page": 1,
  "pages": 1,
  "transactions": [ ]
}
```

---

#### `GET /api/transactions/:transactionId` `🔒`

Returns a single transaction by ID. Returns `404` if the transaction does not belong to the authenticated customer — data isolation is strictly enforced.

---

#### `GET /api/transactions/status/:nibssTransactionId` `🔒`

Performs a Transaction Status Query (TSQ) directly against NIBSS and updates the local transaction record with the latest status.

---

## HTTP Status Codes

| Code | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Created |
| `400` | Bad request or business rule violation |
| `401` | Missing or expired JWT |
| `403` | Forbidden — KYC not completed or onboarding incomplete |
| `404` | Resource not found |
| `409` | Conflict — duplicate email, BVN already linked, etc. |
| `422` | Validation failed |
| `500` | Internal server error |

---

## Data Privacy & Security

- Customers can only view **their own** transactions — every database query filters by `customerId`.
- Passwords are hashed with **bcrypt** at 12 salt rounds.
- KYC IDs are **never returned** in any API response — stripped via `toJSON()`.
- JWTs expire based on the `JWT_EXPIRES_IN` environment variable (default: 7 days).

---

## Full Customer Journey

```
1. POST /api/auth/register                      — KYC verified with NIBSS at registration
2. POST /api/accounts/create                    — Account created on NIBSS, pre-funded ₦15,000
3. GET  /api/accounts/name-enquiry/:accountNo   — Confirm recipient before transfer
4. POST /api/transactions/transfer              — Send funds (intra or inter-bank)
5. GET  /api/transactions                       — Review transaction history
6. GET  /api/transactions/status/:nibssTxId     — TSQ if needed
```
