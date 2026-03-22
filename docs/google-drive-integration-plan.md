# Plan: Replace File Uploads with Google Drive Links

## Context
The app currently uploads video/thumbnail files to Render's filesystem, which is ephemeral (wiped on every redeploy) and limited to 512MB. The user already has 60+ GB on Google Drive with videos ready. This change replaces file upload with Google Drive link input, using iframe embeds for video playback.

**Trade-offs accepted**:
- Watch progress tracking (percentage, resume position) is lost because Google Drive iframes don't expose video events.
- The "Resume Learning" feature on the student dashboard will no longer update for new books (since `last_watched_at` is never written). See Step 10 for handling.
- Progress bars on `BookCard` and `BookView` will be permanently 0% for new books. See Step 10 for removal.

## Known Constraints & Risks
- **Iframe embed reliability**: Google Drive embeds can be blocked by `X-Frame-Options` if the file isn't shared correctly. The file must be shared as "Anyone with the link" **and** the user must use a `/file/d/{ID}/view` style link. The `VideoPlayer` should show a user-facing error message when the iframe fails to load (e.g., via `onError` or a timeout fallback).
- **Thumbnail limitations**: `https://drive.google.com/uc?id={ID}&export=view` only works for image files, not as a video thumbnail extractor. Tutors must provide a **separate image URL** for thumbnails (either a Google Drive image link or any direct image URL). The thumbnail field should be clearly labeled to reflect this.
- **Security — URL validation**: Since URLs are rendered in `<iframe>` tags, the backend must whitelist allowed domains (Google Drive, or any HTTPS URL) and reject `javascript:`, `data:`, and private/internal URLs to prevent XSS and SSRF vectors.
- **No error detection in iframes**: If a Google Drive video fails to load, the iframe shows Google's own error page. The parent app cannot detect this due to cross-origin restrictions. Mitigate with clear sharing instructions in the UI.

## Files to Modify

### Backend
| File | Change |
|------|--------|
| `backend/app/routers/books.py` | Replace `Form()`/`File()` params with Pydantic JSON body for create and update. Pass `created_by` to service. |
| `backend/app/schemas/book.py` | Add `BookCreateRequest` and `BookUpdateRequest` Pydantic models. Remove `watch_percentage`, `last_position_seconds`, `completed` from `BookOut`. |
| `backend/app/services/book.py` | Remove `validate_video_file`, `validate_thumbnail_file`, `save_upload`, `delete_file`. Add `validate_url()`. Remove `delete_file()` calls from `update_book()` and `delete_book()`. Add `created_by` param to `create_book()`. |
| `backend/app/main.py` | Remove static file mount for `/uploads` and `StaticFiles` import |
| `backend/app/config.py` | Remove `UPLOAD_DIR`, `MAX_VIDEO_SIZE_MB`, `MAX_THUMBNAIL_SIZE_MB` |

### Frontend (shared-ui)
| File | Change |
|------|--------|
| `shared-ui/src/components/VideoPlayer.tsx` | Replace `<video>` with Google Drive `<iframe>`. Keep `startPosition` and `onProgress` props only for the non-Drive `<video>` fallback path. |
| `shared-ui/src/utils/googleDrive.ts` | **New** — `extractFileId()`, `toEmbedUrl()`, `isGoogleDriveUrl()` |
| `shared-ui/src/index.ts` | Export new `googleDrive` utility |

### Frontend (tutor-portal)
| File | Change |
|------|--------|
| `tutor-portal/src/pages/SelfStudy/BookForm.tsx` | Replace `FileUpload` with text inputs for video/thumbnail URLs. Switch from `FormData` to JSON submission. Remove `Content-Type: multipart/form-data` from both POST and PUT. |

### Frontend (student-portal)
| File | Change |
|------|--------|
| `student-portal/src/pages/SelfStudy/BookView.tsx` | Remove `handleProgress` callback, `watchPercentage` state, `ProgressBar` import and rendering. Simplify `<VideoPlayer>` to just `src` prop (no `startPosition` or `onProgress`). |
| `student-portal/src/pages/SelfStudy/SubjectView.tsx` | Stop passing `watchPercentage` and `completed` to `BookCard` |
| `student-portal/src/pages/SelfStudy/Dashboard.tsx` | Remove or redesign "Resume Learning" section (see Step 10) |

