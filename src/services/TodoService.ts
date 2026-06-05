import { Todo, Recurrence, TodoCompletion, createTodo, CreateTodoSchema, UpdateTodoSchema } from '../models/Todo.js';
import { z } from 'zod';
import { databaseService } from './DatabaseService.js';
import { v4 as uuidv4 } from 'uuid';

function matchesDate(recurrence: Recurrence, targetDate: Date, startDate: Date): boolean {
  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return false;

  if (recurrence.endDate) {
    const endDate = new Date(recurrence.endDate + 'T00:00:00');
    if (targetDate > endDate) return false;
  }

  switch (recurrence.frequency) {
    case 'daily': {
      return diffDays % recurrence.interval === 0;
    }
    case 'weekly': {
      const dayOfWeek = targetDate.getDay();
      if (recurrence.daysOfWeek && !recurrence.daysOfWeek.includes(dayOfWeek)) return false;
      const startDay = startDate.getDay();
      const adjustedDiff = diffDays + startDay;
      const weeksPassed = Math.floor(adjustedDiff / 7);
      return weeksPassed % recurrence.interval === 0;
    }
    case 'monthly': {
      const targetDay = recurrence.dayOfMonth ?? startDate.getDate();
      if (targetDate.getDate() !== targetDay) return false;
      const startMonth = startDate.getMonth() + startDate.getFullYear() * 12;
      const targetMonth = targetDate.getMonth() + targetDate.getFullYear() * 12;
      const monthsDiff = targetMonth - startMonth;
      return monthsDiff >= 0 && monthsDiff % recurrence.interval === 0;
    }
    case 'yearly': {
      if (targetDate.getMonth() !== startDate.getMonth() || targetDate.getDate() !== startDate.getDate()) return false;
      const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
      return yearsDiff >= 0 && yearsDiff % recurrence.interval === 0;
    }
    default:
      return false;
  }
}

