# A.J EduTrack V2 - Updated Implementation Plan

**Date**: 2026-03-27
**Status**: Clarified & Ready for Implementation
**Based on**: V2 Feature Plan + Stakeholder Feedback

---

## Clarification Decisions

### 1. **Quiz Duplication → Shared Service** ✅
**Decision**: Use single quiz service for both book quizzes and quiz sets.

**Implementation**:
```python
# backend/app/services/quiz.py (refactored)
class QuizService:
    async def submit_answer(
        self,
        quiz_source: str,  # "book" | "quiz_set"
        quiz_id: int,
        student_id: int,
        question_id: int,
        selected_option: str | None,
        is_skipped: bool = False
    ):
        # Single logic for both book and quiz_set quizzes

    async def get_quiz_session(
        self,
        quiz_source: str,
        quiz_id: int,
        student_id: int
    ):
        # Returns unified session regardless of source
```

**Database Schema**:
Instead of QuizSetQuestion duplicate, create unified table:
```python
# backend/app/models/question.py (enhanced)
class Question(AuditBase):
    # Source determination
    book_id: int | None = None  # FK to books
    quiz_set_id: int | None = None  # FK to quiz_sets

    # Shared fields
    question_text: str
    question_image_url: str | None
    option_a: str
    option_a_image_url: str | None
    # ... B, C, D
    is_skipped: bool = False

    # Constraint: exactly one of book_id or quiz_set_id must be NOT NULL
    __table_args__ = (
        CheckConstraint(
            "NOT (book_id IS NULL AND quiz_set_id IS NULL) AND "
            "NOT (book_id IS NOT NULL AND quiz_set_id IS NOT NULL)",
            name="question_source_check"
        ),
    )
```

**Similarly for Attempts & Progress**:
```python
# backend/app/models/quiz_attempt.py
class QuizAttempt(AuditBase):
    quiz_source: str  # "book" | "quiz_set"
    quiz_id: int  # book_id or quiz_set_id
    student_id: int
    question_id: int
    selected_option: str | None
    is_correct: bool
    is_skipped: bool
```

**Benefit**: Single codebase to maintain, consistent behavior across features.

---

### 2. **Recap Extensions** ✅
**Decision**: Support core Tiptap extensions. Validate on save to prevent unsupported extensions.

**Supported Extensions**:
```typescript
// shared-ui/src/constants/recap.ts
export const SUPPORTED_RECAP_EXTENSIONS = [
  "document",
  "paragraph",
  "text",
  "heading",    // H1, H2, H3 only
  "bulletList",
  "orderedList",
  "listItem",
  "bold",
  "italic",
  "code",       // inline code
  "codeBlock",  // with language selection
  "image",      // Google Drive URLs only
  "link",
  "horizontalRule",
  "blockquote",
] as const;

// NOT supported (will be filtered):
// - table, superscript, subscript, strikethrough
// - custom extensions
```

**Validation on Save**:
```typescript
// tutor-portal/src/components/RecapEditor.tsx
function validateRecapContent(content: any): boolean {
  // Recursively check all nodes are in SUPPORTED_RECAP_EXTENSIONS
  // Remove unsupported nodes with warning toast
  return cleanedContent;
}
```

**Backend Validation**:
```python
# backend/app/services/recap.py
def validate_recap_json(content: dict) -> dict:
    """Remove/warn about unsupported Tiptap extensions"""
    ALLOWED_NODE_TYPES = {...}

    def clean_node(node: dict) -> dict | None:
        if node.get("type") not in ALLOWED_NODE_TYPES:
            logger.warning(f"Removing unsupported node type: {node.get('type')}")
            return None
        return node

    # Recursively clean content
    return cleaned_content
```

**RecapViewer** (read-only, shared-ui):
```typescript
// shared-ui/src/components/RecapViewer.tsx
export function RecapViewer({ content }: { content: any }) {
  const nodeRenderers = {
    document: (node) => <div>{node.content?.map(n => render(n))}</div>,
    paragraph: (node) => <p>{renderInline(node)}</p>,
    heading: (node) => {
      const level = node.attrs.level;
      const Tag = `h${level}` as any;
      return <Tag>{renderInline(node)}</Tag>;
    },
    image: (node) => (
      <img
        src={toDirectImageUrl(node.attrs.src)}
        alt="recap"
        className="max-w-full h-auto"
      />
    ),
    // ... other nodes
  };

  return renderNode(content);
}
```

---

### 3. **Test Submission - Flag Only** ✅
**Decision**: `submitted_at` timestamp flag only. No file upload.

**UX Flow**:
1. Tutor uploads test file (PDF/DOC) via Drive link
2. Student sees test file, opens it, works offline
3. Student clicks "Mark as Submitted" button
4. Tutor sees checkmark next to student's name in submissions table
5. Tutor can download test file from Drive and grade manually (outside platform)

