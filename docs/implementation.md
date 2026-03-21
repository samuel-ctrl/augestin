# Self-Study Learning Platform — Implementation Plan

## Project Vision

Help students improve their studies through a structured self-study platform. Tutors organize content (subjects → books → videos), assign it to students, and students consume it at their own pace with progress tracking.

**"Self-Study" is module #1** — the platform is designed with a left sidebar to support future modules.

---

## Gaps Identified & Addressed

### Round 1 — Student Experience Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| No progress tracking | Student can't see what they've completed | `watch_progress` table — track % watched per book |
| No "Resume Learning" | Student must remember where they left off | Show last-watched book on dashboard with resume button |
| No video resume | Student rewatches from start every time | Save `last_position_seconds`, auto-seek on load |
| No password change | Student stuck with random password | First-login forced password change + settings |
| No student standard | Can't tie student to a class/grade | `standard` field on student profile |
| No empty states | Blank page confuses new students | "No content assigned yet" messaging |
| No book ordering | Random book order is confusing | `sort_order` field, tutor controls sequence |

### Round 2 — Data Integrity & UX Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| No cascade deletes | Orphaned assignments/progress when subject/book/student deleted | Define cascade rules on all FK relationships |
| No pagination | API breaks with many records | Add `skip` + `limit` params to all list endpoints |
| Tutor can't reset student password | Student locked out if they forget password | Add `POST /api/students/{id}/reset-password` endpoint |
| No breadcrumbs | Student gets lost navigating Subject → Book | Breadcrumb component on SubjectView and BookView |
| No default thumbnail | Books without thumbnail show broken image | Use a default placeholder image |
| Subject icons undefined | Tutor doesn't know what to enter | Predefined icon set (dropdown picker, ~20 icons) |
| No `updated_at` | Can't track record modifications | Add `updated_at` column to all tables |
| No JWT expiry/refresh | Security risk — token never expires | JWT expires in 24h, frontend redirects to login on 401 |
| Video format/size undefined | Upload may fail or video won't play | Accept mp4/webm/mov only, max 500MB, validate on upload |
| No error response format | Inconsistent error handling | Standard `{ detail: string, code: string }` format |
| No 404 page | Invalid routes show blank screen | Add NotFound catch-all route in both portals |
| Backend startup order | Crashes if postgres isn't ready | `depends_on` with healthcheck + retry logic in database.py |
| No profile page for student | Can't change password after first login | Add `/profile` route in student portal |
| No student progress view for tutor | Tutor can't see if students are actually learning | Add `GET /api/students/{id}/progress` endpoint |

### Round 3 — Tables & Shared Components

| Gap | Impact | Solution |
|-----|--------|----------|
| Client-side tables only | Slow with large data, no real search/sort | **Server-side tables** — backend handles search, pagination, sorting |
| Duplicate components across portals | Code duplication, inconsistent UI, double maintenance | **Shared component library** (`shared-ui` package) used by both portals |

---

## Architecture

```
┌─────────────────┐  ┌─────────────────┐
│  Student Portal  │  │  Tutor Portal    │
│  React + Vite    │  │  React + Vite    │
│  port 3000       │  │  port 3001       │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────┬──────────────┘
                │
       ┌────────┴────────┐
       │   shared-ui     │  ← local npm package
       │  (component lib)│     imported by both portals
       └─────────────────┘
                │
                ▼
          ┌─────────────────┐
          │  Backend API     │
          │  FastAPI (Python)│
          │  port 8080       │
          └────────┬─────────┘
                   ▼
          ┌─────────────────┐
          │  PostgreSQL 15   │
          │  port 5432       │
          └─────────────────┘
```

**Stack:**
- Backend: FastAPI + Python 3.11, SQLAlchemy 2.0 (async), Alembic, python-multipart, python-jose (JWT), passlib + bcrypt
- Frontends: React 18 + Vite + TypeScript, React Router v6, Axios, Tailwind CSS
- Shared UI: Local npm package (`shared-ui/`) — reusable components for both portals
- Infra: Docker Compose (4 services), local bind-mount for uploads

---

## Database Schema

### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default uuid4 | |
| login_id | String(100) | **Unique, Not Null** | Email / phone / auto `STU-XXXXXX` |
| name | String(255) | Not Null | Full name |
| email | String(255) | Nullable, Unique (if set) | Optional |
| phone | String(20) | Nullable, Unique (if set) | Optional |
| password_hash | String | Not Null | bcrypt |
| user_type | Enum(`student`,`tutor`) | Not Null | |
| standard | Enum(`1`..`12`) | Nullable | Students only — their class/grade |
| must_change_password | Boolean | Default `true` | For students; `false` for tutor |
| created_by | UUID FK→users | Nullable, ON DELETE SET NULL | Null for super user |
| created_at | DateTime | Default now | |
| updated_at | DateTime | Default now, on update now | |

### subjects
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | String(255) | Not Null | e.g., "Physics" |
| icon | String(50) | Nullable, Default `"book"` | Key from predefined icon set |
| created_by | UUID FK→users | Not Null, ON DELETE CASCADE | |
| created_at | DateTime | Default now | |
| updated_at | DateTime | Default now, on update now | |