function generateOccurrenceDates(recurrence: Recurrence, upToDate: string): string[] {
  const startDate = new Date(recurrence.startDate + 'T00:00:00');
  const end = new Date(upToDate + 'T00:00:00');
  const dates: string[] = [];
  const current = new Date(startDate);
  const maxIterations = 365 * 10;
  let iterations = 0;

  while (current <= end && iterations < maxIterations) {
    iterations++;
    if (matchesDate(recurrence, current, startDate)) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

class TodoService {
  createTodo(data: z.infer<typeof CreateTodoSchema>): Todo {
    const validated = CreateTodoSchema.parse(data);
    const todo = createTodo(validated);
    const db = databaseService.getDb();
    const stmt = db.prepare(`
      INSERT INTO todos (id, title, description, completedAt, scheduledDate, dueDate, recurrence, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      todo.id,
      todo.title,
      todo.description,
      todo.completedAt,
      todo.scheduledDate,
      todo.dueDate,
      todo.recurrence ? JSON.stringify(todo.recurrence) : null,
      todo.createdAt,
      todo.updatedAt
    );
    return todo;
  }

  getTodo(id: string): Todo | undefined {
    const db = databaseService.getDb();
    const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.rowToTodo(row);
  }

  getAllTodos(): Todo[] {
    const db = databaseService.getDb();
    const stmt = db.prepare('SELECT * FROM todos');
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToTodo(row));
  }

  getActiveTodos(): Todo[] {
    const db = databaseService.getDb();
    const stmt = db.prepare('SELECT * FROM todos WHERE completedAt IS NULL');
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToTodo(row));
  }

  updateTodo(data: z.infer<typeof UpdateTodoSchema>): Todo | undefined {
    const todo = this.getTodo(data.id);
    if (!todo) return undefined;

    const updatedAt = new Date().toISOString();
    const db = databaseService.getDb();
    const stmt = db.prepare(`
      UPDATE todos
      SET title = ?, description = ?, scheduledDate = ?, dueDate = ?, updatedAt = ?
      WHERE id = ?
    `);
    stmt.run(
      data.title !== undefined ? data.title : todo.title,
      data.description !== undefined ? data.description : todo.description,
      data.scheduledDate !== undefined ? data.scheduledDate : todo.scheduledDate,
      data.dueDate !== undefined ? data.dueDate : todo.dueDate,
      updatedAt,
      todo.id
    );
    return this.getTodo(todo.id);
  }

  completeTodo(id: string, date?: string): { todo: Todo; wasRecurring: boolean } {
    const todo = this.getTodo(id);
    if (!todo) throw new Error(`Todo with ID ${id} not found`);

    if (todo.recurrence) {
      if (!date) throw new Error("Date is required for completing recurring tasks");
      this.completeRecurringTask(id, date);
      const updated = this.getTodo(id);
      if (!updated) throw new Error(`Todo with ID ${id} not found after completion`);
      return { todo: updated, wasRecurring: true };
    }

    const now = new Date().toISOString();
    const db = databaseService.getDb();
    const stmt = db.prepare(`
      UPDATE todos SET completedAt = ?, updatedAt = ? WHERE id = ?
    `);
    stmt.run(now, now, id);
    const updated = this.getTodo(id);
    if (!updated) throw new Error(`Todo with ID ${id} not found after completion`);
    return { todo: updated, wasRecurring: false };
  }

  completeRecurringTask(todoId: string, date: string): void {
    const existing = this.getCompletionForDate(todoId, date);
    if (existing) return;

    const db = databaseService.getDb();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO todo_completions (id, todoId, completedDate, completedAt) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), todoId, date, now);
  }

  getCompletionForDate(todoId: string, date: string): TodoCompletion | undefined {
    const db = databaseService.getDb();
    const row = db.prepare(
      'SELECT * FROM todo_completions WHERE todoId = ? AND completedDate = ?'
    ).get(todoId, date) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      todoId: row.todoId,
      completedDate: row.completedDate,
      completedAt: row.completedAt,
    };
  }

  completeAllRecurrences(todoId: string): { backfilledCount: number } {
    const todo = this.getTodo(todoId);
    if (!todo) throw new Error(`Todo with ID ${todoId} not found`);
    if (!todo.recurrence) throw new Error('Task is not recurring');

    const today = new Date().toISOString().slice(0, 10);
    const occurrenceDates = generateOccurrenceDates(todo.recurrence, today);

    const db = databaseService.getDb();
    const now = new Date().toISOString();
    let backfilledCount = 0;

    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO todo_completions (id, todoId, completedDate, completedAt) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
      for (const date of occurrenceDates) {
        insertStmt.run(uuidv4(), todoId, date, now);
        backfilledCount++;
      }

      const updatedRecurrence = { ...todo.recurrence, endDate: today };
      db.prepare(
        'UPDATE todos SET recurrence = ?, updatedAt = ? WHERE id = ?'
      ).run(JSON.stringify(updatedRecurrence), now, todoId);
    });

    transaction();
    return { backfilledCount };
  }

  deleteTodo(id: string): boolean {
    const db = databaseService.getDb();
    const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  searchByTitle(title: string): Todo[] {
    const searchTerm = `%${title}%`;
    const db = databaseService.getDb();
    const stmt = db.prepare('SELECT * FROM todos WHERE title LIKE ? COLLATE NOCASE');
    const rows = stmt.all(searchTerm) as any[];
    return rows.map(row => this.rowToTodo(row));
  }

  searchByDate(dateStr: string): Todo[] {
    const db = databaseService.getDb();
    const stmt = db.prepare('SELECT * FROM todos WHERE scheduledDate = ?');
    const rows = stmt.all(dateStr) as any[];
    return rows.map(row => this.rowToTodo(row));
  }

  getTasksForDate(date: string): { today: Todo[]; overdue: Todo[] } {
    const db = databaseService.getDb();

    const todayRows = db.prepare(
      'SELECT * FROM todos WHERE scheduledDate = ? AND completedAt IS NULL'
    ).all(date) as any[];

    const overdueRows = db.prepare(
      'SELECT * FROM todos WHERE completedAt IS NULL AND (scheduledDate IS NOT NULL AND scheduledDate < ? OR dueDate IS NOT NULL AND dueDate < ?)'
    ).all(date, date) as any[];

    const recurringRows = db.prepare(
      'SELECT * FROM todos WHERE recurrence IS NOT NULL AND completedAt IS NULL'
    ).all() as any[];

    const recurringToday: Todo[] = [];
    const targetDate = new Date(date + 'T00:00:00');

    for (const row of recurringRows) {
      const todo = this.rowToTodo(row);
      if (!todo.recurrence) continue;

      const startDate = new Date(todo.recurrence.startDate + 'T00:00:00');
      if (!matchesDate(todo.recurrence, targetDate, startDate)) continue;

      const completion = this.getCompletionForDate(todo.id, date);
      if (!completion) {
        recurringToday.push(todo);
      }
    }

    const today = [...todayRows.map(r => this.rowToTodo(r)), ...recurringToday];
    const overdue = overdueRows.map(r => this.rowToTodo(r));

    return { today, overdue };
  }

  summarizeActiveTodos(): string {
    const activeTodos = this.getActiveTodos();
    if (activeTodos.length === 0) {
      return "No active todos found.";
    }
    const summary = activeTodos.map(todo => `- ${todo.title}`).join('\n');
    return `# Active Todos Summary\n\nThere are ${activeTodos.length} active todos:\n\n${summary}`;
  }

  private rowToTodo(row: any): Todo {
    let recurrence: Recurrence | null = null;
    if (row.recurrence) {
      try {
        recurrence = typeof row.recurrence === 'string' ? JSON.parse(row.recurrence) : row.recurrence;
      } catch {
        recurrence = null;
      }
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completedAt: row.completedAt,
      completed: row.completedAt !== null,
      scheduledDate: row.scheduledDate ?? null,
      dueDate: row.dueDate ?? null,
      recurrence,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const todoService = new TodoService();
