---
name: Backend is frozen
description: Never modify backend code — only frontend changes are in scope for the React migration
type: feedback
---

Do not modify any files in `backend/`. The backend is frozen and must not change during the React migration.

**Why:** The React migration is a frontend-only framework swap. Backend API contracts are stable and must be consumed as-is.

**How to apply:** When working on this project, only touch files in `frontend/`. Service layer code in the new React app must match the existing backend API shapes exactly.
