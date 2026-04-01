"use client";

import { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { sendMessageThunk, clearChat, type ToolCall } from "@/redux/slices/agentSlice";

// ── Tool call expandable card ─────────────────────────────────────────────────

function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);

  const toolLabels: Record<string, string> = {
    list_users: "List Users",
    get_user_permissions: "User Permissions",
    query_audit_logs: "Audit Logs",
    get_role_summary: "Role Summary",
    get_permission_stats: "Permission Stats",
    get_security_summary: "Security Summary",
  };

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
      >
        <span className="flex items-center gap-2">
          <span className="inline-block rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
            TOOL
          </span>
          <span className="font-medium text-zinc-700">
            {toolLabels[call.name] || call.name}
          </span>
        </span>
        <svg
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-200 px-3 py-2">
          <div className="mb-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Arguments
            </div>
            <pre className="mt-1 max-h-24 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-zinc-600">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Result
            </div>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-zinc-600">
              {JSON.stringify(call.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What roles exist and what permissions does each have?",
  "Show me failed login attempts in the last 24 hours",
  "Who has permission to manage users?",
  "Are there any locked accounts right now?",
  "Show me the security summary",
  "How many users are in each role?",
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const dispatch = useAppDispatch();
  const { messages, loading } = useAppSelector((s) => s.agent);
  const user = useAppSelector((s) => s.auth.user);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    dispatch(sendMessageThunk(msg));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Non-admin warning
  if (user?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">AI Agent</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Admin assistant for querying your RBAC system.
        </p>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="text-lg font-medium text-zinc-800">Admin Access Required</div>
          <p className="mt-2 text-sm text-zinc-500">
            Only administrators can use the AI agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Agent</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Ask questions about your users, permissions, and security in natural language.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => dispatch(clearChat())}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-auto rounded-2xl border border-zinc-200 bg-white">
        {messages.length === 0 ? (
          // Empty state with suggestions
          <div className="flex h-full flex-col items-center justify-center px-6">
            <div className="mb-4 rounded-full bg-zinc-100 p-3">
              <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-800">
              RBAC Admin Assistant
            </h3>
            <p className="mt-1 max-w-md text-center text-sm text-zinc-500">
              I can query your users, permissions, roles, and audit logs. Try one of these:
            </p>
            <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages
          <div className="space-y-4 p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-800"
                  }`}
                >
                  {/* Message content */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Tool calls (assistant only) */}
                  {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div>
                      {msg.toolCalls.map((call, i) => (
                        <ToolCallCard key={i} call={call} />
                      ))}
                    </div>
                  )}

                  {/* Provider badge (assistant only) */}
                  {msg.role === "assistant" && msg.provider && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-block rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        {msg.provider}/{msg.model}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-zinc-100 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your users, permissions, or security..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          Admin only. Read-only access — the agent can query but not modify data.
        </p>
      </div>
    </div>
  );
}
