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
│   │   │   └── health.route.ts # GET /health route
│   │   ├── schemas/
│   │   │   └── dish.schema.ts  # Zod schemas for validating dish records
│   │   ├── scripts/
│   │   │   └── seed.ts         # Executable idempotent seed script CLI
│   │   ├── services/
│   │   │   └── seed.service.ts # Core seed logic & validation service
│   │   ├── app.ts              # Express application & middleware
│   │   └── server.ts           # Server HTTP listener (connects to MongoDB before listening)
│   ├── tests/
│   │   ├── health.test.ts      # Automated health endpoint test
│   │   └── seed.test.ts        # Unit & safe integration tests for seed logic
│   ├── .env.example            # Example environment variables
│   ├── package.json
│   └── tsconfig.json
├── dish-assignment.json        # Assignment seed data source (kept in root)
├── .gitignore                  # Root gitignore for workspace
└── README.md                   # Setup and run guide
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

Example output:
```text
🌱 Starting dish database seed script...
✅ MongoDB connected successfully: 127.0.0.1/nosh
📖 Reading seed source: C:\vishnuprojects\NOSHAssignment\dish-assignment.json
----------------------------------------------------
✨ Seed operation completed successfully:
   Total items evaluated: 5
   Newly inserted dishes:  5
   Inserted IDs:          [1, 2, 3, 4, 5]
   Preserved/skipped:     0
----------------------------------------------------
🔌 Disconnected from MongoDB
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

### Verifying GET /health

#### Using curl:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Nosh Dish Dashboard API is healthy",
  "timestamp": "2026-10-12T14:28:16.164Z"
}
```

---

### Running Tests

Automated tests are non-destructive. Integration tests execute against an isolated test database (`nosh_test_isolated_suite`), ensuring the developer's main database (`nosh`) is **never** reset or cleared:

```bash
cd server
npm test
```
