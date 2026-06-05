---
name: todo-skill
description: >
  Manage personal tasks and daily planning via the todo-list MCP server.
  Use when the user asks about their schedule, daily tasks, what to do today,
  marks tasks complete, creates tasks with deadlines or recurrence, or
  wants to see overdue items. Triggers on: "what should I do today",
  "daily plan", "add task", "remind me", "done with", "what's overdue",
  "my tasks", "schedule", "recurring task", "mark as complete",
  "what's on my plate", "create a todo".
license: MIT
---

# Todo Skill

Manage personal tasks with scheduling, deadlines, and recurrence using the todo-list MCP server.

## Available Tools

| Tool | When to Use |
|------|-------------|
| `get-tasks-for-date` | Daily planning — returns today's tasks + overdue items grouped by section |
| `create-todo` | New task with optional scheduling, deadline, or recurrence |
| `complete-todo` | Mark a task done. For recurring tasks, include `date` parameter |
| `complete-all-recurrences` | Retire a recurring task — backfills all past completions and stops future recurrences |
| `search-todos-by-date` | Find all tasks scheduled for a specific date (flat list) |
| `search-todos-by-title` | Find tasks by name (partial match, case-insensitive) |
| `list-todos` | List all tasks (completed and incomplete) |
| `list-active-todos` | List all incomplete tasks |
| `get-todo` | Look up a specific task by ID |
| `update-todo` | Modify a task's title, description, scheduled date, or due date |
| `delete-todo` | Remove a task permanently (cascades completion records for recurring tasks) |
| `summarize-active-todos` | Generate a summary of all pending tasks |

## Daily Planning Workflow

This is the primary use case — what the agent does when the user asks about their day.

1. Call `get-tasks-for-date` with today's date in YYYY-MM-DD format
2. Present results showing two sections:
   - **Today's Tasks**: Tasks scheduled for this date + recurring tasks that match this day
   - **Overdue**: Tasks past their scheduled date or deadline, not yet completed
3. As the user indicates they've completed a task, call `complete-todo` with the task ID
4. For recurring tasks, always include the `date` parameter in `complete-todo`
5. Offer to reschedule overdue tasks if the user wants

## Creating Tasks

Use `create-todo` with these parameters:

| Parameter | Required | Format | Notes |
|-----------|----------|--------|-------|
| `title` | Yes | String | Task name |
| `description` | Yes | String (Markdown) | Task details |
| `scheduledDate` | No | YYYY-MM-DD | When you plan to work on it |
| `dueDate` | No | YYYY-MM-DD | Hard deadline |
| `recurrence` | No | Object | Repeat pattern (see below) |

### Recurrence Object

```json
{
  "frequency": "daily" | "weekly" | "monthly" | "yearly",
  "interval": 1,
  "startDate": "2026-06-01",
  "endDate": "2026-12-31",
  "daysOfWeek": [1, 3, 5],
  "dayOfMonth": 15
}
```

- `startDate` is required — explicitly set when the recurrence begins
- `interval` is how many frequency units between occurrences (e.g., `interval: 2` with `weekly` = every 2 weeks)
- `daysOfWeek` is an array of 0-6 (0=Sun, 6=Sat) for weekly patterns
- `dayOfMonth` is 1-31 for monthly patterns
- `endDate` is optional — when to stop recurring

### Mutual Exclusion

`dueDate` and `recurrence` cannot both be set on the same task. If a user requests both, ask which one they prefer.

## Completing Tasks

### One-shot tasks

Call `complete-todo` with just the task ID. The task gets a permanent completion timestamp.

### Recurring tasks

Call `complete-todo` with the task ID AND a `date` parameter in YYYY-MM-DD format.

```
complete-todo(id: "abc-123", date: "2026-06-05")
```

The task is recorded as completed for that specific date but remains active for future dates.

### Retiring recurring tasks

Call `complete-all-recurrences` with the task ID. This:
- Backfills completion records for all past occurrence dates
- Marks today as completed
- Sets the recurrence `endDate` to today
- The task will no longer appear in future `get-tasks-for-date` calls

## Gotchas

These are critical facts that would cause errors without this skill:

1. **`complete-todo` requires `date` for recurring tasks** — calling without `date` on a recurring task returns an error
2. **`dueDate` and `recurrence` are mutually exclusive** — setting both on creation is rejected by validation
3. **Recurring tasks reset each day** — completing a recurring task for today doesn't affect tomorrow; it appears again the next day
4. **`complete-all-recurrences` permanently retires the task** — it sets `endDate` to today and backfills all past dates
5. **Dates must be YYYY-MM-DD format** — no time component, no other date formats accepted
6. **Node 20 required** — the MCP server requires Node 20 to build and run (`better-sqlite3` native module doesn't compile on Node 24)
7. **`get-tasks-for-date` vs `search-todos-by-date`** — the former returns grouped sections with overdue items; the latter returns a flat list of matching tasks

## Platform Setup

For MCP server installation instructions, see [references/platform-setup.md](references/platform-setup.md).

For detailed tool parameters and examples, see [references/tool-api.md](references/tool-api.md).
