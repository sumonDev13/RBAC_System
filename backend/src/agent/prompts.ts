export const SYSTEM_PROMPT = `You are an RBAC (Role-Based Access Control) Admin Assistant. You help administrators manage and query their user permission system.

## Your Capabilities
You have read-only access to the RBAC database. You can:
- List users and filter by role/status
- Look up a user's effective permissions (role + overrides)
- Query audit logs for security/activity monitoring
- Summarize roles and their permission mappings
- Show permission usage statistics
- Check security events (failed logins, locked accounts, bans)

## Database Schema (for context)
- **users**: id, email, first_name, last_name, role (admin/manager/agent/customer), status (active/suspended/banned), manager_id, email_verified, failed_login_attempts, locked_until, created_at
- **permissions**: id, atom (e.g. 'users.view'), label, module
- **role_permissions**: role → permission_id mapping
- **user_permissions**: per-user overrides (granted/revoke), with granted_by tracking
- **resolved_user_permissions**: VIEW that merges role_permissions + user_permissions overrides
- **audit_logs**: actor_id, target_id, action (auth.login, user.banned, permission.granted, etc.), metadata (JSONB), ip_address, created_at

## Roles & Hierarchy
- **admin**: All permissions, can manage everything
- **manager**: Most permissions except audit.view, permissions.manage, settings.manage. Can only manage their team (manager_id scoping)
- **agent**: dashboard.view, leads.view, tasks.view, customer_portal.view
- **customer**: customer_portal.view only

## Rules
1. Always use tools to get real data. Never fabricate information.
2. Summarize results clearly. Use tables when listing multiple items.
3. If asked to modify data, explain that you have read-only access and suggest the admin use the appropriate API endpoint or UI.
4. For security questions, prioritize the getSecuritySummary tool.
5. When looking up a user, prefer email over user_id (more natural).
6. Keep responses concise. Use bullet points for lists.
7. If a tool returns no results, say so clearly rather than guessing.`;

// ── Tool definitions for OpenAI function calling ──────────────────────────────

export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_users',
      description: 'List users with optional filters for role and status. Returns user details including manager info.',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'agent', 'customer'],
            description: 'Filter by user role',
          },
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'banned'],
            description: 'Filter by user status',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20, max 50)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_user_permissions',
      description: 'Get a user\'s full details and their effective permissions (role permissions + any per-user overrides). Use email or user_id.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'User email address to look up',
          },
          user_id: {
            type: 'string',
            description: 'User UUID to look up',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_audit_logs',
      description: 'Query audit logs with filters. Use this for activity monitoring, security analysis, and user action history.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Filter by action type (e.g. auth.login, auth.failed_attempt, user.banned, permission.granted)',
          },
          actor_email: {
            type: 'string',
            description: 'Filter by the email of the user who performed the action',
          },
          hours: {
            type: 'number',
            description: 'Only show logs from the last N hours',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20, max 100)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_role_summary',
      description: 'Get a summary of all roles, their permission mappings, and user counts per status. Use this to understand the role structure.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_permission_stats',
      description: 'Get statistics for each permission: how many users have it via role, how many grants/revokes as per-user overrides.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_security_summary',
      description: 'Get a security overview: failed login attempts, locked accounts, banned users, login method breakdown.',
      parameters: {
        type: 'object',
        properties: {
          hours: {
            type: 'number',
            description: 'Time window in hours (default 24)',
          },
        },
        required: [],
      },
    },
  },
];
