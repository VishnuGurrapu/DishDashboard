# Nosh Full Stack Intern Assignment: Dish Dashboard

A production-grade, full-stack dashboard for managing restaurant dish catalogs with local draft state isolation, atomic optimistic concurrency control (OCC), and resilient conflict resolution.

---

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Vitest, React Testing Library
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Local MongoDB with Mongoose
- **Validation**: Zod
- **Testing**: Vitest, React Testing Library, Supertest

---

### Architecture

The application implements a clean, layered architecture separating user state, API contracts, domain validation, and database persistence:

1. **Client Draft State**: The React dashboard fetches dishes via `GET /dishes` and maintains an atomic local catalog state (`dishes`, `drafts`, `conflictMap`). User edits to name or publication status remain isolated in client-side drafts without firing network calls during typing or toggling.
2. **REST API & Strict Validation**: On save, the client sends `PATCH /dishes/:dishId` containing `dishName`, `isPublished`, and `expectedVersion`. Express body-parser parses incoming JSON (with dedicated error middleware returning HTTP 400 for malformed syntax), and Zod strictly validates parameters and payload (rejecting extra fields like `imageUrl`).
3. **Service Layer & Business Rules**: `dish.service.ts` coordinates domain logic, verifies dish existence (returning 404 for unknown IDs), runs an early version comparison, and validates publishing integrity (requiring a non-empty trimmed name and a valid HTTP/HTTPS URL on the stored database record when `isPublished: true`).
4. **Atomic Concurrency & Database Check**: The definitive version check occurs directly inside MongoDB using `Dish.findOneAndUpdate({ dishId, version: input.expectedVersion }, { $set: updateFields, $inc: { version: 1 } })`. The database evaluates the version condition atomically under its document-level write lock, preventing concurrent overwrite races.
5. **Persistence & Conflict Feedback**: Mongoose writes updates to the `dishes` collection. If the atomic query matches zero documents because another write already changed the version, the service retrieves the latest server record and returns HTTP 409 Conflict with `currentDish`, enabling the user to review the diff or reload without losing their draft.

---

### Design Decisions: Optimistic Concurrency Control (OCC)

In collaborative environments where multiple clients or tabs may view and update dishes simultaneously, traditional "last-write-wins" strategies lead to silent data loss. This system uses Optimistic Concurrency Control:

- **Why each dish has a version**: Every dish document in MongoDB includes an integer `version` property initialized to `1`. This acts as a monotonic revision counter that increments by `1` on every committed update.
- **Why the client sends `expectedVersion`**: When a client loads a dish, it captures the current `version`. When saving, it sends this snapshot version as `expectedVersion`, proving to the server the exact baseline upon which the user made their edits.
- **Why the version check is inside `findOneAndUpdate`**: A two-step pattern (`findOne` followed by `updateOne`) introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race condition—two concurrent requests could both read `version: 1`, both pass the check, and sequentially overwrite each other. Placing `{ dishId, version: input.expectedVersion }` directly in `Dish.findOneAndUpdate` guarantees that MongoDB evaluates the version match and increments the version in a single atomic database operation.
- **How atomic operations prevent silent overwrites**: If Client A and Client B both attempt to update Dish 1 starting from version 1, MongoDB's write lock processes one operation first. The first operation matches `{ dishId: "1", version: 1 }`, applies the changes, and advances the version to `2`. When the second operation executes, no document matches `{ dishId: "1", version: 1 }`. The operation updates zero records and returns `null`.
- **Conflict response and user recovery**: When an update finds a version mismatch, the API returns `HTTP 409 Conflict` along with the latest persisted database state in `currentDish`. The frontend preserves the user's uncommitted draft, displays a prominent conflict banner comparing server vs. draft values, and offers two clear paths:
  - **Keep editing draft**: Retain the local draft to copy or refine modifications.
  - **Reload latest**: Explicitly discard the local draft and adopt the server's current version (`currentDish`).
  - **Discard**: Restores the draft to the dish's last loaded baseline, clearing the conflict without adopting unverified server changes.

---

### Database Setup, Migrations & Startup

No migrations needed. MongoDB with Mongoose creates the unique index on dishId.