**Cascade:** Deleting a subject → deletes all its books → deletes their assignments + watch_progress

### books
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| title | String(255) | Not Null | |
| description | Text | Nullable | |
| thumbnail_url | String | Nullable | Falls back to default placeholder |
| video_url | String | Not Null | Path in `/uploads/videos/` |
| video_duration_seconds | Float | Nullable | Extracted/set on upload for progress calc |
| standard | Enum(`1`..`12`) | Not Null | |
| sort_order | Integer | Default 0 | Display order within subject |
| subject_id | UUID FK→subjects | Not Null, ON DELETE CASCADE | |
| created_by | UUID FK→users | Not Null, ON DELETE CASCADE | |
| created_at | DateTime | Default now | |
| updated_at | DateTime | Default now, on update now | |

### book_assignments
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| book_id | UUID FK→books | Not Null, ON DELETE CASCADE | |
| student_id | UUID FK→users | Not Null, ON DELETE CASCADE | |
| assigned_by | UUID FK→users | Not Null, ON DELETE CASCADE | |
| assigned_at | DateTime | Default now | |
| | **Unique** | (book_id, student_id) | |

### watch_progress
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| student_id | UUID FK→users | Not Null, ON DELETE CASCADE | |
| book_id | UUID FK→books | Not Null, ON DELETE CASCADE | |
| watch_percentage | Float | Default 0.0 | 0.0 to 100.0 |
| last_position_seconds | Float | Default 0.0 | Video resume point |
| completed | Boolean | Default false | True when percentage >= 90 |
| last_watched_at | DateTime | Not Null | Updated on every progress save |
| | **Unique** | (student_id, book_id) | |

**Index:** `watch_progress(student_id, last_watched_at DESC)` — for "Resume Learning" query

---

## Auth Design

| Role | How they get access | Login ID | Password |
|------|-------------------|----------|----------|
| Tutor | Seeded on startup | `tutor@gmail.com` | `Tutor@123` |
| Student | Created by tutor | email / phone / `STU-XXXXXX` | Random, shown once to tutor |

**JWT:** Expires in 24 hours. Payload: `{ sub: user_id, user_type, exp }`. No refresh token (re-login on expiry).

**First login flow (student):**
```
Login → JWT returned with must_change_password=true
     → Frontend redirects to /change-password
     → Student sets new password
     → must_change_password set to false
     → Redirect to dashboard
```

**Student ID generation logic:**
```
1. If email provided → check users.login_id unique → use email
2. Else if phone provided → check users.login_id unique → use phone
3. Else → generate STU-XXXXXX (6 alphanumeric) → verify unique → use it
```

---

## API Endpoints

### Standard Error Response
All errors return: `{ "detail": "Human readable message" }`
FastAPI handles this natively via `HTTPException`.

### Auth — `/api/auth`
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/login` | None | `{ login_id, password }` → `{ token, user }` |
| GET | `/me` | Auth | Current user profile |
| PUT | `/change-password` | Auth | `{ old_password, new_password }` → sets `must_change_password=false` |

### Server-Side Table Query Contract

All list endpoints that power tables follow this contract:

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Current page (1-based) |
| `page_size` | int | `20` | Rows per page (max 100) |
| `search` | string | `""` | Search term — matches across relevant text columns |
| `sort_by` | string | `"created_at"` | Column to sort by |
| `sort_order` | string | `"desc"` | `asc` or `desc` |
| *(filters)* | varies | — | Endpoint-specific filters (e.g., `standard`, `subject_id`) |

**Response Shape (all list endpoints):**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

Backend uses SQLAlchemy `offset = (page - 1) * page_size`, `limit = page_size`, `order_by(sort_by, sort_order)`, and `count()` for total.

---

### Students — `/api/students` [Tutor only]
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | Tutor | **Server-side table.** Query: `?page=1&page_size=20&search=&sort_by=created_at&sort_order=desc&standard=`. Search matches `name`, `login_id`, `email`, `phone`. Filter by `standard`. |
| POST | `/` | Tutor | Create student → returns `{ login_id, password }` in response |
| GET | `/{id}` | Tutor | Student detail + assignment count |
| PUT | `/{id}` | Tutor | Update name, email, phone, standard |
| DELETE | `/{id}` | Tutor | Delete student (cascades assignments + progress) |
| POST | `/{id}/reset-password` | Tutor | Generate new password → return plain text |
| GET | `/{id}/progress` | Tutor | **Server-side table.** Student's watch progress. Query: `?page=1&page_size=20&sort_by=last_watched_at&sort_order=desc`. Returns books with progress info. |

### Subjects — `/api/subjects`
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | Auth | Tutor: all. Student: only subjects with assigned books. Query: `?page=1&page_size=50&search=&sort_by=name&sort_order=asc`. Search matches `name`. |
| GET | `/{id}` | Auth | Subject detail |
| POST | `/` | Tutor | Create `{ name, icon }` |
| PUT | `/{id}` | Tutor | Update `{ name, icon }` |
| DELETE | `/{id}` | Tutor | Delete subject + cascade |

### Books — `/api/subjects/{subject_id}/books`
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | Auth | **Server-side table.** Tutor: all. Student: assigned only + watch_progress. Query: `?page=1&page_size=50&search=&sort_by=sort_order&sort_order=asc&standard=`. Search matches `title`, `description`. Filter by `standard`. |
| POST | `/` | Tutor | Create (multipart: title, description, standard, sort_order, video file, thumbnail file) |

### Books — `/api/books`
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/{id}` | Auth | Book detail. Student: verifies assignment exists, includes watch_progress |
| PUT | `/{id}` | Tutor | Update (multipart, video/thumbnail optional — keeps old if not sent) |
| DELETE | `/{id}` | Tutor | Delete book + delete files from disk + cascade |

