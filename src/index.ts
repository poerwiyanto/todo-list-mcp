import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  CreateTodoSchema,
  UpdateTodoSchema,
  CompleteTodoSchema,
  DeleteTodoSchema,
  SearchTodosByTitleSchema,
  SearchTodosByDateSchema,
  GetTasksForDateSchema,
  CompleteAllRecurrencesSchema,
} from "./models/Todo.js";

import { todoService } from "./services/TodoService.js";
import { databaseService } from "./services/DatabaseService.js";

import { createSuccessResponse, createErrorResponse, formatTodo, formatTodoList, formatTasksForDate } from "./utils/formatters.js";
import { config } from "./config.js";

const server = new McpServer({
  name: "Todo-MCP-Server",
  version: "2.0.0",
});

async function safeExecute<T>(operation: () => T, errorMessage: string) {
  try {
    const result = operation();
    return result;
  } catch (error) {
    console.error(errorMessage, error);
    if (error instanceof Error) {
      return new Error(`${errorMessage}: ${error.message}`);
    }
    return new Error(errorMessage);
  }
}

server.tool(
  "create-todo",
  "Create a new todo item with optional scheduling, deadline, or recurrence",
  {
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional()
      .describe("Date when you plan to work on this task (YYYY-MM-DD)"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional()
      .describe("Hard deadline for this task (YYYY-MM-DD). Mutually exclusive with recurrence."),
    recurrence: z.object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      interval: z.number().int().min(1).describe("Every N frequency units (e.g., interval 2 with weekly = every 2 weeks)"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD").describe("When recurrence begins (required)"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD").optional().describe("When recurrence stops"),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().describe("For weekly: 0=Sun through 6=Sat. e.g. [1,3,5] = Mon/Wed/Fri"),
      dayOfMonth: z.number().int().min(1).max(31).optional().describe("For monthly: day of month (1-31)"),
    }).optional()
      .describe("Recurrence pattern. Mutually exclusive with dueDate."),
  },
  async ({ title, description, scheduledDate, dueDate, recurrence }) => {
    const result = await safeExecute(() => {
      const newTodo = todoService.createTodo({ title, description, scheduledDate, dueDate, recurrence });
      return formatTodo(newTodo);
    }, "Failed to create todo");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(`✅ Todo Created:\n\n${result}`);
  }
);

