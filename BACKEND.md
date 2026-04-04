# TRU PCI DSS Evidence Management Platform - Backend Documentation

## Overview

This is a production-quality Node.js + Express + SQLite backend for the TRU PCI DSS v4.0 Evidence Management Platform. The platform supports evidence collection, review workflows, and audit tracking for all 12 PCI DSS requirements.

## Architecture

### Core Components

1. **Database Layer** (`src/db.js`)
   - SQLite database with WAL mode for concurrent access
   - 6 tables with comprehensive schema
   - Singleton pattern via `getDb()` function
   - Automatic table creation on initialization

2. **Authentication** (`src/auth.js`)
   - JWT-based authentication
   - bcryptjs for password hashing
   - Token expiry: 7 days
   - Password verification utility

3. **Middleware** (`src/middleware/`)
   - `requireAuth`: JWT verification and user context injection
   - `requireRole`: Role-based access control factory

4. **Evidence Scanner** (`src/scanner.js`)
   - Folder structure analysis for Requirement 1-12
   - Evidence type detection (screenshot, scan, config, document)
   - Sub-requirement extraction from folder paths
   - Database synchronization with UPSERT logic

5. **API Routes** (`src/routes/`)
   - `auth.js`: Authentication endpoints
   - `dashboard.js`: Statistics and reporting
   - `evidence.js`: Evidence management with file upload/download
   - `comments.js`: Comment threads on evidence
   - `admin.js`: User management and admin functions

6. **Server** (`server.js`)
   - Express application setup
   - Route mounting
   - Database initialization
   - Automatic user seeding
   - Folder scanning on startup

## Database Schema

### users
```sql
id, username (UNIQUE), password_hash, display_name,
role (admin|tru_team|iexpert_pm|iexpert_grc|assessor),
email, assigned_requirements (comma-separated), created_at, is_active
```

### evidence_points
```sql
id, requirement_id (1-12), sub_requirement, folder_path (UNIQUE),
folder_name, evidence_type (screenshot|scan|config|document),
status (empty|uploaded|under_review|pm_approved|pm_revision|
        grc_approved|grc_revision|admin_approved|assessor_approved|assessor_rejected),
assigned_owner, current_file, file_version, has_original_doc,
updated_at, updated_by
```

### comments
```sql
id, evidence_point_id (FK), user_id (FK), username, display_name,
role, comment, created_at
```

### file_versions
```sql
id, evidence_point_id (FK), version, filename, original_name,
uploaded_by, uploaded_at, file_size, mime_type
```

### audit_log
```sql
id, user_id, username, action, target, details, created_at
```

## API Endpoints

### Authentication (`/api/auth`)

- `POST /login`
  - Required: `username`, `password`
  - Returns: JWT token + user info

- `GET /me` (requires auth)
  - Returns: Current user profile

- `POST /register` (admin only)
  - Required: `username`, `password`, `display_name`, `role`
  - Optional: `email`, `assigned_requirements` (array)

### Dashboard (`/api/dashboard`)

- `GET /stats` (requires auth)
  - Returns: Overall counts, by status, by type, by requirement

- `GET /requirements` (requires auth)
  - Returns: All 12 PCI DSS requirements with statistics

### Evidence (`/api/evidence`)

- `GET /` (requires auth)
  - Query filters: `requirement_id`, `status`, `type`, `owner`, `search`
  - Returns: Filtered evidence points

- `GET /:id` (requires auth)
  - Returns: Evidence point with comments and file versions

- `PATCH /:id/status` (requires auth, role-gated)
  - Required: `status`
  - Allowed statuses per role:
    - `admin`: any status
    - `tru_team`: uploaded
    - `iexpert_pm`: pm_approved, pm_revision, under_review
    - `iexpert_grc`: grc_approved, grc_revision, under_review
    - `assessor`: assessor_approved, assessor_rejected

- `POST /:id/upload` (requires auth, multipart/form-data)
  - Allowed roles: `tru_team` (own assigned), `iexpert_grc`, `admin`
  - Form data: `file` (multipart)
  - Stores in: `data/uploads/{evidenceId}/v{version}_{filename}`

- `GET /:id/download/:version?` (requires auth)
  - Returns: File download
  - If no version specified, downloads latest

- `GET /:id/preview` (requires auth)
  - Returns: File inline for browser preview

### Comments (`/api/comments`)

- `GET /:evidenceId` (requires auth)
  - Returns: Comments ordered by created_at DESC

- `POST /:evidenceId` (requires auth)
  - Required: `comment` (text)
  - Returns: Created comment with metadata

### Admin (`/api/admin`, admin only)

- `GET /users`
  - Returns: All users with role and assignment info

- `POST /users`
  - Required: `username`, `password`, `display_name`, `role`
  - Optional: `email`, `assigned_requirements`

- `PATCH /users/:id`
  - Optional: `display_name`, `role`, `email`, `assigned_requirements`, `is_active`
  - Updates specified fields only

