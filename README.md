# Nosh Full Stack Intern Assignment: Dish Dashboard

A full-stack dashboard for managing dish catalogs, supporting draft editing and safe concurrent updates.

---

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Vitest, React Testing Library
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Local MongoDB with Mongoose
- **Validation**: Zod
- **Testing**: Vitest, React Testing Library, Supertest

---

### Project Structure

```text
NOSHAssignment/
├── client/                     # Frontend React + Vite + Tailwind CSS application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConflictBanner.tsx    # Conflict alert with Reload latest action and discard warning
│   │   │   ├── DishCard.tsx          # Card displaying image, status, version, draft inputs & actions
│   │   │   ├── Header.tsx            # Header branding, statistics, and refresh action
│   │   │   └── ImageWithFallback.tsx # Image loader with fallback placeholder
│   │   ├── hooks/
│   │   │   └── useDishDashboard.ts   # Draft state management, OCC updates, and conflicts
│   │   ├── services/
│   │   │   └── api.ts                # REST API client (fetchDishes, updateDish)
│   │   ├── types/
│   │   │   └── dish.ts               # TypeScript interfaces for dishes, drafts, and responses
│   │   ├── App.tsx                   # Main Dish Dashboard UI
│   │   ├── App.test.tsx              # Component & integration test suite (15 tests)
│   │   ├── index.css                 # Tailwind CSS imports & base styles
│   │   └── main.tsx                  # React entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend Express + TypeScript application
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts           # MongoDB connection lifecycle module
│   │   │   └── env.ts          # Environment configuration
│   │   ├── models/
│   │   │   └── dish.model.ts   # Mongoose Dish model (dishId, dishName, imageUrl, isPublished, version)
│   │   ├── routes/
│   │   │   ├── dish.route.ts   # REST endpoints: GET /dishes, PATCH /dishes/:dishId
│   │   │   └── health.route.ts # Health check: GET /health
│   │   ├── schemas/
│   │   │   └── dish.schema.ts  # Zod schemas for seed data and PATCH request validation
│   │   ├── scripts/
│   │   │   └── seed.ts         # Executable idempotent seed script CLI
│   │   ├── services/
│   │   │   ├── dish.service.ts # Dish business logic & atomic version-controlled updates
│   │   │   └── seed.service.ts # Core seed logic & validation service
│   │   ├── app.ts              # Express application & middleware
│   │   └── server.ts           # Server HTTP listener (connects to MongoDB before listening)
│   ├── tests/
│   │   ├── dish.test.ts        # Comprehensive API tests for GET /dishes and PATCH /dishes/:dishId
│   │   ├── health.test.ts      # Automated health endpoint test
│   │   ├── seed.test.ts        # Unit & safe integration tests for seed logic
│   │   └── test-utils.ts       # Test DB URI validator & safe cleanup helpers
│   ├── .env.example            # Example environment variables
│   ├── package.json
│   └── tsconfig.json
├── dish-assignment.json        # Assignment seed data source (kept in root)
├── .gitignore                  # Root gitignore for workspace
└── README.md                   # Setup, run, and API guide
```

---

### Prerequisites

- **Node.js**: Declared compatible engine range: `^22.22.2 || ^24.15.0 || >=26.0.0`
  - *Dependency declared engines:*
    - `jsdom` (`^30.1.2`): `^22.22.2 || ^24.15.0 || >=26.0.0`
    - `vitest` (`^5.0.4`): `^22.12.0 || ^24.0.0 || >=26.0.0`
    - `vite` (`^8.3.0`): `^20.19.0 || >=22.12.0`
    - `vitest` (server `^3.0.4`): `^18.0.0 || ^20.0.0 || >=22.0.0`
  - *Verification runtime notice:* All tests (36 backend, 15 frontend) and production builds were verified locally on **Node.js v24.13.0** with **npm v10.8.0** because it was the sole runtime available on this machine. Node.js v24.13.0 does **not** satisfy `jsdom`'s declared engine requirement (`^24.15.0`). Although all tests and builds succeed without errors under v24.13.0, strict engine-compliant environments require a Node.js release within `^22.22.2 || ^24.15.0 || >=26.0.0`.