#### 1. MongoDB Setup & Connection
- **Connection URI**: Configured via `MONGODB_URI` in `server/.env` (default: `mongodb://127.0.0.1:27017/nosh`).
- **Mongoose Model**: Defined in `server/src/models/dish.model.ts` on the `dishes` collection with a unique index on `dishId` (`unique: true, index: true`).
- **Prerequisites**: Ensure a local MongoDB instance (v6.0+) is running before starting the server or running seeds.

#### 2. Starting MongoDB
- **Windows (Service)**:
  ```powershell
  net start MongoDB
  ```
- **Windows (Manual via mongod)**:
  ```powershell
  mongod --dbpath "C:\data\db"
  ```
- **macOS / Linux (Homebrew or systemd)**:
  ```bash
  brew services start mongodb-community
  # or
  sudo systemctl start mongod
  ```
- **Verify connectivity**:
  ```powershell
  Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
  ```
  *(or on macOS/Linux: `nc -zv 127.0.0.1 27017`)*

---

### Prerequisites & Environment

- **Node.js**: Declared compatible engine range: `^22.22.2 || ^24.15.0 || >=26.0.0`
  - *Dependency engine requirements*: `jsdom@30.1.2`, `vitest@5.0.4`.
  - *Verification note*: Automated test suites (40 backend, 26 frontend) and production builds were verified locally on **Node.js v24.13.0** with **npm v10.8.0**.
- **npm**: v10+ (tested on v10.8.0).
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017`.

---

### Clone & Installation

Clone the repository:
```bash
git clone https://github.com/VishnuGurrapu/DishDashboard.git
cd DishDashboard
```

Install dependencies for both projects:

```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

Configure backend environment variables:
```bash
cd ../server
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

The `server/.env` defaults:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/nosh
CLIENT_URL=http://localhost:5173
```

---

### Database Seeding (`npm run seed`)

The seed script reads from `dish-assignment.json` in the root directory, validates every record against Zod schemas (`dishSeedItemSchema`), and inserts records idempotently:

```bash
cd server
npm run seed
```

- **Unique identifier**: `dishId` (unique string).
- **Default version**: Newly seeded dishes are inserted with `version: 1`.
- **Idempotency Guarantee**: If a dish already exists in the database, the seed script skips it without overwriting fields or resetting its version counter.
- **Rerun safety**: Running `npm run seed` repeatedly inserts only missing records.

---

### Project Structure

```text
NOSHAssignment/
├── client/                     # Frontend React + Vite + Tailwind CSS application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConflictBanner.tsx    # Conflict banner with Reload latest and Discard actions
│   │   │   ├── DishCard.tsx          # Card displaying image, status, version, draft inputs & actions
│   │   │   ├── Header.tsx            # Header branding, metrics, and refresh action
│   │   │   └── ImageWithFallback.tsx # Accessible image loader with fallback placeholder
│   │   ├── hooks/
│   │   │   └── useDishDashboard.ts   # Unified catalog draft state, OCC saves, and conflict handling
│   │   ├── services/
│   │   │   └── api.ts                # REST API client (fetchDishes, updateDish)
│   │   ├── types/
│   │   │   └── dish.ts               # TypeScript interfaces for dishes, drafts, and PATCH payloads
│   │   ├── utils/
│   │   │   └── dish.ts               # Normalization & meaningful change detection
│   │   ├── App.tsx                   # Main Dashboard UI with non-blocking error banner
│   │   ├── App.test.tsx              # Comprehensive frontend test suite (26 tests)
│   │   ├── index.css                 # Tailwind CSS imports & base styles
│   │   └── main.tsx                  # React DOM entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend Express + TypeScript application
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts           # MongoDB connection lifecycle module
│   │   │   └── env.ts          # Validated environment configuration
│   │   ├── models/
│   │   │   └── dish.model.ts   # Mongoose Dish model (dishId, dishName, imageUrl, isPublished, version)
│   │   ├── routes/
│   │   │   ├── dish.route.ts   # REST endpoints: GET /dishes, PATCH /dishes/:dishId
│   │   │   └── health.route.ts # Health check: GET /health
│   │   ├── schemas/
│   │   │   └── dish.schema.ts  # Zod schemas for seed validation and strict PATCH body validation
│   │   ├── scripts/
│   │   │   └── seed.ts         # CLI entrypoint for idempotent seeding
│   │   ├── services/
│   │   │   ├── dish.service.ts # Dish business rules & atomic conditional OCC updates
│   │   │   └── seed.service.ts # Idempotent seed service and schema validation
│   │   ├── app.ts              # Express application, CORS, JSON parser & error middleware
│   │   └── server.ts           # Server listener (connects to MongoDB before listening)
│   ├── tests/
│   │   ├── dish.test.ts        # Comprehensive API tests (31 tests)
│   │   ├── health.test.ts      # Health check test (1 test)
│   │   ├── seed.test.ts        # Seed logic & idempotency tests (8 tests)
│   │   └── test-utils.ts       # Test DB URI validator & safe cleanup helpers
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── dish-assignment.json        # Assignment seed data source
├── .gitignore
└── README.md                   # Full architecture, API, setup, and verification guide
```

