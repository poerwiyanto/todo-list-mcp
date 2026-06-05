# Platform Setup

How to register the todo-list MCP server with different agent platforms.

## Prerequisites

- Node.js 20 installed (`fnm use v20.20.2` or `nvm use 20`)
- The MCP server built: `npm run build` from the repo root

## OpenCode

Add to `opencode.json` under `"mcp"`:

```json
{
  "mcp": {
    "todo": {
      "type": "local",
      "command": ["node", "/path/to/todo-list-mcp/dist/index.js"]
    }
  }
}
```

## nanobot

Add to `config.yaml` under `mcp:`:

```yaml
mcp:
  todo:
    command: node
    args: ["/path/to/todo-list-mcp/dist/index.js"]
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todo": {
      "command": "node",
      "args": ["/path/to/todo-list-mcp/dist/index.js"]
    }
  }
}
```

## Claude Code

Add to `.claude/settings.json` or run:

```bash
claude mcp add todo node /path/to/todo-list-mcp/dist/index.js
```

## Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "todo": {
      "command": "node",
      "args": ["/path/to/todo-list-mcp/dist/index.js"]
    }
  }
}
```

## Generic (any MCP-compatible client)

The server communicates via stdio. Launch with:

```bash
node /path/to/todo-list-mcp/dist/index.js
```

The client sends JSON-RPC messages over stdin and reads responses from stdout.

## Troubleshooting

- **Build errors**: Ensure Node 20 is active. `better-sqlite3` won't compile on Node 24 with Xcode Command Line Tools.
- **Database location**: Default is `~/.todo-list-mcp/todos.sqlite`. Override with `TODO_DB_FOLDER` or `TODO_DB_FILE` environment variables.
- **Permission denied**: Check that the Node process can read/write to the database folder.