- **npm**: v10+ (tested on v10.8.0)
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017`

To verify that your local MongoDB server is active:
```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
```
*(or on macOS/Linux: `nc -zv 127.0.0.1 27017`)*

---

### Installation

Install dependencies separately for both `client` and `server`:

#### 1. Server Dependencies
```bash
cd server
npm install
```

#### 2. Client Dependencies
```bash
cd ../client
npm install
```

---

### Environment Setup

Create the local `.env` file for the backend:

```bash
cd server
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Default `server/.env` configuration:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/nosh
CLIENT_URL=http://localhost:5173
```

---

### Database Seeding (`npm run seed`)

The seed script reads from the root `dish-assignment.json` file, validates each entry using Zod, and loads the data into MongoDB idempotently:

- **Unique identifier**: `dishId` (unique string).
- **Default version**: New dishes are inserted with `version: 1`.
- **Idempotency Guarantee**: If a dish already exists (even if edited or versioned up by users), the seed script **never overwrites** its fields or resets its version.
- **Rerun safety**: Running `npm run seed` repeatedly only inserts records that are missing.

To execute the seed script:
```bash
cd server
npm run seed
```

---

### API Documentation (Phase 3)

Base URL: `http://localhost:5000`

#### 1. GET `/health`
Health check endpoint verifying the server is responsive.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "message": "Nosh Dish Dashboard API is healthy",
  "timestamp": "2026-10-12T14:28:16.164Z"
}
```

---

#### 2. GET `/dishes`
Fetches all dishes directly from MongoDB sorted by `dishId`.

**Response `200 OK`**:
```json
{
  "dishes": [
    {
      "dishId": "1",
      "dishName": "Jeera Rice",
      "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
      "isPublished": true,
      "version": 1
    },
    {
      "dishId": "2",
      "dishName": "Paneer Tikka",
      "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/paneer-tikka.jpg",
      "isPublished": true,
      "version": 1
    }
  ],
  "total": 2
}
```

---

#### 3. PATCH `/dishes/:dishId`
Safely updates a dish using Optimistic Concurrency Control (OCC).

**Request Body Parameters**:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `expectedVersion` | integer (>= 1) | **Yes** | The version expected in the database before this edit is applied. |
| `dishName` | string | Optional | Non-empty, trimmed dish name. Whitespace-only strings are rejected. |
| `imageUrl` | string | Optional | Valid HTTP or HTTPS URL. |
| `isPublished` | boolean | Optional | Boolean flag. Only modified if explicitly provided. |

> **Note**: At least one of `dishName`, `imageUrl`, or `isPublished` must be supplied.

**Example Request**:
```http
PATCH /dishes/1
Content-Type: application/json

{
  "dishName": "Spiced Jeera Rice",
  "isPublished": true,
  "expectedVersion": 1
}
```

**Response `200 OK` (Successful Update)**:
```json
{
  "message": "Dish updated successfully",
  "dish": {
    "dishId": "1",
    "dishName": "Spiced Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 2
  }
}
```

**Response `409 Conflict` (Stale Version Conflict)**:
Returned when `expectedVersion` does not match the database version (e.g. another user already updated the record). The database is left unchanged.
```json
{
  "error": "Conflict",
  "message": "Stale version conflict. Expected version 1, but current version is 2.",
  "currentDish": {
    "dishId": "1",
    "dishName": "Spiced Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 2
  }
}
```

**Response `400 Bad Request` (Validation Errors)**:
Returned when input validation fails (e.g. empty name, invalid type, missing `expectedVersion`, or invalid image URL):
```json
{
  "error": "Bad Request",
  "message": "Request body validation failed.",
  "details": [
    "dishName: dishName cannot be empty or whitespace-only"
  ]
}
```

**Response `404 Not Found` (Unknown Dish)**:
Returned when the requested `dishId` does not exist in the database:
```json
{
  "error": "Not Found",
  "message": "Dish with ID '999' was not found."
}
```

---

### Dashboard Features (Phase 4)

1. **Responsive Dish Catalog**:
   - Renders dishes with responsive grid layout (mobile, tablet, desktop).
   - Displays dish image, ID, name, live/draft publication status badge, and version badge.
   - Graceful fallback placeholder if image URL fails to load.
2. **Local Draft Editing**:
   - Editing name or publication status updates the local draft only. No backend requests occur while typing or toggling.
   - Dishes with edits display an amber `Unsaved draft` badge and the header displays an active unsaved count.
   - **Discard** button restores the last server-saved values.
3. **Optimistic Locking & Conflict Resolution**:
   - Save sends changed fields with `expectedVersion`.
   - On `409 Conflict`:
     - Preserves the user's current draft so work is never lost.
     - Displays conflict banner with current server version and data.
     - Offers **Reload latest** action with explicit warning that reloading discards the local draft.
   - Duplicate submissions are prevented while a save is in flight.

---

### Running the Applications

#### 1. Start the Backend Server
```bash
cd server
npm run dev
```
The server will connect to MongoDB before accepting incoming HTTP requests on `http://localhost:5000`.

Available server scripts:
- `npm run dev`: Starts development server with live reload via `tsx watch`
- `npm run seed`: Executes the idempotent database seed script
- `npm run build`: Compiles TypeScript to JavaScript in `dist/`
- `npm start`: Runs the compiled production server (`dist/server.js`)
- `npm test`: Runs automated test suite via Vitest (36 tests)