---

### API Documentation & Error Handling

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
Atomically updates a dish using Optimistic Concurrency Control (OCC).

**Request Body Parameters**:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `expectedVersion` | integer (>= 1) | **Required** | The baseline version expected in MongoDB before this update is applied. |
| `dishName` | string | **Required** | Non-empty trimmed dish name. Whitespace-only strings are rejected. |
| `isPublished` | boolean | **Required** | Publication status flag (`true` or `false`). |

> **Strict Body Enforcement**: `imageUrl` is **not accepted** in PATCH requests. The schema uses Zod `.strict()`; passing unexpected fields (including `imageUrl`) results in an HTTP 400 rejection.

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

**Responses**:

- **`200 OK` (Successful Update)**:
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

- **`400 Bad Request` (Malformed JSON)**:
  Returned when the request body contains invalid or malformed JSON syntax:
  ```json
  {
    "error": "Bad Request",
    "message": "Invalid JSON body"
  }
  ```

- **`400 Bad Request` (Validation Failure or Unexpected Fields)**:
  Returned when required fields are missing, invalid, or unexpected fields (such as `imageUrl`) are passed:
  ```json
  {
    "error": "Bad Request",
    "message": "Request body validation failed.",
    "details": [
      "dishName: dishName cannot be empty or whitespace-only"
    ]
  }
  ```

- **`400 Bad Request` (Publishing Integrity Error)**:
  Returned when attempting to publish (`isPublished: true`) a dish whose stored database image URL is invalid or not using HTTP/HTTPS:
  ```json
  {
    "error": "Bad Request",
    "message": "Publishing requires a valid HTTP or HTTPS imageUrl."
  }
  ```

- **`404 Not Found` (Unknown Dish)**:
  Returned when the requested `dishId` does not exist in the database:
  ```json
  {
    "error": "Not Found",
    "message": "Dish with ID '999' was not found."
  }
  ```

- **`409 Conflict` (Version Conflict)**:
  Returned when `expectedVersion` does not match the database version (the record was modified concurrently). The database is left completely unchanged:
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

- **`500 Internal Server Error` (Unexpected Errors)**:
  Returned when an unexpected internal server exception occurs, without leaking sensitive internals:
  ```json
  {
    "error": "Internal Server Error",
    "message": "Unexpected error"
  }
  ```

---

### Working curl Examples

All examples assume the backend server is running on `http://localhost:5000`.

#### 1. Malformed JSON Request (`HTTP 400`)
```bash
curl -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{ "dishName": "Broken JSON", '
```
**Response**:
```json
{
  "error": "Bad Request",
  "message": "Invalid JSON body"
}
```

#### 2. PATCH with Invalid Input or Unexpected Field (`HTTP 400`)
Sending an unexpected field like `imageUrl` or missing required fields:
```bash
curl -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "dishName": "Jeera Rice",
    "isPublished": true,
    "expectedVersion": 1,
    "imageUrl": "https://example.com/new.jpg"
  }'
```
**Response**:
```json
{
  "error": "Bad Request",
  "message": "Request body validation failed.",
  "details": [
    "imageUrl: Unexpected field in request body"
  ]
}
```

#### 3. PATCH for an Unknown Dish (`HTTP 404`)
```bash
curl -X PATCH http://localhost:5000/dishes/999 \
  -H "Content-Type: application/json" \
  -d '{
    "dishName": "Unknown Dish",
    "isPublished": true,
    "expectedVersion": 1
  }'
```
**Response**:
```json
{
  "error": "Not Found",
  "message": "Dish with ID '999' was not found."
}
```

