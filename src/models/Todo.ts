import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  recurrence: Recurrence | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoCompletion {
  id: string;
  todoId: string;
  completedDate: string;
  completedAt: string;
}

const RecurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format").optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const CreateTodoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  scheduledDate: DateStringSchema.optional(),
  dueDate: DateStringSchema.optional(),
  recurrence: RecurrenceSchema.optional(),
}).refine(
  (data) => !(data.dueDate && data.recurrence),
  { message: "dueDate and recurrence are mutually exclusive" }
);

export const UpdateTodoSchema = z.object({
  id: z.string().uuid("Invalid Todo ID"),
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().min(1, "Description is required").optional(),
  scheduledDate: DateStringSchema.nullable().optional(),
  dueDate: DateStringSchema.nullable().optional(),
});

export const CompleteTodoSchema = z.object({
  id: z.string().uuid("Invalid Todo ID"),
  date: DateStringSchema.optional(),
});

export const DeleteTodoSchema = z.object({
  id: z.string().uuid("Invalid Todo ID"),
});

export const SearchTodosByTitleSchema = z.object({
  title: z.string().min(1, "Search term is required"),
});

export const SearchTodosByDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const GetTasksForDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const CompleteAllRecurrencesSchema = z.object({
  id: z.string().uuid("Invalid Todo ID"),
});

export function createTodo(data: z.infer<typeof CreateTodoSchema>): Todo {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    completed: false,
    completedAt: null,
    scheduledDate: data.scheduledDate ?? null,
    dueDate: data.dueDate ?? null,
    recurrence: data.recurrence ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
