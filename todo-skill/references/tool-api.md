# Tool API Reference

Detailed parameters, examples, and error cases for each MCP tool.

## create-todo

Create a new task.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Task name (min 1 char) |
| `description` | string | Yes | Task details (Markdown, min 1 char) |
| `scheduledDate` | string | No | Date you plan to work on it (YYYY-MM-DD) |
| `dueDate` | string | No | Hard deadline (YYYY-MM-DD) |
| `recurrence` | object | No | Repeat pattern (mutually exclusive with `dueDate`) |

**Recurrence object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `frequency` | string | Yes | `daily`, `weekly`, `monthly`, or `yearly` |
| `interval` | integer | Yes | Every N frequency units (min 1) |
| `startDate` | string | Yes | When recurrence begins (YYYY-MM-DD) |
| `endDate` | string | No | When recurrence stops (YYYY-MM-DD) |
| `daysOfWeek` | array | No | 0-6 for weekly (0=Sun, 6=Sat) |
| `dayOfMonth` | integer | No | 1-31 for monthly |

**Example — one-shot with scheduling:**

```json
{
  "title": "Review PR #42",
  "description": "Check for accessibility and performance",
  "scheduledDate": "2026-06-10",
  "dueDate": "2026-06-12"
}
```

**Example — recurring weekdays:**

```json
{
  "title": "Daily standup",
  "description": "Join team standup at 9am",
  "recurrence": {
    "frequency": "weekly",
    "interval": 1,
    "startDate": "2026-06-08",
    "daysOfWeek": [1, 2, 3, 4, 5]
  }
}
```

**Example — monthly rent:**

```json
{
  "title": "Pay rent",
  "description": "Transfer to landlord",
  "recurrence": {
    "frequency": "monthly",
    "interval": 1,
    "startDate": "2026-06-01",
    "dayOfMonth": 1
  }
}
```

**Errors:**
- `dueDate` and `recurrence` both set → validation error
- Missing `startDate` in recurrence → validation error
- Empty `title` or `description` → validation error

---

## complete-todo

Mark a task as completed.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task ID |
| `date` | string | Conditional | Required for recurring tasks (YYYY-MM-DD) |

**One-shot tasks:** Call with just `id`. Sets `completedAt` permanently.

**Recurring tasks:** Call with `id` AND `date`. Records completion for that specific date in `todo_completions` table. The task remains active for other dates.

**Example — complete one-shot:**

```json
{ "id": "abc-123-def" }
```

**Example — complete recurring for today:**

```json
{
  "id": "abc-123-def",
  "date": "2026-06-05"
}
```

**Errors:**
- Recurring task without `date` → error: "Date is required for completing recurring tasks"
- Already completed for that date → returns info message (no duplicate)

---

## complete-all-recurrences

Retire a recurring task permanently.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task ID |

**What happens:**
1. Computes all occurrence dates from `startDate` to today
2. Inserts completion records for any dates not yet completed
3. Sets `recurrence.endDate` to today
4. Task no longer appears in future `get-tasks-for-date` calls

**Errors:**
- Non-recurring task → error: "Task is not recurring"
- Task not found → error: "Todo with ID not found"

---

## get-tasks-for-date

Get tasks for a specific date — the daily planning tool.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Target date (YYYY-MM-DD) |

**Returns:**
- **Today's Tasks**: One-shot tasks with `scheduledDate = date` + recurring tasks matching the date pattern (not yet completed for that date)
- **Overdue**: Tasks where `scheduledDate < date` OR `dueDate < date`, not completed

**Example:**

```json
{ "date": "2026-06-05" }
```

---

## search-todos-by-date

Search tasks by scheduled date.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Scheduled date (YYYY-MM-DD) |

**Returns:** Flat list of tasks where `scheduledDate = date`. Does NOT include overdue or recurring tasks.

**Difference from `get-tasks-for-date`:** This returns a flat list. `get-tasks-for-date` returns grouped sections with overdue items and recurring tasks.

---

## search-todos-by-title

Search tasks by title (case-insensitive partial match).

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Search term (min 1 char) |

**Example:** Searching "report" matches "Submit quarterly report", "Report bug", etc.

---

## list-todos

List all tasks. Takes no parameters.

---

## list-active-todos

List all incomplete tasks. Takes no parameters.

---

## get-todo

Look up a specific task by ID.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task ID |

---

## update-todo

Modify a task's fields.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task ID |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `scheduledDate` | string or null | No | Set or clear scheduled date |
| `dueDate` | string or null | No | Set or clear due date |

**Note:** Cannot update `recurrence` — delete and recreate instead.

**Example — reschedule:**

```json
{
  "id": "abc-123-def",
  "scheduledDate": "2026-06-19"
}
```

**Example — clear due date:**

```json
{
  "id": "abc-123-def",
  "dueDate": null
}
```

---

## delete-todo

Remove a task permanently.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task ID |

**Note:** For recurring tasks, this cascades and removes all completion records from `todo_completions`.

---

## summarize-active-todos

Generate a summary of all pending tasks. Takes no parameters.

Returns a Markdown summary with count and list of active task titles.