#### 4. Version Conflict (`HTTP 409`)
To reliably trigger a 409 conflict, send an `expectedVersion` that does not match the stored version (for example, sending `999` against a dish currently at `version: 1`):
```bash
curl -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "dishName": "Conflicting Update",
    "isPublished": true,
    "expectedVersion": 999
  }'
```
**Response**:
```json
{
  "error": "Conflict",
  "message": "Stale version conflict. Expected version 999, but current version is 1.",
  "currentDish": {
    "dishId": "1",
    "dishName": "Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 1
  }
}
```

---

### Dashboard Features

1. **Responsive Dish Catalog**:
   - Renders dishes with responsive grid layout (mobile, tablet, desktop).
   - Displays dish image with accessible fallback placeholder if image loading fails.
   - Status indicators: **Live** (green) vs **Unpublished** (slate), with a separate amber **Unsaved draft** badge for local uncommitted edits.
   - Version badge displaying the current persisted database revision (e.g. `v1`).
2. **Local Draft State Isolation**:
   - Editing name or toggling publication updates local React state only. Zero network requests occur while typing or toggling.
   - **Discard** button restores the local draft to the dish's last loaded baseline, clearing unsaved indicators.
3. **Optimistic Locking & Conflict UX**:
   - Save submits `dishName`, `isPublished`, and `expectedVersion`.
   - On `409 Conflict`:
     - Preserves the user's uncommitted draft without overwriting local input.
     - Displays a conflict banner detailing server version and current data.
     - Offers **Reload latest** (to adopt remote version) or **Discard** (to restore to baseline).
   - Buttons are disabled and display loading spinners while saves are in flight to prevent duplicate submissions.
4. **Refresh Error Resilience**:
   - If dishes are already loaded and a background or manual refresh fails, existing cards and active drafts remain visible.
   - A compact, non-blocking error banner with a **Retry Refresh** action is displayed above the grid instead of wiping out the screen with a full-page error state.

---

### Running the Applications

#### 1. Start the Backend Server
```bash
cd server
npm run dev
```
The server connects to MongoDB before listening on `http://localhost:5000`.

Available server scripts:
- `npm run dev`: Starts development server with live reload via `tsx watch`
- `npm run seed`: Executes the idempotent database seed script
- `npm run build`: Compiles TypeScript to JavaScript in `dist/`
- `npm start`: Runs the compiled production server (`dist/server.js`)
- `npm test`: Runs automated test suite via Vitest (40 tests)

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
- `npm test`: Runs Vitest component & integration test suite (26 tests)
- `npm run lint`: Runs Oxlint linter (`0 errors, 0 warnings`)
- `npm run preview`: Previews the production build

---

### Step-by-Step Manual Verification Guide

#### Procedure A: Failed Save and Draft Recovery (Offline Backend)
1. Start the application normally (`npm run dev` in both `server/` and `client/`) and open `http://localhost:5173`.
2. Stop the backend server by pressing `Ctrl+C` in the backend terminal window, while leaving the frontend browser tab open.
3. In the browser, edit the name of Dish 1 (e.g. change to `Offline Draft Name`) and click **Save**.
4. Confirm that an error banner appears indicating network/save failure, and confirm that your edited text and the amber **Unsaved draft** badge remain completely intact.
5. Restart the backend server (`cd server && npm run dev`) and click **Save** again.
6. The save will succeed if the database record was untouched. If another process modified the version while the server was down, a **Version Conflict** banner will appear; inspect the conflict values and click **Reload latest** when appropriate to synchronize.

#### Procedure B: Invalid Stored Image URL Publishing Safeguard
> **Warning**: This test modifies database records directly and should **only** be performed in an isolated local development/test database (`mongodb://127.0.0.1:27017/nosh`). Never execute this test against production or shared databases.

1. **Back up the complete original record**:
   Open a terminal and connect to MongoDB using `mongosh`:
   ```javascript
   use nosh;
   // Capture the complete original Dish 5 document into an in-memory variable
   const originalDish5 = db.dishes.findOne({ dishId: "5" });
   printjson(originalDish5);
   ```
   > **Important Backup Note**: Keep this `mongosh` terminal session open throughout the test so that the in-memory `originalDish5` variable remains in scope for exact restoration in Step 5. If you close `mongosh` or switch sessions, write the document to a temporary backup collection first (`db.dishes_backup.insertOne(db.dishes.findOne({ dishId: "5" }))`) or record the full JSON output shown by `printjson`.

