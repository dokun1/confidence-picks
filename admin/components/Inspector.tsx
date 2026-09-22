"use client";

import { useActionState, useState } from "react";
import { runTool, type RunResult } from "@/app/actions";
import { NULL_MARKER, type FieldSpec } from "@/lib/argsFromForm";

export interface ToolView {
  name: string;
  description: string;
  readOnly: boolean;
  destructive: boolean;
  fields: FieldSpec[];
}

// Client side of the inspector. The token is React state + a form field only:
// never localStorage, never a cookie, gone on reload.
export default function Inspector({ tools }: { tools: ToolView[] }) {
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState(tools[0]?.name ?? "");
  const [armed, setArmed] = useState(false);
  const [result, formAction, pending] = useActionState<RunResult | null, FormData>(runTool, null);
  const tool = tools.find((t) => t.name === selected);

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">MCP token</span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="cp_live_…"
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
          <span className="text-xs text-slate-500">Held in memory only. Mint one under Profile → AI client access.</span>
        </label>

        <nav className="flex flex-col gap-1">
          {tools.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => { setSelected(t.name); setArmed(false); }}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                t.name === selected ? "bg-slate-900 text-white" : "hover:bg-slate-100"
              }`}
            >
              <code>{t.name}</code>
              <Badge readOnly={t.readOnly} destructive={t.destructive} inverted={t.name === selected} />
            </button>
          ))}
        </nav>
      </aside>

      {tool && (
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <code>{tool.name}</code>
              <Badge readOnly={tool.readOnly} destructive={tool.destructive} />
            </h2>
            <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
          </div>

          <form
            action={formAction}
            onSubmit={(e) => {
              // Writes get one deliberate second click. A production ledger is
              // on the other end of this form.
              if (!tool.readOnly && !armed) {
                e.preventDefault();
                setArmed(true);
              }
            }}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <input type="hidden" name="__tool" value={tool.name} />
            <input type="hidden" name="__token" value={token} />

            {tool.fields.length === 0 && <p className="text-sm text-slate-500">This tool takes no arguments.</p>}
            {tool.fields.map((f) => (
              <Field key={`${tool.name}.${f.name}`} spec={f} />
            ))}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || !token}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  tool.readOnly ? "bg-slate-900 hover:bg-slate-800" : armed ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {pending ? "Running…" : tool.readOnly ? "Run" : armed ? "Confirm: write to production" : "Run (writes)"}
              </button>
              {armed && !pending && (
                <button type="button" onClick={() => setArmed(false)} className="text-sm text-slate-600 underline">
                  Cancel
                </button>
              )}
              {!token && <span className="text-xs text-slate-500">Paste a token to enable.</span>}
            </div>
          </form>

          {result && result.tool === tool.name && <ResultPanel result={result} />}
        </section>
      )}
    </div>
  );
}

function Badge({ readOnly, destructive, inverted = false }: { readOnly: boolean; destructive: boolean; inverted?: boolean }) {
  const label = readOnly ? "read-only" : destructive ? "writes · overwrites" : "writes";
  const tone = readOnly
    ? inverted ? "bg-slate-700 text-slate-100" : "bg-slate-100 text-slate-700"
    : inverted ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-900";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>{label}</span>;
}

function Field({ spec }: { spec: FieldSpec }) {
  const label = (
    <span className="flex items-baseline gap-2">
      <code className="text-sm font-medium">{spec.name}</code>
      {spec.required && <span className="text-[10px] uppercase text-red-700">required</span>}
      {!spec.required && <span className="text-[10px] uppercase text-slate-400">optional · blank = not sent</span>}
    </span>
  );
  const cls = "rounded-md border border-slate-300 px-3 py-2 text-sm font-mono";

  let control;
  if (spec.kind === "boolean") {
    control = (
      <select name={spec.name} defaultValue="" className={cls}>
        <option value="">(not sent)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  } else if (spec.enum) {
    control = (
      <select name={spec.name} defaultValue="" className={cls}>
        <option value="">(not sent)</option>
        {spec.enum.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  } else if (spec.kind === "json") {
    control = <textarea name={spec.name} rows={3} placeholder="JSON, e.g. [1, 2]" className={cls} />;
  } else {
    control = (
      <input
        name={spec.name}
        type={spec.kind === "number" ? "text" : "text"}
        inputMode={spec.kind === "number" ? "decimal" : undefined}
        placeholder={spec.nullable ? `value, or ${NULL_MARKER} to clear` : undefined}
        className={cls}
      />
    );
  }

  return (
    <label className="flex flex-col gap-1">
      {label}
      {control}
      {spec.description && <span className="text-xs text-slate-500">{spec.description}</span>}
    </label>
  );
}

function ResultPanel({ result }: { result: RunResult }) {
  const failed = result.errors.length > 0;
  return (
    <div className={`rounded-xl border p-5 ${failed || result.isError ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">
          {failed ? "Not sent" : result.isError ? "Tool returned an error" : "OK"}
          {!failed && <span className="ml-2 text-slate-500">{result.elapsedMs} ms</span>}
        </span>
      </div>
      {failed ? (
        <ul className="list-disc pl-5 text-sm text-red-800">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : (
        <>
          <details className="mb-3 text-xs text-slate-600">
            <summary className="cursor-pointer">arguments sent</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-white p-3">{JSON.stringify(result.args, null, 2)}</pre>
          </details>
          <pre className="overflow-x-auto rounded bg-white p-3 text-xs">{result.text}</pre>
        </>
      )}
    </div>
  );
}