server.tool(
  "list-todos",
  "List all todos",
  {},
  async () => {
    const result = await safeExecute(() => {
      const todos = todoService.getAllTodos();
      return formatTodoList(todos);
    }, "Failed to list todos");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "get-todo",
  "Get a specific todo by ID",
  {
    id: z.string().uuid("Invalid Todo ID"),
  },
  async ({ id }) => {
    const result = await safeExecute(() => {
      const todo = todoService.getTodo(id);
      if (!todo) {
        throw new Error(`Todo with ID ${id} not found`);
      }
      return formatTodo(todo);
    }, "Failed to get todo");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "update-todo",
  "Update a todo title, description, scheduled date, or due date",
  {
    id: z.string().uuid("Invalid Todo ID"),
    title: z.string().min(1, "Title is required").optional(),
    description: z.string().min(1, "Description is required").optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").nullable().optional()
      .describe("Set or clear the scheduled date"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").nullable().optional()
      .describe("Set or clear the due date"),
  },
  async ({ id, title, description, scheduledDate, dueDate }) => {
    const result = await safeExecute(() => {
      const validatedData = UpdateTodoSchema.parse({ id, title, description, scheduledDate, dueDate });

      if (!title && !description && scheduledDate === undefined && dueDate === undefined) {
        throw new Error("At least one field must be provided");
      }

      const updatedTodo = todoService.updateTodo(validatedData);
      if (!updatedTodo) {
        throw new Error(`Todo with ID ${id} not found`);
      }

      return formatTodo(updatedTodo);
    }, "Failed to update todo");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(`✅ Todo Updated:\n\n${result}`);
  }
);

server.tool(
  "complete-todo",
  "Mark a todo as completed. For recurring tasks, provide a date to complete for that specific day.",
  {
    id: z.string().uuid("Invalid Todo ID"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional()
      .describe("Required for recurring tasks: the date to mark as completed (YYYY-MM-DD)"),
  },
  async ({ id, date }) => {
    const result = await safeExecute(() => {
      const validatedData = CompleteTodoSchema.parse({ id, date });
      const { todo, wasRecurring } = todoService.completeTodo(validatedData.id, validatedData.date);
      return formatTodo(todo);
    }, "Failed to complete todo");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(`✅ Todo Completed:\n\n${result}`);
  }
);

server.tool(
  "delete-todo",
  "Delete a todo (also removes all completion records for recurring tasks)",
  {
    id: z.string().uuid("Invalid Todo ID"),
  },
  async ({ id }) => {
    const result = await safeExecute(() => {
      const validatedData = DeleteTodoSchema.parse({ id });
      const todo = todoService.getTodo(validatedData.id);

      if (!todo) {
        throw new Error(`Todo with ID ${id} not found`);
      }

      const success = todoService.deleteTodo(validatedData.id);

      if (!success) {
        throw new Error(`Failed to delete todo with ID ${id}`);
      }

      return todo.title;
    }, "Failed to delete todo");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(`✅ Todo Deleted: "${result}"`);
  }
);

server.tool(
  "search-todos-by-title",
  "Search todos by title (case insensitive partial match)",
  {
    title: z.string().min(1, "Search term is required"),
  },
  async ({ title }) => {
    const result = await safeExecute(() => {
      const validatedData = SearchTodosByTitleSchema.parse({ title });
      const todos = todoService.searchByTitle(validatedData.title);
      return formatTodoList(todos);
    }, "Failed to search todos");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "search-todos-by-date",
  "Search todos by scheduled date (format: YYYY-MM-DD)",
  {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  },
  async ({ date }) => {
    const result = await safeExecute(() => {
      const validatedData = SearchTodosByDateSchema.parse({ date });
      const todos = todoService.searchByDate(validatedData.date);
      return formatTodoList(todos);
    }, "Failed to search todos by date");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "get-tasks-for-date",
  "Get all tasks for a specific date: scheduled one-shot tasks, recurring tasks due that day, and overdue tasks",
  {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  },
  async ({ date }) => {
    const result = await safeExecute(() => {
      const validatedData = GetTasksForDateSchema.parse({ date });
      const { today, overdue } = todoService.getTasksForDate(validatedData.date);
      return formatTasksForDate(validatedData.date, today, overdue);
    }, "Failed to get tasks for date");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "complete-all-recurrences",
  "Mark all past, present, and future recurrences of a recurring task as done. Retires the task permanently.",
  {
    id: z.string().uuid("Invalid Todo ID"),
  },
  async ({ id }) => {
    const result = await safeExecute(() => {
      const validatedData = CompleteAllRecurrencesSchema.parse({ id });
      const { backfilledCount } = todoService.completeAllRecurrences(validatedData.id);
      return backfilledCount;
    }, "Failed to complete all recurrences");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(`✅ All recurrences completed. ${result} completion(s) recorded.`);
  }
);

server.tool(
  "list-active-todos",
  "List all non-completed todos",
  {},
  async () => {
    const result = await safeExecute(() => {
      const todos = todoService.getActiveTodos();
      return formatTodoList(todos);
    }, "Failed to list active todos");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

server.tool(
  "summarize-active-todos",
  "Generate a summary of all active (non-completed) todos",
  {},
  async () => {
    const result = await safeExecute(() => {
      return todoService.summarizeActiveTodos();
    }, "Failed to summarize active todos");

    if (result instanceof Error) {
      return createErrorResponse(result.message);
    }

    return createSuccessResponse(result);
  }
);

async function main() {
  console.error("Starting Todo MCP Server...");
  console.error(`SQLite database path: ${config.db.path}`);

  try {
    process.on('SIGINT', () => {
      console.error('Shutting down...');
      databaseService.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Shutting down...');
      databaseService.close();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Todo MCP Server running on stdio transport");
  } catch (error) {
    console.error("Failed to start Todo MCP Server:", error);
    databaseService.close();
    process.exit(1);
  }
}

main();