2. **Verify current version & simulate an invalid stored image URL**:
   Inspect the document's current version:
   ```javascript
   const currentVersion = originalDish5.version;
   print("Current version before test:", currentVersion);
   ```
   Set Dish 5 to an invalid non-HTTP URL protocol and set `isPublished` to `false` (leaving `version` unchanged):
   ```javascript
   db.dishes.updateOne(
     { dishId: "5" },
     {
       $set: {
         imageUrl: "ftp://invalid-server.local/alfredo.jpg",
         isPublished: false
       }
     }
   );
   ```
   Confirm the record in MongoDB has `isPublished: false` and note its exact current version:
   ```javascript
   const unpubDoc = db.dishes.findOne({ dishId: "5" });
   print("Verified version in DB:", unpubDoc.version);
   ```

3. **Attempt to publish the dish via PATCH**:
   Execute a PATCH request attempting to publish Dish 5 (`isPublished: true`), providing `dishName`, `isPublished: true`, and the exact verified `version` from Step 2 as `expectedVersion` (substitute `1` below with the actual version if your database record has already advanced):
   ```bash
   # Use the exact version verified in Step 2 for expectedVersion (e.g. 1)
   curl -X PATCH http://localhost:5000/dishes/5 \
     -H "Content-Type: application/json" \
     -d '{
       "dishName": "Alfredo Pasta",
       "isPublished": true,
       "expectedVersion": 1
     }'
   ```

4. **Verify rejection & record immutability**:
   - The API rejects the request with `HTTP 400 Bad Request`:
     ```json
     {
       "error": "Bad Request",
       "message": "Publishing requires a valid HTTP or HTTPS imageUrl."
     }
     ```
   - In `mongosh`, verify that the record was **not** updated:
     ```javascript
     const checkDoc = db.dishes.findOne({ dishId: "5" });
     print("isPublished:", checkDoc.isPublished); // Must still be false
     print("version:", checkDoc.version);         // Must remain unchanged
     ```