## Implementation Steps

### Step 1: Google Drive URL utility (`shared-ui`)
Create `shared-ui/src/utils/googleDrive.ts`:
- `extractFileId(url)` — parse Google Drive URL formats: `/file/d/{ID}/view`, `?id={ID}`, `/uc?id={ID}`
- `toEmbedUrl(url)` — return `https://drive.google.com/file/d/{ID}/preview`
- `isGoogleDriveUrl(url)` — boolean check

Note: `toThumbnailUrl()` is **not included** — Google Drive does not reliably serve video thumbnails via URL. Tutors must provide a separate image URL for thumbnails.

### Step 2: Rewrite `VideoPlayer` (`shared-ui`)
- If `isGoogleDriveUrl(src)` → render `<iframe src={toEmbedUrl(src)}>` with `allow="autoplay; encrypted-media"` and `allowFullScreen`
- Else → keep existing `<video>` tag as fallback for direct URLs, **preserving** `startPosition`, `onProgress`, `progressInterval` props for the `<video>` path only
- For the iframe path, ignore `startPosition`/`onProgress` (they have no effect)
- This keeps the component backward-compatible — non-Drive URLs still get full progress tracking

### Step 3: Backend schemas (`backend/app/schemas/book.py`)
Add request models:
```python
class BookCreateRequest(BaseModel):
    title: str
    standard: str
    video_url: str
    description: str | None = None
    sort_order: int = 0
    thumbnail_url: str | None = None

class BookUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    standard: str | None = None
    sort_order: int | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
```

Remove from `BookOut`:
- `watch_percentage`
- `last_position_seconds`
- `completed`

Remove `video_duration_seconds` from `BookOut`, `BookCreateRequest`, `BookUpdateRequest`, and the `Book` model — it is unused in the UI and cannot be auto-detected from iframes.

**Migration note**: Removing `video_duration_seconds` requires an Alembic migration to drop the column from the `books` table.

### Step 4: Backend services (`backend/app/services/book.py`)
- Remove `validate_video_file`, `validate_thumbnail_file`, `save_upload`, `delete_file` and related constants (`ALLOWED_VIDEO_EXTENSIONS`, `ALLOWED_THUMBNAIL_EXTENSIONS`)
- Add `validate_url(url: str) -> str`:
  - Must be a valid HTTPS URL
  - Reject `javascript:`, `data:`, `file:` schemes
  - Reject private/internal IP ranges (127.x, 10.x, 192.168.x, etc.) to prevent SSRF
  - Return the URL unchanged
- Remove `delete_file()` calls from `update_book()` — no longer deleting local files
- Remove `delete_file()` calls from `delete_book()` — same reason
- Add `created_by` parameter to `create_book()` and set it on the model (fixes existing bug where `created_by` is always null)
- Remove `video_duration_seconds` parameter from `create_book()` and `update_book()`

### Step 5: Backend routes (`backend/app/routers/books.py`)
- Create endpoint: accept `BookCreateRequest` JSON body instead of `Form`/`File`
  - Pass `request.state.user.id` as `created_by` to `create_book()`
- Update endpoint: accept `BookUpdateRequest` JSON body
- Remove `UploadFile`, `File`, `Form` imports and all file handling logic
- Pass URL strings directly to service functions
- Remove `video_duration_seconds` from `_book_to_out()` helper
- Remove `WatchProgress` query and population from `_book_to_out()` — progress fields no longer in `BookOut`

### Step 6: Backend cleanup
- `main.py`: Remove `StaticFiles` mount and `StaticFiles` import
- `config.py`: Remove `UPLOAD_DIR`, `MAX_VIDEO_SIZE_MB`, `MAX_THUMBNAIL_SIZE_MB`
- Create Alembic migration to drop `video_duration_seconds` column from `books` table

### Step 7: Tutor portal `BookForm.tsx`
- Replace `FileUpload` components with text `<input>` fields for video and thumbnail URLs
- Replace `videoFile`/`thumbnailFile` state with `videoUrl`/`thumbnailUrl` string state
- On edit load, populate URL fields from existing book data (the raw stored URL, e.g., `https://drive.google.com/file/d/.../view`)
- Switch `handleSubmit` from `FormData` to JSON body for **both** POST and PUT:
  - POST: `api.post(`/subjects/${subjectId}/books`, payload)`
  - PUT: `api.put(`/books/${id}`, payload)`