### Assignments — `/api/assignments` [Tutor only]
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | Tutor | `{ book_id, student_ids[] }` — skips duplicates |
| DELETE | `/{id}` | Tutor | Remove single assignment |
| GET | `/book/{book_id}` | Tutor | **Server-side table.** List assigned students. Query: `?page=1&page_size=20&search=&sort_by=assigned_at&sort_order=desc`. Search matches student `name`, `login_id`. |

### Progress — `/api/progress` [Student only]
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| PUT | `/{book_id}` | Student | `{ watch_percentage, last_position_seconds }` — upserts, validates assignment exists |
| GET | `/resume` | Student | Last-watched book (most recent `last_watched_at`) with subject info |

### Static Files
Mount `/uploads` → serves videos and thumbnails via FastAPI `StaticFiles`.

### Upload Constraints
- Video: mp4, webm, mov — max 500MB
- Thumbnail: jpg, jpeg, png, webp — max 5MB
- Files saved as `{uuid}{ext}` to avoid name collisions

---

## Predefined Subject Icons

Tutor picks from a dropdown. Stored as string key, rendered as icon in frontend.

```
book, atom, calculator, flask, microscope, globe,
palette, music, dumbbell, laptop, language, history,
economics, civics, leaf, dna, lightning, compass,
ruler, pen
```

Both portals share an `iconMap` that maps these keys to SVG/emoji/icon components.

---

## Frontend Routes

### Student Portal (port 3000) — Left Sidebar Layout
**Sidebar:** Self-Study (default active), Profile/Settings

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Login with login_id + password |
| `/change-password` | ChangePassword | First-login forced password change |
| `/self-study` | Dashboard | "Resume Learning" + subject grid + empty states |
| `/self-study/subjects/:id` | SubjectView | Breadcrumb + assigned books with progress |
| `/self-study/books/:id` | BookView | Breadcrumb + Tabs: Record (video) + Quiz (Coming Soon) |
| `/profile` | Profile | Change password, view own info |
| `*` | NotFound | 404 page with link back to dashboard |

### Tutor Portal (port 3001) — Left Sidebar Layout
**Sidebar:** Self-Study, Students

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | `tutor@gmail.com` / `Tutor@123` |
| `/self-study` | Dashboard | Subject grid with CRUD |
| `/self-study/subjects/:id` | SubjectBooks | Breadcrumb + books with CRUD |
| `/self-study/books/new` | BookForm | Create book + upload |
| `/self-study/books/:id/edit` | BookForm | Edit book |
| `/self-study/books/:id/assign` | BookAssign | Assign/unassign students |
| `/students` | StudentList | Searchable student table |
| `/students/new` | StudentCreate | Create form → credential card display |
| `/students/:id` | StudentDetail | Info + progress across assigned books |
| `*` | NotFound | 404 page |

---

## UI Layouts

### Shared App Layout (Both Portals)
```
┌──────────────────────────────────────────────────┐
│  Logo          Breadcrumb              User ▾    │
├──────────┬───────────────────────────────────────┤
│          │                                       │
│ Sidebar  │          Main Content                 │
│          │                                       │
│ ┌──────┐ │                                       │
│ │ Self │ │                                       │
│ │Study │ │                                       │
│ └──────┘ │                                       │
│ ┌──────┐ │                                       │
│ │ Stu- │ │    (tutor only)                       │
│ │dents │ │                                       │
│ └──────┘ │                                       │
│ ┌──────┐ │                                       │
│ │ Pro- │ │    (student only)                     │
│ │file  │ │                                       │
│ └──────┘ │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
```

### Student Dashboard
```
┌─────────────────────────────────────────────┐
│  Resume Learning                            │
│  ┌────────────────────────────────────────┐  │
│  │ ▶ Electro Magnetic Induction · Phys   │  │
│  │   45% watched · Continue →            │  │
│  └────────────────────────────────────────┘  │
│                                             │
│  Select a subject to start learning         │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │  ⚡    │ │  🔬    │ │  📐    │          │
│  │Physics │ │ Chem   │ │ Math   │          │
│  │ 3 books│ │ 2 books│ │ 5 books│          │
│  └────────┘ └────────┘ └────────┘          │
│                                             │
│  ── OR if no assignments ──                 │
│                                             │
│  ┌────────────────────────────────────────┐  │
│  │  📭 No subjects assigned yet.          │  │
│  │  Please contact your tutor.           │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Student Subject View
```
┌─────────────────────────────────────────────┐
│  Self-Study > Physics                       │  ← breadcrumb
│                                             │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ [thumbnail]  │  │ [thumbnail]  │         │
│  │ EMI Ch.1     │  │ EMI Ch.2     │         │
│  │ Std: 10      │  │ Std: 10      │         │
│  │ ████░░ 60%   │  │ ░░░░░░ 0%    │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### Student Book View
```
┌─────────────────────────────────────────────┐
│  Self-Study > Physics > EMI Ch.1            │  ← breadcrumb
│                                             │
│  ┌─────────┐ ┌─────────┐                   │
│  │ Record  │ │  Quiz   │   ← tabs          │
│  └─────────┘ └─────────┘                   │
│                                             │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │          HTML5 Video Player            │  │
│  │          (auto-resumes)                │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│  ████████████░░░░░░░░ 60%                   │
│                                             │
│  EMI Chapter 1 — Faraday's Law of EMI       │
│  Standard: 10th                             │
└─────────────────────────────────────────────┘
```

