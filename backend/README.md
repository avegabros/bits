# Backend Service & ZKTeco Integration

## 📌 Overview
This is the backend service for the Biometric Attendance System. It manages:
-   **Employee Data** (PostgreSQL)
-   **Authentication** (JWT, RBAC)
-   **ZKTeco Device Communication** (Syncing users, Fetching logs, Enrollment)

## 🛠️ Tech Stack
-   **Runtime:** Node.js (v18+)
-   **Language:** TypeScript
-   **Framework:** Express.js
-   **Database:** PostgreSQL (via Prisma ORM)
-   **Device Lib:** `node-zklib` (Pure JavaScript implementation, no Python required)
-   **Docs:** Swagger UI

---

## 📂 Project Structure
Following a **Layered Architecture**:

| Directory | Purpose |
| :--- | :--- |
| **`src/controllers`** | Handles HTTP requests/responses. No business logic here. |
| **`src/services`** | Business logic (e.g., `zkServices.ts`, `auth.service.ts`). |
| **`src/routes`** | API URL definitions and middleware mapping. |
| **`src/lib`** | Core utilities and drivers. |
| **`src/lib/zk-driver.ts`** | **Critical:** The robust wrapper class for ZKTeco communication. |
| **`src/validators`** | Input validation schemas (express-validator). |
| **`src/scripts`** | Standalone utility scripts for testing and maintenance. |

---

## 🤖 ZKTeco Device Integration

We use a custom **`ZKDriver`** class (`src/lib/zk-driver.ts`) to manage the device.

### 1. The Driver (`ZKDriver`)
Encapsulates low-level socket communication.
-   **`connect()`**: Establishes session.
-   **`getLogs()`**: Fetches attendance records.
-   **`setUser(id, name, ...)`**: Uploads employee info to the device.
-   **`getUsers()`**: Downloads user info from the device.

### 2. Fingerprint Enrollment
**File:** `src/services/fingerprintEnrollment.service.ts`

Traditional ZK libraries cannot easily trigger "Remote Enrollment". We implemented a custom sequence:
1.  **Sync User:** Ensures the user exists on the device.
2.  **Start Enroll:** Sends `CMD_STARTENROLL` command.
3.  **User Action:** The employee presses their finger 3 times on the physical device.
4.  **Result:** Device saves the template internally.

> **Note:** We do NOT store fingerprint templates in our database. We let the device handle biometric storage for security and privacy.

---

## 🚀 Running the Project

### A. Docker (Recommended)
The backend is part of the `docker-compose` stack.
```bash
# Rebuild and start
docker-compose up -d --build backend
```

### B. Local Development
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Setup Database:**
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```
3.  **Run Server:**
    ```bash
    npm run dev
    ```

### C. Swagger Documentation
Once running, verify endpoints at:
-   **Local:** `http://localhost:3001/api-docs`
-   **Docker:** `http://localhost:3000/api-docs` (via Nginx/Frontend proxy if configured, or direct port mapping)

---

## 📜 Key Commands

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm run start` | Runs the compiled code |
| `npm run dev` | Runs in watch mode (nodemon) |
| `npx ts-node src/scripts/test-connection.ts` | Quickly test ZK Device connectivity |

---

## ⚠️ Troubleshooting ZK Connection
-   **Timeout/Unreachable:** Check if the device IP (`ZK_HOST` in `.env`) is correct and on the same network.
-   **Busy:** The device can only handle **one connection at a time**. If the server is syncing, you cannot open the menu on the device, and vice versa.