**Schema**:
```python
# backend/app/models/test_submission.py
class TestSubmission(AuditBase):
    test_id: int  # FK to BookTest
    student_id: int
    submitted_at: datetime | None = None  # NULL = not submitted

    __table_args__ = (
        UniqueConstraint("test_id", "student_id", name="test_submission_unique"),
    )
```

**API Endpoints**:
```python
# tutor-portal API
GET /api/books/{book_id}/test/submissions
# Returns: [{ student_id, student_name, submitted_at: datetime | null }]

PUT /api/books/{book_id}/test/submissions/{student_id}
# Toggles: if submitted_at is null → set to NOW(); if not null → set to NULL
# Returns: { student_id, submitted_at }
```

---

### 4. **QuizSetProgress Schema** ✅
**Decision**: Mirror QuizProgress structure exactly.

**Schema**:
```python
# backend/app/models/quiz_set_progress.py
class QuizSetProgress(AuditBase):
    quiz_set_id: int = Field(..., foreign_key="quiz_sets.id")
    student_id: int = Field(..., foreign_key="users.id")

    # Progress tracking
    is_started: bool = False
    is_completed: bool = False
    started_at: datetime | None = None
    completed_at: datetime | None = None

    # Scoring
    correct_count: int = 0
    skipped_count: int = 0
    total_questions: int = 0
    score: float = 0.0  # percentage

    __table_args__ = (
        UniqueConstraint("quiz_set_id", "student_id", name="quiz_set_progress_unique"),
    )
```

**Fields Explanation**:
- `is_started`: Student clicked "Start Quiz"
- `is_completed`: Student submitted quiz
- `correct_count`: Questions answered correctly
- `skipped_count`: Questions skipped
- `total_questions`: Total in quiz set
- `score`: (correct_count / total_questions) * 100

---

### 5. **toEmbedUrl() - Direct URL (No Conversion)** ✅
**Decision**: Tutor provides full embed URL directly (like thumbnails/videos).

**Pattern** (same as existing):
```typescript
// shared-ui/src/utils/googleDrive.ts (existing pattern for videos/thumbnails)

// For test files, tutor PROVIDES the URL like:
// https://drive.google.com/file/d/{FILE_ID}/preview
// OR
// https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing

// Student clicks "Open Test File" button:
window.open(test.file_url);  // Opens whatever URL tutor provided
```

**No conversion function needed** - it's already in embed/view format.

**Tutor Input Validation**:
```typescript
// tutor-portal/src/components/DriveMediaInput.tsx
// Accept URL, show preview, validate it's a valid Google Drive URL
function isValidDriveUrl(url: string): boolean {
  return url.includes("drive.google.com/file");
}
```

---

### 6. **Submissions Limit** ✅
**Decision**: Paginate with limit=50, offset=0.

**Endpoint**:
```python
GET /api/books/{book_id}/test/submissions?limit=50&offset=0

Returns:
{
  total: int,
  limit: 50,
  offset: 0,
  submissions: [
    { student_id, student_name, submitted_at },
    ...
  ]
}
```

**UI Implementation**:
```typescript
// tutor-portal/src/pages/SelfStudy/BookPreview.tsx - Test Tab
const [submissions, setSubmissions] = useState([]);
const [page, setPage] = useState(0);
const [total, setTotal] = useState(0);

useEffect(() => {
  const offset = page * 50;
  fetch(`/api/books/${bookId}/test/submissions?limit=50&offset=${offset}`)
    .then(r => {
      setSubmissions(r.submissions);
      setTotal(r.total);
    });
}, [page]);

// Render pagination: Previous / Next buttons, "Page X of Y"
```

---

### 7. **Mobile Support** ✅
**Decision**: Read-only on mobile. RecapEditor desktop-only.

**Mobile Strategy**:

#### Recap Tab (Mobile):
- **Tutor**: Show message "Use desktop to edit" + fallback read-only view
- **Student**: RecapViewer works fine (read-only JSX)

#### Test Tab (Mobile):
- Both roles see file link + "Open in Drive" button
- Submissions table → responsive card layout (student_name, checkbox submitted)

#### Quiz (Mobile):
- Works normally (existing responsive design)

**Implementation**:
```typescript
// tutor-portal/src/pages/SelfStudy/BookPreview.tsx
function RecapTab() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return isMobile ? (
    <div className="p-4 bg-yellow-50 rounded">
      <p>📱 Recap editing not supported on mobile.</p>
      <p>Use desktop to edit your notes.</p>
      <RecapViewer content={recap.content} /> {/* Show what exists */}
    </div>
  ) : (
    <RecapEditor recap={recap} onSave={handleSave} />
  );
}
```

---

## Updated File Structure

### New/Modified Files Summary