---

## Folder Structure

```
augestin/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── docs/
│   └── implementation.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py                     # FastAPI app, CORS, mount static, include routers, startup seed
│       ├── config.py                   # Settings from env (DATABASE_URL, JWT_SECRET, UPLOAD_DIR, etc.)
│       ├── database.py                 # SQLAlchemy engine, SessionLocal, Base
│       ├── dependencies.py             # get_db, get_current_user, require_tutor, require_student
│       ├── seed.py                     # Create super user if not exists
│       │
│       ├── models/
│       │   ├── __init__.py             # Import all models (for Alembic)
│       │   ├── user.py
│       │   ├── subject.py
│       │   ├── book.py
│       │   ├── book_assignment.py
│       │   └── watch_progress.py
│       │
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py                 # LoginRequest, LoginResponse, ChangePasswordRequest
│       │   ├── user.py                 # UserOut, StudentCreate, StudentCreateResponse (with plain password)
│       │   ├── subject.py              # SubjectCreate, SubjectUpdate, SubjectOut
│       │   ├── book.py                 # BookOut (with progress for students)
│       │   ├── assignment.py           # AssignRequest, AssignmentOut
│       │   └── progress.py             # ProgressUpdate, ResumeBookOut
│       │
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── subjects.py
│       │   ├── books.py
│       │   ├── assignments.py
│       │   ├── students.py
│       │   └── progress.py
│       │
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── subject.py
│       │   ├── book.py
│       │   ├── assignment.py
│       │   ├── student.py              # ID generation, password gen, reset password
│       │   └── progress.py
│       │
│       └── utils/
│           ├── __init__.py
│           ├── jwt.py                  # create_token, decode_token (24h expiry)
│           ├── password.py             # hash_password, verify_password
│           └── id_generator.py         # generate_student_id, generate_password
│
├── shared-ui/                              # Shared component library (local npm package)
│   ├── package.json                        # name: "@augestin/shared-ui", main: dist/index.js
│   ├── tsconfig.json
│   ├── vite.config.ts                      # Library mode build
│   ├── tailwind.config.js
│   └── src/
│       ├── index.ts                        # Barrel export — all components, hooks, types, constants
│       ├── components/
│       │   ├── DataTable/
│       │   │   ├── DataTable.tsx           # Server-side table: pagination, search, sort, filters
│       │   │   ├── TablePagination.tsx     # Page controls: prev/next, page size selector, "1-20 of 150"
│       │   │   ├── TableSearch.tsx         # Debounced search input (300ms)
│       │   │   ├── TableSortHeader.tsx     # Clickable column header with sort arrow indicators
│       │   │   └── TableFilters.tsx        # Dropdown filter slots (e.g., standard filter)
│       │   ├── AppLayout.tsx               # Left sidebar + top bar + main content + breadcrumb slot
│       │   ├── Sidebar.tsx                 # Configurable nav items, highlight active, collapsible on mobile
│       │   ├── Breadcrumb.tsx              # Path-based breadcrumb navigation
│       │   ├── SubjectCard.tsx             # Icon + name + book count
│       │   ├── BookCard.tsx                # Thumbnail + title + standard badge + progress bar
│       │   ├── VideoPlayer.tsx             # HTML5 video, auto-resume, progress callback every 10s
│       │   ├── ProgressBar.tsx             # Reusable % bar with color (grey→blue→green)
│       │   ├── EmptyState.tsx              # Icon + message + optional action button
│       │   ├── LoadingSpinner.tsx          # Full-page and inline variants
│       │   ├── ErrorToast.tsx              # Auto-dismiss toast notification
│       │   ├── ConfirmDialog.tsx           # Modal confirm for destructive actions
│       │   ├── IconPicker.tsx              # Dropdown with predefined subject icon set
│       │   ├── FileUpload.tsx              # Drag-drop + progress indicator
│       │   ├── CredentialCard.tsx          # Shows login_id + password with copy buttons
│       │   └── ProtectedRoute.tsx          # Auth guard with redirect, configurable checks
│       ├── hooks/
│       │   ├── useServerTable.ts           # Manages table state: page, pageSize, search, sortBy, sortOrder, filters → builds query params → calls fetchFn → returns { data, loading, pagination, handlers }
│       │   ├── useDebounce.ts              # Debounce hook (used by search)
│       │   └── useApi.ts                   # Generic API wrapper with loading/error states
│       ├── constants/
│       │   └── icons.ts                    # iconMap: key → SVG/emoji for subjects
│       └── types/
│           └── index.ts                    # Shared types: User, Subject, Book, Progress, PaginatedResponse, TableState, etc.
│
├── student-portal/
│   ├── Dockerfile
│   ├── nginx.conf                          # SPA fallback (try_files → index.html)
│   ├── shared-ui/                          # ← GITIGNORED local copy (synced from root shared-ui/)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                         # Router setup
│       ├── api/
│       │   └── client.ts                   # Axios instance, JWT interceptor, 401 redirect
│       ├── context/
│       │   └── AuthContext.tsx              # token, user, login(), logout()
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── ChangePassword.tsx
│       │   ├── Profile.tsx
│       │   ├── NotFound.tsx
│       │   └── SelfStudy/
│       │       ├── Dashboard.tsx           # Resume Learning + subject grid + empty state
│       │       ├── SubjectView.tsx         # Book grid with progress (uses shared BookCard)
│       │       └── BookView.tsx            # Record/Quiz tabs (uses shared VideoPlayer)
│       └── config/
│           └── sidebar.ts                  # Sidebar nav items for student (Self-Study, Profile)
│
├── tutor-portal/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── shared-ui/                          # ← GITIGNORED local copy (synced from root shared-ui/)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── NotFound.tsx
│       │   ├── SelfStudy/
│       │   │   ├── Dashboard.tsx           # Subject grid + create modal (uses shared SubjectCard)
│       │   │   ├── SubjectBooks.tsx         # Book cards + CRUD (uses shared BookCard, DataTable)
│       │   │   ├── BookForm.tsx            # Create/edit + upload (uses shared FileUpload)
│       │   │   └── BookAssign.tsx          # Student checklist with DataTable
│       │   └── Students/
│       │       ├── StudentList.tsx          # Uses shared DataTable with search/sort/pagination
│       │       ├── StudentCreate.tsx        # Form → uses shared CredentialCard
│       │       └── StudentDetail.tsx        # Info + progress DataTable
│       ├── components/
│       │   └── SubjectForm.tsx              # Modal: name + shared IconPicker (tutor-specific)
│       └── config/
│           └── sidebar.ts                   # Sidebar nav items for tutor (Self-Study, Students)
│
└── uploads/                            # Docker bind-mount volume
    ├── videos/
    └── thumbnails/
```