#### 2. Start the Frontend Client
In a separate terminal:
```bash
cd client
npm run dev
```
The Vite development server will start at `http://localhost:5173`.

Available client scripts:
- `npm run dev`: Starts Vite dev server
- `npm run build`: Type-checks and compiles production bundle to `dist/`
- `npm test`: Runs Vitest component & integration test suite (15 tests)
- `npm run preview`: Previews the production build

---

### Running Tests

#### Backend Test Suite (36 tests):
```bash
cd server
npm test
```
*Executes against an isolated test database (`nosh_test_isolated_suite` or `nosh_test`). The main database (`nosh`), `production_test`, development, and all unapproved databases are rejected by a strict allowlist guard.*
Coverage includes:
- **Seed Logic**: Validating seed structure, required fields, image URLs, duplicate prevention, default versioning, and strict re-seed idempotency without overwriting user edits.
- **Health Check**: Automated status verification.
- **Database Safety Guard**: Strict allowlist validation, malformed URI handling, and drop protection.
- **REST Endpoints**: `GET /dishes` and `PATCH /dishes/:dishId` with atomic version-controlled updates.
- **Concurrency & OCC**: Atomic incrementation, 409 conflict responses on stale versions, race condition handling with simultaneous requests.
- **Validation Safeguards**: Empty/whitespace names, invalid types, missing fields, invalid/non-HTTP URLs on publishing.
- **Persistence & Immutability**: Persistence across separate Express application instances backed by the same MongoDB database, and database immutability verification on validation errors and 409 conflicts.

#### Frontend Test Suite (15 tests):
```bash
cd client
npm test
```
*Executes via Vitest & React Testing Library.*
Coverage includes:
- **UI States**: Initial loading skeleton, error banner with retry, empty catalog state, dish cards, and image fallback placeholder.
- **Local Draft Isolation**: Kept locally in React state without firing network requests while typing or toggling.
- **Discard Workflow**: Cleanly restores server-saved values.
- **Successful Updates**: Sends expectedVersion and changes, increments badge to next version, removes unsaved indicators.
- **Submission Guard**: Disables buttons and prevents duplicate submissions while requests are in flight.
- **Optimistic Concurrency Control**: On 409 Conflict, preserves user draft, shows warning banner, and provides explicit reload latest option.
- **Refresh Protection**: Detects server version bumps during refresh with dirty drafts and prevents saving until resolved.
- **Multi-Session Concurrency**: Simulates two independent concurrent dashboard sessions mounted simultaneously on the same dish with container-scoped queries, verifying Session A's save advances shared server state to version 2, while Session B's version-1 save receives a 409 conflict, preserves Session B's draft, and allows explicit reload resolution.

---

### Known Limitations & Trade-offs

1. **Local MongoDB Instance**:
   - The application relies on a locally running MongoDB instance (or MongoDB connection string via `MONGODB_URI`). In a production deployment, this would be backed by a managed MongoDB Atlas cluster with connection pooling and replica sets.
2. **On-Demand Concurrency vs. Real-Time Push**:
   - Updates are synchronized on demand when users save or click Refresh. In high-frequency collaborative editing environments, WebSockets or Server-Sent Events (SSE) could be added to push remote dish changes to other connected clients in real time.
3. **Optimistic Locking Granularity**:
   - Concurrency control operates at the individual dish document level via atomic `findOneAndUpdate` with matching `version`. This provides low overhead and zero lock contention across different dishes.
4. **Node.js Engine Compatibility in Development**:
   - Dependencies (`jsdom@30.1.2`, `vitest@5.0.4`) declare engine support for `^22.22.2 || ^24.15.0 || >=26.0.0`. Local verification was performed on Node.js `v24.13.0` (which passes all tests and builds). In strict production environments, a runtime matching the declared engine range should be used.

---

### Time Spent & AI Assistance Disclosure

- **Total Time Spent**: Approximately 4.5 hours across 5 phases:
  - *Phase 1 (Foundation & Setup)*: ~35 mins
  - *Phase 2 (Database, Dish Model & Seeding)*: ~45 mins
  - *Phase 3 (Version-Controlled REST API & OCC)*: ~60 mins
  - *Phase 4 (React Dashboard, Draft State & Conflict UX)*: ~90 mins
  - *Phase 5 (Testing, Edge Cases & Verification)*: ~40 mins
- **AI Assistance**:
  - Google DeepMind Antigravity IDE (Gemini agent) was utilized as an AI pair-programming assistant for boilerplate scaffolding, test authoring, code review issue identification, and documentation refinement.
  - All architecture decisions, atomic update mechanics, strict database guards, and React draft management patterns were reviewed and validated against assignment specifications.
