import OpenAI from 'openai';
import { SYSTEM_PROMPT, TOOLS } from './prompts';
import * as agentTools from './tools';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ── Provider configuration ────────────────────────────────────────────────────
//
// Supports 3 providers (set AGENT_PROVIDER in .env):
//   "groq"   — FREE, fast, Llama 3.1. Get key at https://console.groq.com
//   "openai" — Paid. Get key at https://platform.openai.com
//   "ollama" — 100% FREE, local. Install from https://ollama.com
//

type Provider = 'groq' | 'openai' | 'ollama';

function getProvider(): Provider {
  const p = (process.env.AGENT_PROVIDER || 'groq').toLowerCase() as Provider;
  if (!['groq', 'openai', 'ollama'].includes(p)) {
    throw { status: 500, message: `Invalid AGENT_PROVIDER: "${p}". Use groq, openai, or ollama.` };
  }
  return p;
}

function getClient(provider: Provider): OpenAI {
  switch (provider) {
    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw { status: 500, message: 'GROQ_API_KEY not configured. Get a free key at https://console.groq.com' };
      return new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw { status: 500, message: 'OPENAI_API_KEY not configured' };
      return new OpenAI({ apiKey });
    }
    case 'ollama': {
      return new OpenAI({
        apiKey: 'ollama', // Ollama doesn't need a real key
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      });
    }
  }
}

function getModel(provider: Provider): string {
  switch (provider) {
    case 'groq':    return process.env.GROQ_MODEL    || 'llama-3.3-70b-versatile';
    case 'openai':  return process.env.OPENAI_MODEL  || 'gpt-4o-mini';
    case 'ollama':  return process.env.OLLAMA_MODEL  || 'llama3.1';
  }
}

// ── Tool executor map ─────────────────────────────────────────────────────────

const TOOL_MAP: Record<string, (args: any) => Promise<object>> = {
  list_users: agentTools.listUsers,
  get_user_permissions: agentTools.getUserPermissions,
  query_audit_logs: agentTools.queryAuditLogs,
  get_role_summary: agentTools.getRoleSummary,
  get_permission_stats: agentTools.getPermissionStats,
  get_security_summary: agentTools.getSecuritySummary,
};

// ── Run agent ─────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 10;

export interface AgentResponse {
  answer: string;
  toolCalls: { name: string; args: any; result: any }[];
  provider: string;
  model: string;
}

export async function runAgent(userMessage: string): Promise<AgentResponse> {
  const provider = getProvider();
  const client = getClient(provider);
  const model = getModel(provider);
  const toolCallsLog: { name: string; args: any; result: any }[] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS as ChatCompletionTool[],
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 2048,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw { status: 500, message: 'No response from AI provider' };
    }

    const assistantMessage = choice.message;

    // If no tool calls, we have the final answer
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        answer: assistantMessage.content || 'No response generated.',
        toolCalls: toolCallsLog,
        provider,
        model,
      };
    }

    // Execute tool calls
    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const fn = (toolCall as any).function;
      const { name, arguments: argsStr } = fn;
      let args: any;
      try {
        args = JSON.parse(argsStr);
      } catch {
        args = {};
      }

      const executor = TOOL_MAP[name];
      let result: any;

      if (executor) {
        try {
          result = await executor(args);
        } catch (err: any) {
          result = { error: err.message || 'Tool execution failed' };
        }
      } else {
        result = { error: `Unknown tool: ${name}` };
      }

      toolCallsLog.push({ name, args, result });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    answer: 'I needed too many steps to answer this. Try a more specific question.',
    toolCalls: toolCallsLog,
    provider,
    model,
  };
}
