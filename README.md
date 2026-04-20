# Coupon Redemption API

A strictly-typed, concurrency-safe REST API for managing and redeeming coupons. Built with **Fastify**, **Kysely**, and **PostgreSQL**.

## Tech Stack
- **Runtime**: Node.js 20+ (ESM)
- **Framework**: Fastify v5 (Type Provider Zod)
- **Database**: PostgreSQL 16
- **Query Builder**: Kysely (with `kysely-codegen`)
- **Validation**: Zod
- **Testing**: Vitest

---

## Running the API

### 1. Requirements
- Node.js 20+
- Docker and Docker Compose

### 2. Booting the Environment

#### Option A: Full Stack with Docker (Recommended)
```bash
docker compose up -d --build
```
Builds the API image and starts both the `api` (port 3000) and `postgres` (port 5432) containers.

#### Option B: Local Development
1. **Start PostgreSQL**: `docker compose up -d postgres`
2. **Install dependencies**: `npm install`
3. **Apply migrations**: `npm run migrate`
4. **Start dev server**: `npm run dev`

### 3. Scripts
- `npm run build`: Compiles TypeScript to `dist/`.
- `npm run start`: Runs the compiled JS from the `dist/` directory.
- `npm run dev`: Executes `tsx watch` for hot-reloading development.
- `npm run typecheck`: Runs `tsc --noEmit` to validate types.
- `npm run migrate`: Executes Kysely migrations and triggers `kysely-codegen`.
- `npm run seed`: Populates the database with initial admin users, campaigns, and coupons.
- `npm run test`: Runs the Vitest suite against a dedicated test database (`coupon_db_test`).

---

## API Documentation
OpenAPI specification is available at:
> **http://localhost:3000/documentation**

---

## Testing Coverage
The test suite ensures reliability across system boundaries:
- **Redemption Logic**: Happy path, double-redemption (409), expired coupons, and limit enforcement.
- **Concurrency**: Parallel strike testing involving 20 users against a limit of 1. Precisely **1 success (201)** and **19 failures (409)** are expected to pass the test.
- **Validation**: Rejection of `not_available` status and future `startTimestamp`.
- **Permissions**: Admin-only access to `/users` and `/coupons` routes.
- **Pagination**: Meta calculation verification.

---

## Example Requests

### List Coupons (Admin)
```bash
# Returns data + meta (total, totalPages, page, pageSize)
curl -G "http://localhost:3000/coupons" \
  --data-urlencode "page=2" \
  --data-urlencode "pageSize=10" \
  -H "x-user-id: <admin-uuid>"
```

### Create Coupon for Existing Campaign (Admin)
```bash
curl -X POST http://localhost:3000/coupons \
  -H "Content-Type: application/json" \
  -H "x-user-id: <admin-uuid>" \
  -d '{
    "coupon": { "code": "SAVE10", "status": "available" },
    "campaignId": "<campaign-uuid>"
  }'
```

### Successful Redemption
```bash
curl -X POST http://localhost:3000/coupons/SAVE10/redeem \
  -H "x-user-id: <user-uuid>"
```

### Failed Redemption (Limit Reached)
```bash
# Returns 409 Conflict with error: "CouponRedemptionLimitReachedError"
curl -X POST http://localhost:3000/coupons/LIMITED5/redeem \
  -H "x-user-id: <user-uuid>"
```

### Failed Redemption (Not Available)
```bash
# Returns 409 Conflict with error: "CouponNotAvailableError"
curl -X POST http://localhost:3000/coupons/HIDDEN_COUPON/redeem \
  -H "x-user-id: <user-uuid>"
```

---

## Design Decisions and Architecture

### 1. Concurrency and Data Integrity
- **Redemption Lock**: Uses a PostgreSQL `SELECT ... FOR UPDATE` within a transaction. This locks the coupon and parent campaign rows to prevent race conditions during redemption increments.
- **Defense in Depth**: A composite unique constraint `UNIQUE(user_id, coupon_id)` serves as an independent database layer protecting against duplication.
- **Denormalization**: `redemptions_count` is stored on the primary tables. This avoids executing `COUNT(*)` on log tables during high-traffic validation paths.

### 2. Validation and Expiration Rules
- **Nullability**: `null` values in `expiration_timestamp` or `end_timestamp` indicate infinite validity.
- **Visibility vs Usage**: `GET /coupons` only returns coupons where both the coupon and campaign are `available` and not expired. It includes coupons for future campaigns to allow client-side visibility. However, `POST .../redeem` explicitly rejects usage until the `start_timestamp` is reached.
- **Creation-Time Validation**: `POST /coupons` validates that the associated campaign (whether existing or new) is not already expired. Attempting to link a coupon to an expired campaign returns a `CampaignExpiredError` (409 Conflict).
- **Campaign Identification by ID**: Campaigns are referenced via `campaignId` (UUID) rather than `name`. UUIDs are immutable and globally unique, avoiding ambiguity in cases of duplicate or renamed campaigns. The `name` field is a mutable, human-readable label and is not suitable as a stable foreign key.

### 3. Persistence Layer
- **Postgres ENUMs**: Native ENUM types are used for `status` and `role`. This ensures strict internal validation and type safety compared to varchar-based implementations.
- **Explicit Status Requirement**: Neither `campaign.status` nor `coupon.status` defines a schema default. This is intentional: it forces the API caller to consciously decide the initial state of the resource, preventing accidental publication of campaigns or coupons that should have been created as `not_available`.
- **Transaction History**: `ON DELETE RESTRICT` is enforced. Financial and transactional integrity requires that campaigns or coupons with any associated redemption remains un-deletable.
- **System Columns**: `created_at` and `updated_at` are handled via PostgreSQL `DEFAULT NOW()` and native triggers, ensuring consistency regardless of the application client.

### 4. Implementation Details
- **Rate Limiting**: Implemented using `@fastify/rate-limit`. Current configuration uses in-memory storage; horizontal scaling would require a shared Redis store.
- **Pagination**: Offset-based implementation. Responses include a `meta` object with `total` and `totalPages` to enable functional client-side navigation.
- **Ordering**: Listing is ordered by `campaign.start_timestamp ASC` and `coupon.code ASC`. This grants stable and consistent pagination.
- **Logging**: Pino is natively integrated via Fastify (`logger: true`). Output is in structured JSON format. Explicit domain logs are added at critical points of the redemption flow: attempt, success, and every failure case (e.g., `CouponExpiredError`, `LimitReachedError`, `AlreadyRedeemedError`).