- `POST /scan`
  - Triggers folder rescan
  - Returns: Scan statistics (inserted, updated, errors)

- `GET /audit-log`
  - Query params: `limit` (default 50), `offset` (default 0)
  - Returns: Paginated audit entries

## Running the Application

### Installation
```bash
npm install
```

### Initialize Database & Seed Users
```bash
npm run seed
```

This creates the database and 7 default users:
- `yasser` (admin)
- `amr`, `tamer`, `ahmad` (tru_team, with assigned requirements)
- `iexpert_pm`, `iexpert_grc`, `assessor`

All with password: `Tru@PCI2026` (or `DEFAULT_PASSWORD` env var)

### Start Server
```bash
npm start
# or
NODE_ENV=production node server.js
```

Server runs on port 3000 (or `PORT` env var)

### Scan Evidence Folders
```bash
npm run scan
```

Or use admin API: `POST /api/admin/scan`

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_DIR` | `./data` | Database directory |
| `EVIDENCE_DIR` | `./data/evidence` | Evidence folder scan path |
| `UPLOAD_DIR` | `./data/uploads` | File uploads directory |
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `tru-pci-dev-secret-change-me` | JWT signing secret |
| `ADMIN_PASSWORD` | `Admin@2026` | Initial admin password |
| `DEFAULT_PASSWORD` | `Tru@PCI2026` | Seed users password |
| `NODE_ENV` | `development` | Environment mode |

## Security Features

1. **Authentication**: JWT-based with 7-day expiry
2. **Authorization**: Role-based access control (5 roles)
3. **Password Hashing**: bcryptjs with 10 salt rounds
4. **Audit Logging**: All sensitive operations logged
5. **File Upload**: Multer with version control
6. **SQL Injection Prevention**: Prepared statements
7. **CORS**: Configurable cross-origin support

## Role Permissions

| Role | Permissions |
|------|-------------|
| `admin` | Full access, user management, status changes, scans |
| `tru_team` | Upload evidence, set uploaded status, view dashboard |
| `iexpert_pm` | Review evidence, set pm_approved/pm_revision status |
| `iexpert_grc` | GRC review, upload files, set grc_approved/grc_revision status |
| `assessor` | Final assessment, set assessor_approved/assessor_rejected status |

## Workflow States

Evidence points flow through these states:
1. `empty` - No files uploaded (initial)
2. `uploaded` - File uploaded by TRU team
3. `under_review` - Being reviewed by PM or GRC
4. `pm_approved` / `pm_revision` - PM review decision
5. `grc_approved` / `grc_revision` - GRC review decision
6. `admin_approved` - Admin final approval
7. `assessor_approved` / `assessor_rejected` - Assessor final verdict

## File Organization

```
tru-pci-evidence-platform/
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── src/
│   ├── db.js               # Database setup
│   ├── auth.js             # JWT utilities
│   ├── scanner.js          # Folder scanner
│   ├── middleware/
│   │   ├── requireAuth.js  # JWT verification
│   │   └── requireRole.js  # Role checking
│   └── routes/
│       ├── auth.js         # Authentication endpoints
│       ├── dashboard.js    # Statistics
│       ├── evidence.js     # Evidence management
│       ├── comments.js     # Comments
│       └── admin.js        # Admin functions
├── scripts/
│   └── seed-users.js       # Database seeding
├── data/
│   ├── app.db             # SQLite database
│   ├── app.db-shm         # SQLite WAL
│   ├── app.db-wal         # SQLite WAL
│   ├── evidence/          # Evidence folder structure
│   └── uploads/           # File uploads
└── public/                 # Static files (frontend)
```

## Development Notes

- **Async/Await**: Auth functions use async for password hashing
- **Sync Database**: better-sqlite3 is synchronous for simplicity
- **Error Handling**: All routes have try-catch with logging
- **Validation**: Input validation on critical endpoints
- **Indexes**: Database indexes on frequently queried columns
- **Pagination**: Admin endpoints support limit/offset pagination

## Production Checklist

- [ ] Change `JWT_SECRET` to secure random value
- [ ] Change `ADMIN_PASSWORD` and seed password
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATA_DIR`, `EVIDENCE_DIR`, `UPLOAD_DIR` paths
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up backups for database and uploads
- [ ] Monitor disk space for uploads
- [ ] Configure logging aggregation
- [ ] Set up authentication server if needed
- [ ] Review CORS configuration
- [ ] Load test with expected user volume

## Troubleshooting

**Database locked errors**: SQLite WAL mode is enabled. Ensure proper permissions on data directory.

**File upload fails**: Check `UPLOAD_DIR` permissions and disk space.

**JWT verification fails**: Verify `JWT_SECRET` is consistent across restarts.

**Folder scan finds nothing**: Verify `EVIDENCE_DIR` structure matches expected format (Requirement folders).

**Port already in use**: Change `PORT` env var or kill process using port 3000.
