# Field Reporting App

An offline-first, mobile field reporting application built with **React Native** (TypeScript) and a companion **Node.js/Express** backend. Designed for field workers operating in low-connectivity or intermittent network environments where every report must reliably reach the server without data loss or duplicate records.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Upload Queue Lifecycle](#upload-queue-lifecycle)
- [Failure Handling & Resilience](#failure-handling--resilience)
- [Idempotency: "Nothing Lands Twice"](#idempotency-nothing-lands-twice)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Testing Failure Simulation Modes](#testing-failure-simulation-modes)
- [Project Structure](#project-structure)

---

## Key Features

1. **Offline-First Report Creation**:
   - Save reports locally to SQLite immediately with compressed camera/gallery images (up to 5 images per report).
   - Images are copied to dedicated permanent storage (`DocumentDir/reports/<id>/`) so temporary picker cache clears never corrupt saved drafts.

2. **Sequential Background Upload Queue**:
   - Independent pure module runner (`queue-runner.ts`) processes pending reports one by one in the order created.
   - Live UI updates: cards transition smoothly through `pending` → `uploading` → `waiting` → `uploaded`.
   - Streaming upload via `react-native-blob-util` to avoid loading multi-megabyte JPEGs simultaneously into the JavaScript heap.

3. **Authoritative Server Tab**:
   - **Upload Queue** tab displays reports stored on-device awaiting upload. Once uploaded, cards are immediately removed from the queue.
   - **All Reports** tab fetches directly from the server via TanStack Query (`GET /api/reports`). It never reads uploaded reports from local SQLite, ensuring server-side truth.

4. **Failure UX & Manual Retry**:
   - Cards display status badges with spinners during upload.
   - When an upload fails, the card surfaces a single-line truncated `lastError` and a **"Tap to retry upload"** button.
   - When retries are exhausted (e.g. after 5 attempts), a global **"Retry all failed"** button appears in the queue header.
   - Full network error state on the All Reports tab with an interactive **"Retry"** button.

5. **Start Over / Reset**:
   - Deliberate reset button in the header with confirmation prompt.
   - Cleans local SQLite rows, deletes local image directories, and resets the queue runner without deleting server-side authoritative data.

---

## Architecture & Tech Stack

### Frontend
- **Framework**: React Native 0.74 (TypeScript)
- **Local Database**: `@op-engineering/op-sqlite` (high-performance C++ SQLite binding)
- **File System & Streaming**: `react-native-blob-util`
- **Network State**: `@react-native-community/netinfo`
- **Server Data Caching**: `@tanstack/react-query`
- **Image Handling**: `react-native-image-picker` + `react-native-image-resizer`

### Backend
- **Framework**: Express.js (Node.js + TypeScript)
- **Database**: SQLite (`better-sqlite3`)
- **Multipart Uploads**: `multer`
- **Validation**: `zod`
- **Failure Simulator**: Express middleware simulating real-world network edge cases

---

## Upload Queue Lifecycle

Every report transitions through a transparent, crash-safe state machine:

```
[Create Report]
       │
       ▼
  ('pending')  ◄────────────────────────┐
       │                                │  (Manual retry or auto back-off)
       ▼                                │
  ('uploading') ── (Streams bytes)      │
       │                                │
       ▼                                │
   ('waiting')  ── (Awaiting response)  │
       │                                │
       ├───────────────┬────────────────┘
       │ (HTTP 200/201)│ (4xx / 5xx / timeout)
       ▼               ▼
  ('uploaded')     ('failed')
  (Removed from    (Shows lastError +
   Queue Tab)       Retry button)
```

1. **`pending`**: Saved locally to SQLite and waiting for its turn in the sequential queue.
2. **`uploading`**: Multipart multipart data is actively streaming from disk to the network socket. An `ActivityIndicator` displays on the card.
3. **`waiting`**: All bytes have been transmitted; awaiting server confirmation.
4. **`uploaded`**: Confirmed by the server with HTTP 200 or 201. Removed from the queue list immediately; TanStack Query cache is marked stale so the All Reports tab fetches fresh data.
5. **`failed`**: An error occurred. The exact error message is persisted in SQLite `last_error` and displayed on the card.

---

## Failure Handling & Resilience

- **Crash Resilience**:
  If the application is killed or crashes while a report is in `uploading` or `waiting`, `resetStuckReports()` rewinds those reports back to `pending` on the next app startup. No report gets stuck in limbo.
- **Offline Pause**:
  `waitForNetwork()` monitors connectivity using `NetInfo`. When offline, the runner pauses execution without burning retry attempts. As soon as the device reconnects, the queue resumes immediately.
- **Exponential Back-Off**:
  Server errors (5xx, 408, 429) back off exponentially:
  `delay = min(1000 * 2^(attempts - 1), 60000) ms`
  (1s, 2s, 4s, 8s, 16s, 32s, 60s).
- **Non-blocking Unsticking**:
  Once a report reaches `MAX_UPLOAD_ATTEMPTS = 5`, automatic retries pause so subsequent reports in the queue are not blocked. The user can tap **"Tap to retry upload"** or **"Retry all failed"** to reset attempts and wake the runner.
- **Explicit 90s Timeout**:
  Every upload request enforces a 90-second timeout via `RNBlobUtil.config({ timeout: 90000 })`. This prevents the queue from hanging indefinitely when testing against hanging server connections.

---

## Idempotency: "Nothing Lands Twice"

When an upload request is sent, the local report UUID is attached as the `Idempotency-Key` header:

```http
POST /api/reports HTTP/1.1
Idempotency-Key: 3fa85f64-5717-4562-b3fc-2c963f66afa6
Content-Type: multipart/form-data
```

1. The backend uses the `Idempotency-Key` as the report's primary key in SQLite.
2. If the connection drops **after** the server commits the record but **before** the client receives the HTTP response (`lost-response` scenario):
   - The client retries the upload with the **same** `Idempotency-Key`.
   - The server detects the existing record, rolls back the insert attempt, and responds with `HTTP 200` and the existing report.
   - The client marks the report as `uploaded`. **Duplicate rows are never created.**

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Android Studio (for Android emulator/device) or Xcode (for iOS simulator/device)

---

### Backend Setup

1. Open a terminal in the `backend` directory:
   ```sh
   cd backend
   npm install
   ```

2. Start the backend server:
   ```sh
   npm run dev
   ```
   The backend will start on `http://localhost:5000`.

---

### Frontend Setup

1. Open a terminal in the `frontend` directory:
   ```sh
   cd frontend
   npm install
   ```

2. Configure environment variables in `frontend/.env`:
   - For Android Emulator:
     ```env
     API_BASE_URL=http://10.0.2.2:5000
     ```
   - For iOS Simulator:
     ```env
     API_BASE_URL=http://localhost:5000
     ```
   - For physical device on local Wi-Fi:
     ```env
     API_BASE_URL=http://<YOUR_COMPUTER_IP>:5000
     ```

3. Start Metro bundler:
   ```sh
   npm start
   ```

4. In a separate terminal, launch the application:
   - **Android**: `npm run android`
   - **iOS**: `cd ios && pod install && cd .. && npm run ios`

---

## Testing Failure Simulation Modes

The backend includes a `failure-simulation-middleware` triggered by the `x-simulate-failure` header or by modifying backend requests. You can test each resilience scenario:

| Mode | Simulated Behavior | Expected App Behavior |
|---|---|---|
| `latency` | 10-second artificial delay | Report enters `waiting` ("Waiting for response") state, then completes without failing. |
| `server-error` | HTTP 503 Service Unavailable | Report marks as `failed` with exponential back-off; retry button appears on card. |
| `connection-drop`| TCP socket destroyed during transfer | Client catches socket error and retries once connection is restored. |
| `hang` | Server never responds | Client enforces 90s timeout, marks report as `failed` with timeout message, and moves to next report. |
| `lost-response` | Socket destroyed after database commit | On retry, server returns HTTP 200 with existing record; report safely marks as `uploaded` with no duplicates. |

---

## Project Structure

```
field-reporting-app/
├── backend/
│   ├── src/
│   │   ├── config/database.ts           # better-sqlite3 database connection
│   │   ├── controller/report-controller.ts # Multipart upload & idempotency handling
│   │   ├── middleware/failure-simulation-middleware.ts # Failure mode simulations
│   │   ├── route/report-routes.ts       # Express router definition
│   │   └── server.ts                    # Server startup & error handler
│   └── uploads/                         # Permanent server-side image storage
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── axios-instance.ts        # Axios client instance
    │   │   └── reports-api.ts           # Server reports fetching API
    │   ├── components/
    │   │   ├── create-report-modal/     # Camera & photo draft modal
    │   │   ├── report-card/             # Card UI with status badges, thumbnails & retry
    │   │   └── reports-tab/             # Toggle between Queue and All Reports
    │   ├── database/
    │   │   ├── database.ts              # op-sqlite table creation & schema
    │   │   └── report-repository.ts     # SQLite CRUD operations & queries
    │   ├── screens/
    │   │   └── reports/                 # Main reports screen with tabs & reset button
    │   ├── services/
    │   │   ├── query-client.ts          # TanStack Query client configuration
    │   │   ├── queue-runner.ts          # Sequential background upload runner
    │   │   └── upload-service.ts        # Multipart streaming upload with RNBlobUtil
    │   ├── types/
    │   │   └── index.ts                 # Shared TypeScript models & enums
    │   └── utils/
    │       ├── compress-image.ts        # Iterative compression utility
    │       ├── constant.ts              # Status configurations & retry limits
    │       ├── helper.ts                # Date formatting helpers
    │       └── image-storage.ts         # Persistent local file storage
    └── App.tsx                          # App root with Providers
```
