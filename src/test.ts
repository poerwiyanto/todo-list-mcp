import { todoService } from './services/TodoService.js';
import { databaseService } from './services/DatabaseService.js';
import { formatTasksForDate, formatTodoList } from './utils/formatters.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 1: Monday morning — LLM creates tasks for the week
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 1: Monday morning — Create tasks for the week');

const standup = todoService.createTodo({
  title: 'Daily standup',
  description: 'Join the team standup at 9am via Zoom',
  recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-06-08', daysOfWeek: [1, 2, 3, 4, 5] },
});
assert(standup.recurrence !== null, 'Standup created as recurring (weekdays)');

const reviewPR = todoService.createTodo({
  title: 'Review frontend PR #42',
  description: 'Review the new dashboard component PR. Check for accessibility and performance.',
  scheduledDate: '2026-06-09',
  dueDate: '2026-06-11',
});
assert(reviewPR.scheduledDate === '2026-06-09', 'PR review scheduled for Tuesday');
assert(reviewPR.dueDate === '2026-06-11', 'PR review due Thursday');

const gym = todoService.createTodo({
  title: 'Go to the gym',
  description: 'Upper body workout — bench press, rows, shoulder press',
  recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-06-08', daysOfWeek: [1, 3, 5] },
});
assert(gym.recurrence?.daysOfWeek?.length === 3, 'Gym created for Mon/Wed/Fri');

const watering = todoService.createTodo({
  title: 'Water plants',
  description: 'Water all indoor plants in living room and bedroom',
  recurrence: { frequency: 'daily', interval: 1, startDate: '2026-06-01' },
});
assert(watering.recurrence?.frequency === 'daily', 'Watering created as daily');

const report = todoService.createTodo({
  title: 'Submit quarterly report',
  description: 'Q2 performance report to management',
  scheduledDate: '2026-06-05',
  dueDate: '2026-06-07',
});
assert(report.scheduledDate === '2026-06-05', 'Report scheduled for Friday');

const dentist = todoService.createTodo({
  title: 'Dentist appointment',
  description: 'Regular checkup at Dr. Smith — 2pm',
  scheduledDate: '2026-06-12',
});
assert(dentist.scheduledDate === '2026-06-12', 'Dentist scheduled for next Friday');

console.log('\n📋 Created tasks:');
const allTasks = todoService.getAllTodos();
console.log(formatTodoList(allTasks));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 2: Wednesday — LLM retrieves tasks for today
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 2: Wednesday (2026-06-10) — What do I need to do today?');

const wedTasks = todoService.getTasksForDate('2026-06-10');
console.log('\n📋 Tasks for Wednesday:');
console.log(formatTasksForDate('2026-06-10', wedTasks.today, wedTasks.overdue));

// Standup should appear (Wednesday is weekday)
assert(wedTasks.today.some(t => t.id === standup.id), 'Standup appears on Wednesday');
// Gym should NOT appear (not Mon/Wed/Fri — wait, Wed IS one of them)
assert(wedTasks.today.some(t => t.id === gym.id), 'Gym appears on Wednesday (Mon/Wed/Fri)');
// PR review not scheduled today
assert(!wedTasks.today.some(t => t.id === reviewPR.id), 'PR review not in today (scheduled for Tuesday)');
// Report overdue (scheduled June 5, today is June 10)
assert(wedTasks.overdue.some(t => t.id === report.id), 'Report is overdue');
// Dentist not yet
assert(!wedTasks.today.some(t => t.id === dentist.id), 'Dentist not yet');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 3: Complete recurring tasks on specific days
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 3: Complete recurring tasks on specific days');

todoService.completeTodo(standup.id, '2026-06-08'); // Monday
todoService.completeTodo(standup.id, '2026-06-09'); // Tuesday
todoService.completeTodo(standup.id, '2026-06-10'); // Wednesday (today)
assert(todoService.getCompletionForDate(standup.id, '2026-06-08') !== undefined, 'Standup completed Monday');
assert(todoService.getCompletionForDate(standup.id, '2026-06-09') !== undefined, 'Standup completed Tuesday');
assert(todoService.getCompletionForDate(standup.id, '2026-06-10') !== undefined, 'Standup completed Wednesday');

