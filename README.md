# Nosh Full Stack Intern Assignment: Dish Dashboard

## Phase 1: Project Foundation

This project is a full-stack dashboard for managing dish catalogs, supporting draft editing and safe concurrent updates.

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Local MongoDB with Mongoose (configured for Phase 2)
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
│   │   │   └── env.ts          # Environment configuration
│   │   ├── routes/
│   │   │   └── health.route.ts # GET /health route
│   │   ├── app.ts              # Express application & middleware
│   │   └── server.ts           # Server HTTP listener
│   ├── tests/
│   │   └── health.test.ts      # Automated health endpoint test
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
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` (required for upcoming Phase 2 data persistence)

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

Default `.env` configuration:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/nosh
CLIENT_URL=http://localhost:5173
```

---

### Running the Applications

#### 1. Start the Backend Server
```bash
cd server
npm run dev
```
The server will start on `http://localhost:5000`.

Available server scripts:
- `npm run dev`: Starts development server with live reload via `tsx watch`
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

Available client scripts:
- `npm run dev`: Starts the Vite development server
- `npm run build`: Type-checks and builds production bundle in `dist/`
- `npm run preview`: Previews the production build locally

---

### Verifying GET /health

#### Option A: Using curl / terminal
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Nosh Dish Dashboard API is healthy",
  "timestamp": "2026-10-12T14:00:00.000Z"
}
```

#### Option B: In the Web Browser
Visit [http://localhost:5000/health](http://localhost:5000/health) or open the frontend at [http://localhost:5173](http://localhost:5173) and click **"Check Status"**.

---

### Running Tests

To verify backend routes:
```bash
cd server
npm test
```