**Backend**:
```
backend/app/models/
  ├── question.py          ← REFACTOR: add quiz_set_id, remove QuizSetQuestion
  ├── quiz_attempt.py      ← ADD: quiz_source field
  ├── quiz_progress.py     ← ADD: quiz_source field
  ├── book_recap.py        ← NEW
  ├── book_test.py         ← NEW
  ├── test_submission.py   ← NEW
  └── quiz_set.py          ← NEW (minimal; reuses Question)

backend/app/services/
  ├── quiz.py              ← REFACTOR: unified service for book + quiz_set
  ├── recap.py             ← NEW
  └── test.py              ← NEW

backend/app/schemas/
  ├── quiz.py              ← UPDATE: add quiz_source
  ├── recap.py             ← NEW
  └── test.py              ← NEW

backend/app/routers/
  ├── quiz.py              ← UPDATE: add quiz_source parameter
  ├── recap.py             ← NEW
  └── test.py              ← NEW
```

**Shared UI**:
```
shared-ui/src/
  ├── components/
  │   ├── DriveMediaInput.tsx          ← NEW (reused F2, F6)
  │   ├── RecapEditor.tsx              ← NEW (tutor, Tiptap) [NOT in shared-ui]
  │   └── RecapViewer.tsx              ← NEW (read-only, no Tiptap)
  ├── types/
  │   └── index.ts                     ← UPDATE: add Recap, Test, QuizSet types
  ├── constants/
  │   └── recap.ts                     ← NEW: supported extensions
  └── utils/
      └── googleDrive.ts               ← UPDATE: add validation
```

**Tutor Portal**:
```
tutor-portal/src/
  ├── components/
  │   └── RecapEditor.tsx              ← NEW (Tiptap, tutor-only)
  ├── pages/SelfStudy/
  │   ├── BookPreview.tsx              ← UPDATE: add recap, test tabs
  │   ├── QuestionForm.tsx             ← UPDATE: add image inputs
  │   ├── BookAssign.tsx               ← No change
  │   └── Quizzes/                     ← NEW
  │       ├── QuizSetList.tsx
  │       ├── QuizSetForm.tsx
  │       ├── QuizSetQuestions.tsx
  │       └── QuizSetQuestionForm.tsx
  ├── config/sidebar.ts                ← UPDATE: add Quizzes link
  └── App.tsx                          ← UPDATE: add quiz routes
```

**Student Portal**:
```
student-portal/src/
  ├── pages/SelfStudy/
  │   ├── BookView.tsx                 ← UPDATE: add recap, test tabs
  │   ├── QuestionCard.tsx             ← UPDATE: add image rendering, skip
  │   ├── QuizPanel.tsx                ← REFACTOR: extract useQuizSession hook
  │   └── Quizzes/                     ← NEW
  │       ├── QuizSetDashboard.tsx
  │       └── QuizSetView.tsx
  ├── hooks/
  │   └── useQuizSession.ts            ← NEW (extracted from QuizPanel)
  ├── pages/Home/
  │   └── HomeDashboard.tsx            ← NEW
  ├── config/sidebar.ts                ← UPDATE: add Home, Quizzes
  └── App.tsx                          ← UPDATE: add routes, change default
```

---

## Alembic Migration Order

```python
# 1. Refactor Question to support both book and quiz_set
add_question_quiz_set_id_and_constraints

# 2. Update quiz_attempt and quiz_progress for quiz_source
add_quiz_source_fields

# 3. Add new tables for Recap, Test, QuizSet
add_book_recaps_table
add_book_tests_and_test_submissions_table
add_quiz_set_tables

# Each migration includes:
# - Table creation
# - FK constraints
# - Indexes for performance
# - Check constraints for data integrity
```

---

## Implementation Sequence (Recommended)

### Week 1: Foundation
- [ ] Refactor quiz service to unified model
- [ ] Database schema: Question + attempt/progress refactor
- [ ] Alembic migrations (test locally)
- [ ] API tests for quiz service (both sources)

### Week 2: Features 2-3 (Quiz Enhancements)
- [ ] Image support (Questions model already updated)
- [ ] Skip feature (schema + service + UI)
- [ ] QuestionCard updates (image rendering)
- [ ] QuizPanel updates (skip button, navigator)

### Week 3: Feature 1 (Recap)
- [ ] RecapEditor component (Tiptap)
- [ ] RecapViewer component (no Tiptap)
- [ ] Backend recap endpoints + service
- [ ] BookPreview/BookView tab integration
- [ ] Validation + extension filtering

### Week 4: Feature 6 (Test)
- [ ] BookTest model + TestSubmission model
- [ ] Backend endpoints + service
- [ ] Tutor Test tab (form + submissions table)
- [ ] Student Test tab (file link + submit button)