// Complete gym on Monday, skip Wednesday
todoService.completeTodo(gym.id, '2026-06-08');
assert(todoService.getCompletionForDate(gym.id, '2026-06-08') !== undefined, 'Gym completed Monday');
assert(todoService.getCompletionForDate(gym.id, '2026-06-10') === undefined, 'Gym NOT completed Wednesday (skipped)');

// Water plants every day
todoService.completeTodo(watering.id, '2026-06-08');
todoService.completeTodo(watering.id, '2026-06-09');
todoService.completeTodo(watering.id, '2026-06-10');
assert(todoService.getCompletionForDate(watering.id, '2026-06-08') !== undefined, 'Watering completed Monday');
assert(todoService.getCompletionForDate(watering.id, '2026-06-09') !== undefined, 'Watering completed Tuesday');
assert(todoService.getCompletionForDate(watering.id, '2026-06-10') !== undefined, 'Watering completed Wednesday');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 4: Check tasks after completing some
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 4: Wednesday tasks after completions');

const wedAfter = todoService.getTasksForDate('2026-06-10');
console.log('\n📋 Remaining tasks for Wednesday:');
console.log(formatTasksForDate('2026-06-10', wedAfter.today, wedAfter.overdue));

// Standup and watering already completed, should NOT appear in today
assert(!wedAfter.today.some(t => t.id === standup.id), 'Standup gone (completed)');
assert(!wedAfter.today.some(t => t.id === watering.id), 'Watering gone (completed)');
// Gym was only completed Monday, NOT Wednesday — so it still appears
assert(wedAfter.today.some(t => t.id === gym.id), 'Gym still appears (only completed Monday)');
// Report still overdue
assert(wedAfter.overdue.some(t => t.id === report.id), 'Report still overdue');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 5: Thursday — complete the one-shot task
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 5: Thursday (2026-06-11) — Complete PR review');

todoService.completeTodo(reviewPR.id);
const refreshed = todoService.getTodo(reviewPR.id);
assert(refreshed!.completed === true, 'PR review marked as completed');
assert(refreshed!.completedAt !== null, 'PR review has completedAt timestamp');

const thuTasks = todoService.getTasksForDate('2026-06-11');
console.log('\n📋 Thursday tasks:');
console.log(formatTasksForDate('2026-06-11', thuTasks.today, thuTasks.overdue));

// Standup should appear (Thursday is weekday)
assert(thuTasks.today.some(t => t.id === standup.id), 'Standup appears on Thursday');
// PR review completed, should NOT appear
assert(!thuTasks.today.some(t => t.id === reviewPR.id), 'PR review gone (completed)');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 6: Complete-all-recurrences — retire the standup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 6: Retire recurring standup task');

const { backfilledCount } = todoService.completeAllRecurrences(standup.id);
console.log(`\n  Backfilled ${backfilledCount} completions`);
const retiredStandup = todoService.getTodo(standup.id);
const todayStr = new Date().toISOString().slice(0, 10);
assert(retiredStandup!.recurrence!.endDate === todayStr, `Standup endDate set to today (${todayStr})`);
console.log(`  (backfilledCount: ${backfilledCount} — standup starts June 8, today is ${todayStr})`);

// Next Monday should NOT show standup
const nextMonTasks = todoService.getTasksForDate('2026-06-15');
assert(!nextMonTasks.today.some(t => t.id === standup.id), 'Standup gone from next Monday');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 7: Monthly recurring task
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 7: Monthly recurring — Pay rent');

const rent = todoService.createTodo({
  title: 'Pay rent',
  description: 'Transfer $1500 to landlord account',
  recurrence: { frequency: 'monthly', interval: 1, startDate: '2026-06-01', dayOfMonth: 1 },
});
assert(rent.recurrence?.frequency === 'monthly', 'Rent is monthly');

const jun1Rent = todoService.getTasksForDate('2026-06-01');
assert(jun1Rent.today.some((t: any) => t.id === rent.id), 'Rent appears on June 1');
const jun15Tasks = todoService.getTasksForDate('2026-06-15');
assert(!jun15Tasks.today.some((t: any) => t.id === rent.id), 'Rent does NOT appear on June 15');
const jul1Rent = todoService.getTasksForDate('2026-07-01');
assert(jul1Rent.today.some((t: any) => t.id === rent.id), 'Rent appears on July 1');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 8: Biweekly recurring task
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 8: Biweekly recurring — Team lunch');

