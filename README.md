# Nosh Full Stack Intern Assignment: Dish Dashboard

A full-stack dashboard for managing dish catalogs, supporting draft editing and safe concurrent updates.

---

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Local MongoDB with Mongoose
- **Validation**: Zod
- **Testing**: Vitest & Supertest

---

### Project Structure

```text
NOSHAssignment/
├── client/                     # Frontend React + Vite + Tailwind CSS application
│   ├── src/
│   │   ├── App.tsx             # Foundation dashboard landing & health status checker
│   │   ├── index.css           # Tailwind CSS imports & base styles
│   │   └── main.tsx            # React entrypoint
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
│   │   └── seed.test.ts        # Unit & safe integration tests for seed logic
│   ├── .env.example            # Example environment variables
│   ├── package.json
│   └── tsconfig.json
├── dish-assignment.json        # Assignment seed data source (kept in root)
├── .gitignore                  # Root gitignore for workspace
└── README.md                   # Setup, run, and API guide
```

---

### Prerequisites

- **Node.js**: v18+ (tested on v24.x)
- **npm**: v9+ (tested on v10.x)
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
- `npm test`: Runs automated test suite via Vitest

#### 2. Start the Frontend Client
In a separate terminal:
```bash
cd client
npm run dev
```
The Vite development server will start at `http://localhost:5173`.

---

### Running Tests

Automated tests execute safely against an isolated test database (`nosh_test_isolated_suite`). The developer's main database (`nosh`) is **never** reset or cleared:

```bash
cd server
npm test
```