### Week 5: Feature 4 (Quiz Sets)
- [ ] QuizSet models (use unified Question)
- [ ] Quiz set endpoints (reuse quiz service)
- [ ] Tutor quiz pages (list, form, assign)
- [ ] Student quiz pages (dashboard, view)

### Week 6: Feature 5 (Home)
- [ ] Dashboard service (aggregation queries)
- [ ] HomeDashboard component
- [ ] Sidebar updates
- [ ] Default route change

### Week 7: Testing & Refinement
- [ ] E2E tests for each feature
- [ ] Mobile testing (responsive, RecapEditor fallback)
- [ ] Performance testing (large datasets)
- [ ] shared-ui sync to both portals

---

## Testing Checklist

### Quiz Service (Unified)
- [ ] Submit answer via book quiz (selected_option)
- [ ] Submit answer via book quiz (skip)
- [ ] Submit answer via quiz set quiz (selected_option)
- [ ] Submit answer via quiz set quiz (skip)
- [ ] Get session for both sources
- [ ] Finalize both sources correctly
- [ ] Skip indicator appears in both

### Recap Feature
- [ ] Tutor creates recap with supported extensions
- [ ] Tutor edits (debounce autosave works)
- [ ] Unsupported extension filtered (warning toast shown)
- [ ] Student views recap (RecapViewer renders correctly)
- [ ] Image in recap loads (Drive URL converted)
- [ ] Mobile: "Use desktop to edit" message shown

### Test Feature
- [ ] Tutor uploads test file (Drive link)
- [ ] Student sees test file
- [ ] Student can open file (window.open works)
- [ ] Student marks "submitted"
- [ ] Tutor sees submission checkmark
- [ ] Tutor toggles submission (on/off)
- [ ] Pagination works (limit=50)

### Quiz Sets
- [ ] Tutor creates quiz set
- [ ] Tutor adds questions (with images)
- [ ] Tutor assigns to students
- [ ] Student sees in dashboard
- [ ] Student takes quiz (skip/submit works)
- [ ] Student sees results
- [ ] Tutor sees progress

### Home Dashboard
- [ ] Pending quizzes show (book quizzes without progress)
- [ ] Continue watching shows (books with progress)
- [ ] Quiz sets ready show (assigned without completion)
- [ ] Empty states render correctly
- [ ] Skeleton loading visible briefly
- [ ] Links navigate correctly

---

## Performance Considerations

### Database Indexes
```sql
CREATE INDEX idx_question_book_id ON questions(book_id) WHERE book_id IS NOT NULL;
CREATE INDEX idx_question_quiz_set_id ON questions(quiz_set_id) WHERE quiz_set_id IS NOT NULL;
CREATE INDEX idx_quiz_attempt_quiz_source ON quiz_attempts(quiz_source, quiz_id, student_id);
CREATE INDEX idx_quiz_progress_quiz_source ON quiz_progress(quiz_source, quiz_id, student_id);
CREATE INDEX idx_test_submission_test_id ON test_submissions(test_id);
CREATE INDEX idx_quiz_set_assignment_student ON quiz_set_assignments(student_id);
```

### API Query Optimization
```python
# Load related data eagerly
quiz_set_with_questions = (
    session.query(QuizSet)
    .options(joinedload(QuizSet.questions))
    .filter_by(id=quiz_set_id)
    .first()
)

# Paginate large result sets
submissions = (
    session.query(User, TestSubmission)
    .outerjoin(TestSubmission, ...)
    .limit(50)
    .offset(offset)
    .all()
)
```

---

## Deployment Notes

### shared-ui Sync (CRITICAL)
After any shared-ui changes:
```bash
rm -rf tutor-portal/shared-ui && cp -r shared-ui tutor-portal/shared-ui
rm -rf student-portal/shared-ui && cp -r shared-ui student-portal/shared-ui
git add -A && git commit -m "sync: update shared-ui in both portals"
```

### Database Migration
```bash
# Test migration locally first
alembic upgrade head

# Verify no errors
# Check schema
```

### Feature Flags (Optional)
If deploying incrementally, consider feature flags:
```python
FEATURES = {
    "QUIZ_SETS_ENABLED": True,
    "RECAP_ENABLED": True,
    "TEST_TAB_ENABLED": True,
}
```

---

## Open Questions / Future Refinement

1. **Quiz Difficulty Levels**: Should quiz sets have difficulty? (Easy/Medium/Hard)
2. **Quiz Timer**: Should quiz sets have time limits?
3. **Quiz Randomization**: Should question order randomize per attempt?
4. **Recap Sharing**: Should students be able to export recap as PDF?
5. **Test Reattempts**: Can students retake test? (Currently no limit)
6. **Home Page Widgets**: Add more widgets? (Achievement progress, study streak, etc.)

---

**Document Complete**
Ready for implementation. All decisions documented, no ambiguity.