---

## Shared UI Library (`shared-ui/`)

### Why a shared library?
Both portals use the same components (AppLayout, Sidebar, DataTable, BookCard, etc.). Without sharing:
- Every bug fix or style change must be done twice
- UI drift between portals over time
- Wasted development effort

### How it works — Copy-Based Approach

**Source of truth:** `shared-ui/` at project root — **tracked in git**.

**Local dev flow:**
```
augestin/
├── shared-ui/                  ← SOURCE OF TRUTH (git tracked)
├── student-portal/
│   └── shared-ui/              ← LOCAL COPY (gitignored)
└── tutor-portal/
    └── shared-ui/              ← LOCAL COPY (gitignored)
```

1. Developer edits `shared-ui/` at root (the mother copy)
2. Runs `npm run sync-shared` (or manually copies) to push changes into each portal
3. Each portal imports from its local `./shared-ui` (relative import, no npm link magic)
4. `student-portal/shared-ui/` and `tutor-portal/shared-ui/` are in `.gitignore` — never committed

**Script (`sync-shared.sh` at project root):**
```bash
#!/bin/bash
# Sync shared-ui into both portals
rsync -av --delete shared-ui/ student-portal/shared-ui/
rsync -av --delete shared-ui/ tutor-portal/shared-ui/
echo "shared-ui synced to both portals"
```

**Docker build flow:**
```dockerfile
# In student-portal/Dockerfile (and tutor-portal/Dockerfile)
FROM node:18-alpine AS build
WORKDIR /app
# Copy shared-ui from build context (passed via docker-compose)
COPY shared-ui/ ./shared-ui/
# Copy portal source
COPY student-portal/package.json student-portal/package-lock.json ./
RUN npm install
COPY student-portal/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

Docker compose uses root as build context:
```yaml
student-portal:
  build:
    context: .                    # root — so Dockerfile can COPY shared-ui/
    dockerfile: student-portal/Dockerfile
```

**Git tracking:**
```gitignore
# .gitignore
student-portal/shared-ui/
tutor-portal/shared-ui/
```

### Import pattern in portals
Portals import from the local copy using relative paths or a path alias:
```typescript
// vite.config.ts in each portal
resolve: {
  alias: {
    "@shared": path.resolve(__dirname, "shared-ui/src"),
  }
}

// Usage in portal code
import { DataTable, useServerTable, AppLayout } from "@shared";
```

No npm package publishing, no npm link, no workspace — just a simple file copy.

### DataTable Component (Server-Side)

The `DataTable` is the core reusable table component. All table rendering, search, pagination, and sorting is driven by the backend.

**Props:**
```typescript
interface DataTableProps<T> {
  // Data
  fetchFn: (params: TableQueryParams) => Promise<PaginatedResponse<T>>;
  columns: ColumnDef<T>[];

