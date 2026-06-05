import { Todo, Recurrence } from "../models/Todo.js";

function formatRecurrence(recurrence: Recurrence): string {
  const freqLabel = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  }[recurrence.frequency];

  const intervalLabel = recurrence.interval === 1 ? freqLabel : `${recurrence.interval} ${freqLabel}s`;
  let label = `Every ${intervalLabel}`;

  if (recurrence.daysOfWeek) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = recurrence.daysOfWeek.map(d => dayNames[d]).join(', ');
    label += ` (${days})`;
  }

  if (recurrence.dayOfMonth !== undefined) {
    label += ` (day ${recurrence.dayOfMonth})`;
  }

  if (recurrence.endDate) {
    label += ` until ${recurrence.endDate}`;
  }

  return label;
}

export function formatTodo(todo: Todo): string {
  let header = `## ${todo.title} ${todo.completed ? '✅' : '⏳'}`;

  const meta: string[] = [`ID: ${todo.id}`];

  if (todo.scheduledDate) {
    meta.push(`Scheduled: ${todo.scheduledDate}`);
  }

  if (todo.dueDate) {
    meta.push(`Due: ${todo.dueDate}`);
  }

  if (todo.recurrence) {
    meta.push(`Recurrence: ${formatRecurrence(todo.recurrence)}`);
  }

  meta.push(`Created: ${new Date(todo.createdAt).toLocaleString()}`);
  meta.push(`Updated: ${new Date(todo.updatedAt).toLocaleString()}`);

  return `
${header}

${meta.join('\n')}

${todo.description}
  `.trim();
}

export function formatTodoList(todos: Todo[]): string {
  if (todos.length === 0) {
    return "No todos found.";
  }

  const todoItems = todos.map(formatTodo).join('\n\n---\n\n');
  return `# Todo List (${todos.length} items)\n\n${todoItems}`;
}

export function formatTasksForDate(date: string, today: Todo[], overdue: Todo[]): string {
  const sections: string[] = [`# Tasks for ${date}`];

  if (today.length > 0) {
    sections.push(`\n## Today's Tasks (${today.length})\n`);
    sections.push(today.map(t => formatTodo(t)).join('\n\n---\n\n'));
  }

  if (overdue.length > 0) {
    sections.push(`\n## Overdue (${overdue.length})\n`);
    sections.push(overdue.map(t => formatTodo(t)).join('\n\n---\n\n'));
  }

  if (today.length === 0 && overdue.length === 0) {
    sections.push('\nNo tasks for this date.');
  }

  return sections.join('\n');
}

export function createSuccessResponse(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}

export function createErrorResponse(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    isError: true,
  };
}