- Remove `Content-Type: multipart/form-data` header from **both** POST and PUT calls
- Remove `FileUpload` import
- Add helper text below video URL input: "Paste a Google Drive sharing link. The file must be shared as 'Anyone with the link can view'."
- Add helper text below thumbnail URL input: "Optional. Paste a direct image URL (Google Drive image link or any public image URL)."

### Step 8: Student portal `BookView.tsx`
- Remove `handleProgress` callback function entirely
- Remove `watchPercentage` state and `setWatchPercentage` call
- Remove `ProgressBar` import and the progress bar `<div>` below the video player
- Simplify `<VideoPlayer>` to just `<VideoPlayer src={assetUrl(book.video_url)} />`
  - Do NOT pass `startPosition` or `onProgress` — these have no effect for Drive iframes, and progress data is no longer in the API response

### Step 9: Student portal `SubjectView.tsx` + `Dashboard.tsx`
**SubjectView.tsx**:
- Remove `watchPercentage` and `completed` props from `<BookCard>` — these fields are no longer in the API response
- The card will still show title, standard, thumbnail (with fallback), and question count

**Dashboard.tsx — "Resume Learning"**:
- Replace the `GET /progress/resume` based "Resume Learning" section with a simpler "Last Viewed" approach:
  - Option A: Remove "Resume Learning" entirely — students navigate via subjects
  - Option B: Replace with "Recently Assigned" — show the most recently assigned book (query from assignments endpoint, ordered by `assigned_at DESC`)
- Remove `ResumeBook` type import if Option A is chosen

### Step 10: Sync shared-ui + deploy
```bash
rm -rf tutor-portal/shared-ui && cp -r shared-ui tutor-portal/shared-ui
rm -rf student-portal/shared-ui && cp -r shared-ui student-portal/shared-ui
```

## Verification
1. **Backend**: Hit `POST /api/subjects/{id}/books` with JSON body containing a Google Drive `video_url` — should create book with `created_by` populated
2. **Backend**: Verify `BookOut` response does NOT contain `watch_percentage`, `last_position_seconds`, `completed`, or `video_duration_seconds`
3. **Tutor portal**: Open BookForm, paste a Google Drive link in the video URL field, submit — should save successfully
4. **Tutor portal edit**: Open an existing book for editing — URL fields should be pre-populated with the stored URLs
5. **Student portal**: Open a book with a Google Drive `video_url` — should render iframe and play video. No progress bar visible.
6. **Student portal subject view**: Book cards should show title, standard, thumbnail (or placeholder), and question count — no progress bars
7. **Thumbnail**: BookCard should display thumbnail when a direct image URL is provided. Should show default placeholder when `thumbnail_url` is null or an invalid image URL (verified via `onError` fallback).
8. **Edge case**: Non-Google-Drive HTTP video URLs should fall back to `<video>` tag with full progress tracking
9. **Security**: Verify that `javascript:`, `data:`, and private IP URLs are rejected by the backend validation
10. **Iframe failure**: Paste a Google Drive link that is NOT shared publicly — verify the iframe shows Google's error (not a blank screen or crash)

## Notes
- Keep progress API endpoints (`backend/app/routers/progress.py`) intact — quiz features use related models (`QuizProgress`), and the `WatchProgress` table/model is referenced by the `Book` model's relationship. Can be cleaned up in a separate PR.
- `assetUrl()` in both portals already handles full HTTP URLs (`if path.startsWith("http") return path`) — no change needed
- `BookCard` has an `onError` fallback that shows a default placeholder SVG when the thumbnail URL fails to load — this covers the case where no thumbnail is provided or the URL is invalid
- Existing books with `/uploads/` paths will break after removing static mount — acceptable since this is a fresh dev deployment. If real data exists, run a SQL cleanup: `DELETE FROM books WHERE video_url LIKE '/uploads/%';`
- The `uploads/` directory on disk will become orphaned after removing the static mount. Can be deleted manually.
- `FileUpload` component remains in `shared-ui` exports — it's unused after this change but harmless to keep; can be removed in a future cleanup
