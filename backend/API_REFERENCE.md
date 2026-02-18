# BITS Backend API Reference

> **Base URL:** `http://localhost:5000/api` (or via Next.js proxy at `/api`)

## Authentication

All endpoints (except login) require:

```
Authorization: Bearer <token>
```

The token is returned from the login endpoint. Store it in `localStorage` after login.

---

## Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/auth/login` | `{ email, password }` | `{ success, token, employee }` |

After login, store both `token` and `employee` in localStorage:
```js
localStorage.setItem('token', data.token)
localStorage.setItem('employee', JSON.stringify(data.employee))
```

---

## Employees

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/employees` | List all employees | Admin, HR |
| `POST` | `/api/employees` | Create employee | Admin |
| `PUT` | `/api/employees/:id` | Update employee | Admin |
| `DELETE` | `/api/employees/:id` | Delete employee | Admin |

### Employee Object Shape

```json
{
  "id": 1,
  "zkId": 1,
  "employeeNumber": "EMP001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "role": "EMPLOYEE",
  "department": "Engineering",
  "position": "Developer",
  "branch": "MAIN OFFICE",
  "contactNumber": "09171234567",
  "hireDate": "2024-01-15T00:00:00.000Z",
  "employmentStatus": "ACTIVE",
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

> **Note:** Roles are uppercase: `ADMIN`, `HR`, `EMPLOYEE`

---

## Attendance

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/attendance` | Query attendance records | Admin, HR |
| `GET` | `/api/attendance/today` | Get today's records | Admin, HR |
| `GET` | `/api/attendance/employee/:id` | Employee history | Admin, HR |

### Query Parameters for `GET /api/attendance`

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `startDate` | `YYYY-MM-DD` | `2026-02-01` | Filter from this date |
| `endDate` | `YYYY-MM-DD` | `2026-02-18` | Filter up to this date |
| `employeeId` | `number` | `3` | Filter by employee |
| `status` | `string` | `late` | Filter by status |
| `page` | `number` | `1` | Pagination page |
| `limit` | `number` | `100` | Records per page |

### Attendance Object Shape

```json
{
  "id": 1,
  "employeeId": 3,
  "date": "2026-02-18T00:00:00.000Z",
  "checkInTime": "2026-02-18T00:05:23.000Z",
  "checkOutTime": "2026-02-18T09:00:00.000Z",
  "checkInTimePH": "8:05 AM",
  "checkOutTimePH": "5:00 PM",
  "status": "present",
  "employee": {
    "id": 3,
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "branch": "MAIN OFFICE"
  }
}
```

> ⚠️ **Important:** The time fields are `checkInTime` and `checkOutTime` — NOT `checkIn`/`checkOut`. The `checkInTimePH` and `checkOutTimePH` fields are pre-formatted Philippine time strings.

---

## User Management

| Method | Endpoint | Body | Access |
|--------|----------|------|--------|
| `GET` | `/api/users` | — | Admin, HR |
| `POST` | `/api/users` | `{ firstName, lastName, email, password, role }` | Admin |
| `PUT` | `/api/users/:id` | `{ firstName, lastName, email, role, ... }` | Admin |
| `DELETE` | `/api/users/:id` | — | Admin |
| `PATCH` | `/api/users/:id/toggle-status` | — | Admin |

---

## Self-Service (any logged-in user)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `PUT` | `/api/users/profile` | `{ firstName, lastName, contactNumber }` | Update own profile |
| `PUT` | `/api/users/change-password` | `{ currentPassword, newPassword }` | Change own password |

---

## Common Response Format

All endpoints return:

```json
{
  "success": true,
  "data": [ ... ],
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Frontend Integration Checklist

1. **Remove `@/lib/mock-data`** — replace all mock imports with `fetch()` calls to these endpoints
2. **Add `Authorization` header** — read token from `localStorage` on every request
3. **Handle 401** — if any request returns 401, clear localStorage and redirect to `/login`
4. **Use correct field names:**
   - Attendance: `checkInTime` / `checkOutTime` (not `checkIn` / `checkOut`)
   - Employee names: `firstName` + `lastName` (not `name`)
   - Roles: uppercase `ADMIN`, `HR`, `EMPLOYEE`
5. **Proxy setup** — make sure `next.config.js` proxies `/api` requests to `http://backend:5000`
