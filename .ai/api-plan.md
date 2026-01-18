# REST API Plan

This document outlines the REST API architecture for the PR/Diff Explainer application. The API is designed to be implemented using Astro 5 API Routes (`src/pages/api/`) which will interact with Supabase (Database & Auth) and OpenRouter (AI).

## 1. Resources

| Resource | DB Table | Description |
| :--- | :--- | :--- |
| **Analyses** | `pr_analyses` | Stores generated PR descriptions, diffs, and metadata. |
| **Statuses** | `analysis_statuses` | Dictionary of available analysis statuses (e.g., draft, accepted). |

*Note: `ai_request_logs` is an internal resource used for auditing and is not exposed directly via public API endpoints in this MVP.*

## 2. Endpoints

### 2.1 Analysis Management

#### POST `/api/analysis`
**Creates a new analysis draft.** This is the first step in the flow. It saves the diff and metadata immediately to establish an ID, allowing subsequent AI requests to be logged against this record. It also makes first request for AI Generation

- **Request Body:**
  ```json
  {
    "pr_name": "string",
    "branch_name": "string",
    "ticket_id": "string (optional)",
    "diff_content": "string (raw git diff)"
  }
  ```
- **Response Body (Success 201):**
  ```json
  {
    "data": {
      "id": "UUID",
      "status": { "id": 1, "code": "draft" },
      "ai_response": {
        "summary": "string (markdown)",
        "risks": "string (markdown)",
        "tests": "string (markdown)"
      },
      "created_at": "ISO8601"
    }
  }
  ```
- **Business Logic:**
  - Validates `diff_content` length (<= 1000 lines).
  - Inserts record into `pr_analyses` with `status_id` = 1 (draft) and `ai_response` = `{}` (empty JSON placeholder) to satisfy NOT NULL constraint.
  - Makes the first request to AI analysis generator, then saves the response in `ai_request_logs`.

#### POST `/api/analysis/:id/generate`
**Triggers AI generation for an existing draft.** Uses the saved diff content from the database to generate the explanation.

- **Description:** Fetches the diff for the given `:id`, calls the AI service, logs the request (linked to this `:id`), and updates the analysis record with the result.
- **Request Body:** Empty (or optional configuration in future).
- **Response Body (Success 200):**
  ```json
  {
    "data": {
      "summary": "string (markdown)",
      "risks": "string (markdown)",
      "tests": "string (markdown)"
    }
  }
  ```
- **Business Logic:**
  - Verifies user ownership of `:id`.
  - Reads `diff_content` from DB.
  - Calls OpenRouter/AI.
  - **Crucial:** Creates `ai_request_logs` entry with `analysis_id` = `:id`.
  - Updates `pr_analyses` with the new `ai_response`.
- **Error Responses:**
  - `404 Not Found`: Analysis ID not found or not owned by user.
  - `429 Too Many Requests`: Rate limit.
  - `500`: AI Error (logged).

#### PUT `/api/analysis/:id`
**Updates/Finalizes an analysis.** Used when the user edits the AI result, modifies metadata (pr_name, branch_name, ticket_id), or decides to "Save/Accept" the analysis.

- **Request Body:**
  ```json
  {
    "pr_name": "string",
    "branch_name": "string (max 255 chars)",
    "ai_response": {
      "summary": "string",
      "risks": "string",
      "tests": "string"
    },
    "status_id": 2,
    "ticket_id": "string (optional)"
  }
  ```
- **Response Body (Success 200):** Updated object.

#### GET `/api/analysis/:id`
Retrieves the full details of a specific analysis.

- **Response Body (Success 200):**
  ```json
  {
    "data": {
      "id": "UUID",
      "pr_name": "string",
      "diff_content": "string",
      "ai_response": {
        "summary": "string",
        "risks": "string",
        "tests": "string"
      },
      "status": { "id": 1, "code": "draft" },
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  }
  ```

#### DELETE `/api/analysis`
Permanently removes one or more analyses.

- **Request Body:**
  ```json
  {
    "ids": ["UUID", "UUID"]
  }
  ```
- **Response Body (Success 200):**
  ```json
  {
    "deleted_count": 2
  }
  ```

### 2.2 History

#### GET `/api/analysis/all`
Retrieves a paginated list of saved analyses for the current user.

- **Parameters:**
  - `page`: number (default 1)
  - `limit`: number (default 10)
  - `status_id`: number (optional filter)
  - `search`: string (optional, searches `pr_name` or `branch_name`)
  - `sort_field`: string (default 'created_at', selects the field to sort by)
  - `sort_order`: string (default 'desc')
- **Response Body (Success 200):**
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "pr_name": "string",
        "status": { "id": 1, "code": "draft" },
        "created_at": "ISO8601"
      }
    ],
    "meta": { "total": 100, "page": 1, "limit": 10 }
  }
  ```

### 2.3 Metadata

#### GET `/api/statuses`
Returns the dictionary of available analysis statuses.

- **Response Body (Success 200):**
  ```json
  {
    "data": [
      { "id": 1, "code": "draft" },
      { "id": 2, "code": "pending_review" },
      { "id": 3, "code": "completed" }
    ]
  }
  ```

## 3. Authentication and Authorization

- **Mechanism:** Supabase Auth (JWT).
- **Implementation:**
  - **Header:** `Authorization: Bearer <token>` required for all endpoints.
  - **RLS:** All DB operations use a Supabase client initialized with the user's token.

## 4. Validation and Business Logic

### 4.1 Global
- **Sanitization:** All inputs sanitized.
- **Ownership:** RLS ensures users only access their own analyses.

### 4.2 Specific Logic
**Endpoint: `POST /api/analysis` (Create Draft)**
- **Constraint:** `diff_content` max 1000 lines.
- **Logic:** Initialize `ai_response` with empty JSON `{}` to satisfy DB constraints.

**Endpoint: `POST /api/analysis/:id/generate` (Generate)**
- **Constraint:** Timeout handling for AI calls.
- **Logic:** **Always** log to `ai_request_logs` with the provided `analysis_id`, ensuring strict audit trails even for retries or failed generations.