5. **Safely restore the exact original record**:
   Restore the complete backed-up document from Step 1, preserving its exact original `version`, `imageUrl`, and metadata:
   ```javascript
   // Restore the complete original document from the in-memory backup
   db.dishes.replaceOne({ dishId: "5" }, originalDish5);

   // Verify full restoration
   printjson(db.dishes.findOne({ dishId: "5" }));
   ```
   *(If your `mongosh` session was closed, restore using the temporary collection `db.dishes.replaceOne({ dishId: "5" }, db.dishes_backup.findOne({ dishId: "5" }))`, or update fields using the printed backup JSON values matching the document's original version rather than assuming `version: 1`)*.

   *Safety Note*: Because the original document and version are restored verbatim, this test is safe to repeat without drifting versions or leaving corrupted image URLs in the database.

#### Procedure C: Two-Tab Optimistic Concurrency Conflict Simulation
1. Open `http://localhost:5173` in two side-by-side browser tabs (Tab A and Tab B).
2. In Tab A, edit Dish 1 to `Jeera Rice Deluxe` and click **Save**. Tab A succeeds and advances Dish 1 to `v2`.
3. In Tab B (which still has Dish 1 loaded at `v1`), edit the name to `Jeera Rice Special` and click **Save**.
4. Tab B receives `HTTP 409 Conflict`. A **Version Conflict Detected** banner appears showing the latest server version (`v2`) and latest name (`Jeera Rice Deluxe`).
5. Tab B's uncommitted draft (`Jeera Rice Special`) is preserved. Click **Reload latest** to sync with Tab A's version, or click **Discard** to revert to the baseline.

#### Procedure D: Refresh Error Non-Blocking Banner
1. Load `http://localhost:5173` with dishes visible.
2. In DevTools Network tab, switch throttling to **Offline** (or stop backend).
3. Click the **Refresh** button in the header.
4. Verify that existing dish cards remain visible on screen, and a compact red banner appears above the grid stating `Failed to refresh dishes.` with a **Retry Refresh** button.

---

### Running Tests

#### Backend Test Suite (40 tests):
```bash
cd server
npm test
```
*Executes against an isolated test database (`nosh_test_isolated_suite` or `nosh_test`) guarded by strict database allowlists.*

Test coverage across 3 test suites:
- **`seed.test.ts` (8 tests)**: Seed structure validation, required fields, protocol checks, duplicate prevention, default versioning, and strict re-seed idempotency without overwriting user edits.
- **`health.test.ts` (1 test)**: Automated service health check.
- **`dish.test.ts` (31 tests)**:
  - `GET /dishes`: Retrieval and sorting.
  - `PATCH /dishes/:dishId`: Atomic updates, optimistic locking, version incrementation, race conditions with simultaneous requests.
  - Concurrency safety: 409 conflict handling, draft preservation, rejection of concurrent requests with identical `expectedVersion`.
  - Validation safeguards: Empty/whitespace names, non-string types, missing required fields (`expectedVersion`, `dishName`, `isPublished`), strict rejection of unexpected fields (`imageUrl`).
  - Publishing integrity: Rejection of publishing when stored database image URL has invalid/non-HTTP protocols.
  - Global error handling: HTTP 400 for malformed JSON bodies, generic HTTP 500 without leaking stack traces.
  - Database immutability: Ensuring validation errors and 409 conflicts never alter database state.

#### Frontend Test Suite (26 tests):
```bash
cd client
npm test
```
*Executes via Vitest & React Testing Library.*

Test coverage across 1 test suite (`src/App.test.tsx`):
- **UI States & Cards**: Initial loading skeleton, empty state, dish cards, and image fallback placeholders.
- **Local Draft Isolation**: React state draft updates without network calls while typing or toggling.
- **Discard Invariants**: Discarding restores the draft to the last loaded baseline, clearing unsaved indicators and conflicts without adopting server state.
- **Conflict Handling**: Preserves drafts on 409, provides explicit **Reload latest** vs **Discard** options.
- **Refresh Resilience**: Keeps loaded dish cards and local drafts rendered when refresh fails, displaying a non-blocking retry banner.
- **Publication Labels**: Saved dishes with `isPublished: false` display **Unpublished** (not Draft); **Unsaved draft** is kept as an independent indicator for dirty local edits.
- **Explicit PATCH Contract**: Verifies save submissions always send `dishName`, `isPublished`, and `expectedVersion`, omitting `imageUrl`.
- **Multi-Session Concurrency**: Simulates two independent dashboard sessions updating the same dish concurrently.

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

### Time Spent, Scaffolding & AI Assistance Disclosure

- **Total Time Spent**: Approximately 4.5 hours across development phases:
  - *Phase 1 (Foundation & Setup)*: ~35 mins
  - *Phase 2 (Database, Dish Model & Seeding)*: ~45 mins
  - *Phase 3 (Version-Controlled REST API & OCC)*: ~60 mins
  - *Phase 4 (React Dashboard, Draft State & Conflict UX)*: ~90 mins
  - *Phase 5 (Testing, Edge Cases & Verification)*: ~40 mins
- **Scaffolding & Starter Template**:
  - The client project was scaffolded using Vite's standard React + TypeScript template (`create-vite`). Unused default template files (`App.css`, sample SVGs, and boilerplate README) were subsequently audited and removed during repository cleanup.
  - The backend server was established as an Express + TypeScript service using standard `npm init` and TypeScript configuration.
- **External Application Code**:
  - None. No third-party application code, component libraries, or copied snippet repositories were used outside of standard open-source dependencies declared in `package.json` (React, Vite, Tailwind CSS, Express, Mongoose, Zod, and Vitest).
- **Work Completed by Author**:
  - Architecture and domain model design (Dish schema, version tracking, idempotency guarantees).
  - Formulation of atomic optimistic concurrency control strategy using MongoDB `findOneAndUpdate`.
  - Component hierarchy, Tailwind layout styling, draft state isolation logic, and non-blocking error recovery.
  - Review, test execution, and verification of all review fixes and invariants.
- **AI Assistance Used**:
  - Google DeepMind Antigravity IDE (Gemini agent) was utilized as an AI pair-programming assistant for boilerplate scaffolding, test authoring, code review issue identification, React hook lint remediation, and documentation refinement.
  - All architecture decisions, atomic update mechanics, strict database guards, and React draft management patterns were reviewed and validated against assignment specifications.