  // Optional
  searchPlaceholder?: string;        // e.g., "Search students..."
  filters?: FilterDef[];             // e.g., [{ key: "standard", label: "Standard", options: [...] }]
  defaultSortBy?: string;            // default column to sort
  defaultSortOrder?: "asc" | "desc";
  defaultPageSize?: number;          // default 20
  onRowClick?: (row: T) => void;     // navigate on click
  actions?: (row: T) => ReactNode;   // render action buttons per row
}
```

**Column Definition:**
```typescript
interface ColumnDef<T> {
  key: string;                       // maps to data field
  label: string;                     // column header text
  sortable?: boolean;                // enables sort on this column (default true)
  render?: (value: any, row: T) => ReactNode;  // custom cell renderer
  width?: string;                    // optional column width
}
```

**Filter Definition:**
```typescript
interface FilterDef {
  key: string;                       // query param name
  label: string;                     // dropdown label
  options: { value: string; label: string }[];
}
```

**Shared Types:**
```typescript
interface TableQueryParams {
  page: number;
  page_size: number;
  search: string;
  sort_by: string;
  sort_order: "asc" | "desc";
  [filterKey: string]: any;          // dynamic filters
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
```

**`useServerTable` hook** — manages all state internally:
```typescript
const { data, loading, error, pagination, handlers } = useServerTable({
  fetchFn: (params) => api.get("/api/students", { params }),
  defaultSortBy: "created_at",
  defaultPageSize: 20,
});
// handlers: setSearch, setPage, setPageSize, setSortBy, toggleSort, setFilter, refresh
```

**Usage in tutor portal (StudentList.tsx):**
```tsx
import { DataTable } from "@augestin/shared-ui";

const columns = [
  { key: "name", label: "Name" },
  { key: "login_id", label: "Login ID" },
  { key: "standard", label: "Standard", render: (v) => v ? `${v}th` : "—" },
  { key: "created_at", label: "Created", render: (v) => formatDate(v) },
];

const filters = [
  { key: "standard", label: "Standard", options: standardOptions },
];

<DataTable
  fetchFn={(params) => api.get("/api/students", { params })}
  columns={columns}
  filters={filters}
  searchPlaceholder="Search by name, login ID..."
  defaultSortBy="created_at"
  onRowClick={(student) => navigate(`/students/${student.id}`)}
  actions={(student) => (
    <>
      <EditButton onClick={() => ...} />
      <DeleteButton onClick={() => ...} />
    </>
  )}
/>
```

### DataTable UI Layout
```
┌─────────────────────────────────────────────────────────┐
│  🔍 [Search by name, login ID...    ]  [Standard ▾]    │
├─────────────────────────────────────────────────────────┤
│  Name ▲    │ Login ID    │ Standard  │ Created   │ Act  │
├────────────┼─────────────┼───────────┼───────────┼──────┤
│  Rahul K.  │ rahul@g..   │ 10th      │ 21 Mar    │ ⋮    │
│  Priya S.  │ STU-A7X3K9  │ 8th       │ 20 Mar    │ ⋮    │
│  ...       │             │           │           │      │
├─────────────────────────────────────────────────────────┤
│  Showing 1-20 of 150        [◀ Prev] Page 1 [Next ▶]  │
│                              Rows per page: [20 ▾]      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 — Project Setup & Database
**Goal:** Docker with postgres running, FastAPI connected, tables created, tutor seeded.

- [ ] Create `docker-compose.yml` — services: `postgres` (image: postgres:15-alpine, port 5432, volume for data, healthcheck) + `backend` (build ./backend, port 8080, depends_on postgres healthy, mounts ./uploads)
- [ ] Create `.env` — `POSTGRES_USER=augestin`, `POSTGRES_PASSWORD=augestin123`, `POSTGRES_DB=augestin_db`, `JWT_SECRET=<random>`, `UPLOAD_DIR=/app/uploads`
- [ ] Create `.env.example` — same keys, placeholder values
- [ ] Create `.gitignore` — `node_modules/`, `__pycache__/`, `.env`, `uploads/videos/*`, `uploads/thumbnails/*`, `dist/`, `*.pyc`, `.venv/`
- [ ] Create `backend/requirements.txt` — fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic, python-jose[cryptography], passlib[bcrypt], python-multipart, pydantic-settings
- [ ] Create `backend/app/config.py` — Pydantic `Settings` class reading from env
- [ ] Create `backend/app/database.py` — async engine, async sessionmaker, Base
- [ ] Create all 5 SQLAlchemy models with relationships and cascade rules
- [ ] Create `backend/app/main.py` — FastAPI app, CORS, mount `/uploads` as StaticFiles, lifespan event to run seed
- [ ] Init Alembic, configure `env.py` for async, generate first migration
- [ ] Create `backend/app/seed.py` — insert tutor if not exists (`tutor@gmail.com` / `Tutor@123`)
- [ ] Create `backend/Dockerfile`
- [ ] **Verify:** `docker-compose up --build` → postgres healthy → backend starts → `GET http://localhost:8080/` returns `{"status": "ok"}` → tutor exists in DB

### Phase 2 — Backend Auth & Student Management
**Goal:** Tutor can login and create/manage students via API.

- [ ] `backend/app/utils/password.py` — `hash_password()`, `verify_password()` using passlib bcrypt
- [ ] `backend/app/utils/jwt.py` — `create_token(user_id, user_type)` with 24h expiry, `decode_token(token)`
- [ ] `backend/app/utils/id_generator.py` — `generate_student_id()` → `STU-XXXXXX`, `generate_password()` → `Stu@XXXX`
- [ ] `backend/app/dependencies.py` — `get_db()`, `get_current_user()` (decode JWT from Bearer header), `require_tutor()`, `require_student()`
- [ ] Auth schemas: `LoginRequest`, `LoginResponse`, `ChangePasswordRequest`
- [ ] Auth router: `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/change-password`
- [ ] Student schemas: `StudentCreate` (name, email?, phone?, standard?), `StudentCreateResponse` (includes plain password), `StudentOut`
- [ ] Student service: create (ID generation + uniqueness check + password gen), list (search + filter + pagination), update, delete, reset password
- [ ] Student router: full CRUD + `POST /{id}/reset-password` + `GET /{id}/progress`
- [ ] **Verify:** curl — login as tutor → create student → login as student → change password → login again with new password

### Phase 3 — Backend Content & Progress APIs
**Goal:** Full content management and progress tracking via API.

- [ ] Subject schemas + service + router (CRUD with user_type filtering)
- [ ] Book schemas + service + router (CRUD with multipart upload, student-filtered queries)
- [ ] File upload handling: validate format/size, save with UUID filename, cleanup on delete
- [ ] Assignment schemas + service + router (assign, unassign, list by book)
- [ ] Progress schemas + service + router (upsert progress, get resume book)
- [ ] Progress validation: only allow progress update if assignment exists
- [ ] **Verify:** Full API flow — create subject → create book (upload video) → assign to student → login as student → get subjects (filtered) → get books (filtered) → update progress → get resume book

### Phase 4 — Shared UI Component Library
**Goal:** Build the `shared-ui/` source at project root. Both portals will import via `@shared` alias from their local gitignored copy.

- [ ] Init `shared-ui/` at project root — TypeScript, Tailwind config, barrel export `src/index.ts`
- [ ] Create `sync-shared.sh` script at project root to copy into both portals
- [ ] Add `student-portal/shared-ui/` and `tutor-portal/shared-ui/` to `.gitignore`
- [ ] Shared types: `User`, `Subject`, `Book`, `Progress`, `PaginatedResponse<T>`, `TableQueryParams`, `ColumnDef`, `FilterDef`
- [ ] Shared constants: `iconMap` (subject icons), `standardOptions` (1-12)
- [ ] `useDebounce` hook — generic debounce for search input (300ms)
- [ ] `useServerTable` hook — manages page, pageSize, search, sortBy, sortOrder, filters state → calls fetchFn → returns data, loading, pagination, handlers
- [ ] `useApi` hook — generic fetch wrapper with loading/error states
- [ ] `DataTable` component — renders table with `TableSearch`, `TableFilters`, `TableSortHeader`, `TablePagination`
- [ ] `AppLayout` — sidebar + top bar + main content area + breadcrumb slot
- [ ] `Sidebar` — configurable nav items array, highlight active route, collapsible on mobile
- [ ] `Breadcrumb` — accepts path segments array
- [ ] `ProtectedRoute` — auth guard, configurable redirect paths and checks (e.g., must_change_password)
- [ ] UI primitives: `LoadingSpinner`, `ErrorToast`, `EmptyState`, `ConfirmDialog`, `ProgressBar`
- [ ] Content components: `SubjectCard`, `BookCard`, `VideoPlayer`, `IconPicker`, `FileUpload`, `CredentialCard`
- [ ] Barrel export from `src/index.ts`
- [ ] Run `sync-shared.sh` to copy into both portal directories
- [ ] **Verify:** Both portals can resolve `@shared` imports. Components render correctly

### Phase 5 — Tutor Portal Frontend
**Goal:** Tutor can manage everything through browser UI using shared components.

- [ ] Scaffold Vite + React + TypeScript project
- [ ] Run `sync-shared.sh` to copy shared-ui, configure `@shared` path alias in `vite.config.ts`
- [ ] Configure Tailwind (extend shared config), Vite proxy `/api` → `http://localhost:8080`
- [ ] Create API client (Axios) with JWT interceptor + 401 handling
- [ ] Create AuthContext (login, logout, token persistence in localStorage)
- [ ] Configure sidebar items (`config/sidebar.ts`): Self-Study, Students
- [ ] Wire up `AppLayout` + `Sidebar` + `ProtectedRoute` from shared-ui
- [ ] **Login page:** email + password form, no register link, redirect to `/self-study`
- [ ] **Students — List:** `DataTable` with server-side search/sort/pagination. Columns: name, login_id, standard, created_at. Filter by standard. Row click → detail. Actions: edit, delete (with `ConfirmDialog`)
- [ ] **Students — Create:** form (name, email, phone, standard) → on submit, show `CredentialCard` with login_id + password + copy buttons
- [ ] **Students — Detail:** student info card + `DataTable` showing assigned books with watch progress
- [ ] **Self-Study — Dashboard:** subject grid using `SubjectCard`. "Create Subject" → `SubjectForm` modal (name + `IconPicker`). Edit/delete with `ConfirmDialog`
- [ ] **Self-Study — SubjectBooks:** breadcrumb. Book cards grid using `BookCard`. Add/edit/delete. "Assign" button per book
- [ ] **Self-Study — BookForm:** title, description, standard dropdown, sort_order, video (`FileUpload`), thumbnail (`FileUpload`). Handles create and edit
- [ ] **Self-Study — BookAssign:** book title at top, `DataTable` of students with checkbox column. Shows standard match indicator. Save button
- [ ] **NotFound page**
- [ ] **Verify:** Full tutor flow in browser — login → create student → create subject → create book → upload video → assign book → view student progress

### Phase 6 — Student Portal Frontend
**Goal:** Student can login, browse assigned content, watch videos with progress tracking.

- [ ] Scaffold Vite + React + TypeScript project (same base setup as tutor portal)
- [ ] Run `sync-shared.sh` to copy shared-ui, configure `@shared` path alias in `vite.config.ts`
- [ ] Tailwind, API client, AuthContext (same patterns)
- [ ] Configure sidebar items (`config/sidebar.ts`): Self-Study, Profile
- [ ] Wire up `AppLayout` + `Sidebar` + `ProtectedRoute` (with `must_change_password` check)
- [ ] **Login page:** login_id + password form, no register link
- [ ] **Change Password page:** old password + new password + confirm. On success, redirect to `/self-study`
- [ ] **Profile page:** show name, login_id, standard. Change password form
- [ ] **Dashboard:**
  - "Resume Learning" card: fetches `GET /api/progress/resume` → shows book title, subject name, progress %, "Continue" button. Hidden if no watch history
  - Subject grid: `SubjectCard` components with icon, name, assigned book count
  - `EmptyState` if no subjects assigned
- [ ] **SubjectView:**
  - `Breadcrumb`: Self-Study > Physics
  - Book grid: `BookCard` with thumbnail, title, standard badge, `ProgressBar`
  - Completed books: green checkmark overlay
  - `EmptyState` if no books
- [ ] **BookView:**
  - `Breadcrumb`: Self-Study > Physics > EMI Chapter 1
  - Tab bar: "Record" (active) | "Quiz" (with lock icon)
  - Record tab: `VideoPlayer` from shared-ui
    - Auto-resumes from `last_position_seconds`
    - Saves progress via `PUT /api/progress/{book_id}` every 10s (debounced)
    - `ProgressBar` below video
    - Book title + description + standard
  - Quiz tab: "Coming Soon" with lock icon
- [ ] **NotFound page**
- [ ] **Verify:** Full student flow — login → change password → dashboard → subject → book → video resumes → progress saves

### Phase 7 — Docker & Polish
**Goal:** Everything runs via single `docker-compose up`, polished UX.

- [ ] `backend/Dockerfile` — Python 3.11-slim, install requirements, copy app, run alembic upgrade head + uvicorn
- [ ] `student-portal/Dockerfile` — multi-stage: `COPY shared-ui/` from root context, then build portal, serve with nginx
- [ ] `student-portal/nginx.conf` — SPA routing (try_files $uri /index.html), proxy /api to backend
- [ ] `tutor-portal/Dockerfile` — same pattern (COPY shared-ui from root context → build portal → nginx)
- [ ] `tutor-portal/nginx.conf` — same pattern
- [ ] Update `docker-compose.yml` — add student-portal (port 3000) and tutor-portal (port 3001). Use root as build context (`context: .`) so Dockerfiles can `COPY shared-ui/`
- [ ] Verify `depends_on` with healthcheck for postgres
- [ ] Review all loading states (LoadingSpinner on data fetch)
- [ ] Review all error states (ErrorToast on API failure)
- [ ] Review all empty states (EmptyState component)
- [ ] Review all delete flows (ConfirmDialog before delete)
- [ ] Mobile responsive: sidebar collapses to hamburger menu on small screens
- [ ] **Final verification:** `docker-compose up --build` → complete flow from scratch:
  1. Login tutor → create 2 students → note credentials
  2. Create 2 subjects → create 3 books with videos → assign books to students
  3. Login student 1 → see assigned subjects → watch video → progress saves
  4. Login student 2 → see different assigned content
  5. Back to tutor → view student progress
  6. Delete a book → verify cascade (assignments + progress cleaned)
  7. Reset student password → student logs in with new password

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `augestin` | DB user |
| `POSTGRES_PASSWORD` | `augestin123` | DB password |
| `POSTGRES_DB` | `augestin_db` | DB name |
| `DATABASE_URL` | `postgresql+asyncpg://augestin:augestin123@postgres:5432/augestin_db` | Full connection string |
| `JWT_SECRET` | (generate random) | JWT signing key |
| `JWT_EXPIRY_HOURS` | `24` | Token lifetime |
| `UPLOAD_DIR` | `/app/uploads` | File upload directory |
| `MAX_VIDEO_SIZE_MB` | `500` | Video upload limit |
| `MAX_THUMBNAIL_SIZE_MB` | `5` | Thumbnail upload limit |
| `VITE_API_URL` | `http://localhost:8080` | Backend URL for frontends (build-time) |
