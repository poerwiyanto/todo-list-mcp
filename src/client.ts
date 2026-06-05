/**
 * client.ts
 * 
 * Test client for the Todo MCP server.
 * Demonstrates connecting, calling tools, and handling responses.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface ContentText {
  type: "text";
  text: string;
}

async function main() {
  console.log("Starting Todo MCP Test Client...");

  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
    });

    const client = new Client(
      { name: "todo-test-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    console.log("Connected to Todo MCP Server");

    const toolsResult = await client.listTools();
    console.log("\nAvailable tools:", toolsResult.tools.map(tool => tool.name));

    // Create a one-shot task with scheduling
    console.log("\n--- Creating a scheduled task ---");
    const createResult = await client.callTool({
      name: "create-todo",
      arguments: {
        title: "Review PR #42",
        description: "Review the frontend dashboard PR",
        scheduledDate: "2026-06-10",
        dueDate: "2026-06-12",
      }
    });
    const createContent = createResult.content as ContentText[];
    console.log(createContent[0].text);

    const idMatch = createContent[0].text.match(/ID: ([0-9a-f-]+)/);
    const todoId = idMatch ? idMatch[1] : null;

    // Create a recurring task
    console.log("\n--- Creating a recurring task ---");
    const recurringResult = await client.callTool({
      name: "create-todo",
      arguments: {
        title: "Water plants",
        description: "Water all indoor plants",
        recurrence: {
          frequency: "daily",
          interval: 1,
          startDate: "2026-06-01",
        },
      }
    });
    const recurringContent = recurringResult.content as ContentText[];
    console.log(recurringContent[0].text);

    // Get tasks for a specific date
    console.log("\n--- Getting tasks for 2026-06-10 ---");
    const dateResult = await client.callTool({
      name: "get-tasks-for-date",
      arguments: { date: "2026-06-10" }
    });
    const dateContent = dateResult.content as ContentText[];
    console.log(dateContent[0].text);

    // Complete a recurring task for a specific date
    console.log("\n--- Completing recurring task for today ---");
    const recurringIdMatch = recurringContent[0].text.match(/ID: ([0-9a-f-]+)/);
    if (recurringIdMatch) {
      const completeResult = await client.callTool({
        name: "complete-todo",
        arguments: {
          id: recurringIdMatch[1],
          date: "2026-06-10",
        }
      });
      const completeContent = completeResult.content as ContentText[];
      console.log(completeContent[0].text);
    }

    // Complete the one-shot task
    if (todoId) {
      console.log("\n--- Completing one-shot task ---");
      const completeResult = await client.callTool({
        name: "complete-todo",
        arguments: { id: todoId }
      });
      const completeContent = completeResult.content as ContentText[];
      console.log(completeContent[0].text);

      // Delete it
      console.log("\n--- Deleting task ---");
      const deleteResult = await client.callTool({
        name: "delete-todo",
        arguments: { id: todoId }
      });
      const deleteContent = deleteResult.content as ContentText[];
      console.log(deleteContent[0].text);
    }

    // List active todos
    console.log("\n--- Active todos ---");
    const listResult = await client.callTool({
      name: "list-active-todos",
      arguments: {}
    });
    const listContent = listResult.content as ContentText[];
    console.log(listContent[0].text);

    await client.close();
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error in test client:", error);
    process.exit(1);
  }
}

main();