const lunch = todoService.createTodo({
  title: 'Team lunch',
  description: 'Monthly team lunch at restaurant',
  recurrence: { frequency: 'weekly', interval: 2, startDate: '2026-06-05', daysOfWeek: [5] },
});
assert(lunch.recurrence?.interval === 2, 'Team lunch is biweekly on Fridays');

// June 5 is Friday (week 1) — should appear
const jun5 = todoService.getTasksForDate('2026-06-05');
assert(jun5.today.some(t => t.id === lunch.id), 'Team lunch appears June 5 (week 1)');

// June 12 is Friday (week 2) — should NOT appear (biweekly)
const jun12 = todoService.getTasksForDate('2026-06-12');
assert(!jun12.today.some(t => t.id === lunch.id), 'Team lunch skipped June 12 (week 2)');

// June 19 is Friday (week 3) — should appear
const jun19 = todoService.getTasksForDate('2026-06-19');
assert(jun19.today.some(t => t.id === lunch.id), 'Team lunch appears June 19 (week 3)');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 9: Update a one-shot task's schedule
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 9: Reschedule dentist appointment');

const updatedDentist = todoService.updateTodo({
  id: dentist.id,
  scheduledDate: '2026-06-19',
});
assert(updatedDentist!.scheduledDate === '2026-06-19', 'Dentist rescheduled to June 19');

// June 12 no longer has dentist
const jun12NoDentist = todoService.getTasksForDate('2026-06-12');
assert(!jun12NoDentist.today.some(t => t.id === dentist.id), 'Dentist gone from June 12');

// June 19 now has dentist
const jun19WithDentist = todoService.getTasksForDate('2026-06-19');
assert(jun19WithDentist.today.some(t => t.id === dentist.id), 'Dentist appears on June 19');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 10: Search by scheduled date
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 10: Search tasks by scheduled date');

const jun9Search = todoService.searchByDate('2026-06-09');
console.log('\n  Tasks with scheduledDate 2026-06-09:');
jun9Search.forEach(t => console.log(`    - ${t.title}`));
assert(jun9Search.length >= 1, `At least one task scheduled for June 9 (found ${jun9Search.length})`);
assert(jun9Search.some(t => t.id === reviewPR.id), 'The PR review is among them');

const jun1Search = todoService.searchByDate('2026-06-01');
console.log(`\n  Tasks with scheduledDate 2026-06-01: ${jun1Search.length}`);
jun1Search.forEach(t => console.log(`    - ${t.title}`));
assert(jun1Search.length === 0, 'No tasks with scheduledDate June 1 (only recurring startDate)');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCENARIO 11: Delete a task and its completions cascade
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section('SCENARIO 11: Delete recurring task cascades completions');

const tempTask = todoService.createTodo({
  title: 'Temporary task',
  description: 'This will be deleted',
  recurrence: { frequency: 'daily', interval: 1, startDate: '2026-06-01' },
});
todoService.completeTodo(tempTask.id, '2026-06-08');
todoService.completeTodo(tempTask.id, '2026-06-09');
assert(todoService.getCompletionForDate(tempTask.id, '2026-06-08') !== undefined, 'Completion exists before delete');
assert(todoService.getCompletionForDate(tempTask.id, '2026-06-09') !== undefined, 'Completion exists before delete');

const db = databaseService.getDb();
const beforeCount = db.prepare('SELECT COUNT(*) as c FROM todo_completions WHERE todoId = ?').get(tempTask.id) as any;
assert(beforeCount.c === 2, '2 completion records before delete');

todoService.deleteTodo(tempTask.id);
assert(todoService.getTodo(tempTask.id) === undefined, 'Task deleted');
const afterCount = db.prepare('SELECT COUNT(*) as c FROM todo_completions WHERE todoId = ?').get(tempTask.id) as any;
assert(afterCount.c === 0, 'Completion records cascade-deleted');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESULTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);

databaseService.close();
process.exit(failed > 0 ? 1 : 0);
