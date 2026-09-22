"use client";

import { useActionState, useState } from "react";
import { getPrompt, readResource, runTool, type PromptResult, type ResourceResult, type RunResult } from "@/app/actions";
import { NULL_MARKER, type FieldSpec } from "@/lib/argsFromForm";

export interface ToolView {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  destructive: boolean;
  fields: FieldSpec[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
}
export interface ResourceView { uri: string; name: string; title?: string; description?: string; mimeType?: string }
export interface PromptView { name: string; title?: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }

type Tab = "tools" | "resources" | "prompts";

// Client side of the inspector. The token is React state + a form field only:
// never localStorage, never a cookie, gone on reload.
export default function Inspector({ instructions, tools, resources, prompts }: {
  instructions: string; tools: ToolView[]; resources: ResourceView[]; prompts: PromptView[];
}) {
  const [tab, setTab] = useState<Tab>("tools");
  const [token, setToken] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <button type="button" onClick={() => setShowInstructions((v) => !v)} className="flex w-full items-center justify-between text-left">
          <span className="text-sm font-semibold">Server instructions <span className="ml-2 font-normal text-slate-500">sent to every client at connect</span></span>
          <span className="text-xs text-slate-500">{showInstructions ? "hide" : "show"}</span>
        </button>
        {showInstructions && <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">{instructions}</pre>}
      </section>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {(["tools", "resources", "prompts"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize ${tab === t ? "border-slate-900 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t} <span className="ml-1 text-xs text-slate-400">{t === "tools" ? tools.length : t === "resources" ? resources.length : prompts.length}</span>
          </button>
        ))}
      </div>

      {tab === "tools" && <ToolsTab tools={tools} token={token} setToken={setToken} />}
      {tab === "resources" && <ResourcesTab resources={resources} />}
      {tab === "prompts" && <PromptsTab prompts={prompts} />}
    </div>
  );
}

function ToolsTab({ tools, token, setToken }: { tools: ToolView[]; token: string; setToken: (t: string) => void }) {
  const [selected, setSelected] = useState(tools[0]?.name ?? "");
  const [armed, setArmed] = useState(false);
  const [showSchema, setShowSchema] = useState<"none" | "input" | "output">("none");
  const [result, formAction, pending] = useActionState<RunResult | null, FormData>(runTool, null);
  const tool = tools.find((t) => t.name === selected);

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">MCP token</span>
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cp_live_…"
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" />
          <span className="text-xs text-slate-500">Held in memory only. Mint one under Profile → AI client access.</span>
        </label>
        <nav className="flex flex-col gap-1">
          {tools.map((t) => (
            <button key={t.name} type="button" onClick={() => { setSelected(t.name); setArmed(false); setShowSchema("none"); }}
              className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${t.name === selected ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
              <span className="flex flex-col"><span>{t.title}</span><code className={`text-[11px] ${t.name === selected ? "text-slate-300" : "text-slate-500"}`}>{t.name}</code></span>
              <Badge readOnly={t.readOnly} destructive={t.destructive} inverted={t.name === selected} />
            </button>
          ))}
        </nav>
      </aside>

      {tool && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {tool.title} <code className="text-sm font-normal text-slate-500">{tool.name}</code>
              <Badge readOnly={tool.readOnly} destructive={tool.destructive} />
            </h2>
            <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" className="underline" onClick={() => setShowSchema(showSchema === "input" ? "none" : "input")}>input schema</button>
              {tool.outputSchema && <button type="button" className="underline" onClick={() => setShowSchema(showSchema === "output" ? "none" : "output")}>output schema</button>}
            </div>
            {showSchema !== "none" && (
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(showSchema === "input" ? tool.inputSchema : tool.outputSchema, null, 2)}</pre>
            )}
          </div>

          <form action={formAction}
            onSubmit={(e) => { if (!tool.readOnly && !armed) { e.preventDefault(); setArmed(true); } }}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <input type="hidden" name="__tool" value={tool.name} />
            <input type="hidden" name="__token" value={token} />
            {tool.fields.length === 0 && <p className="text-sm text-slate-500">This tool takes no arguments.</p>}
            {tool.fields.map((f) => <Field key={`${tool.name}.${f.name}`} spec={f} />)}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending || !token}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${tool.readOnly ? "bg-slate-900 hover:bg-slate-800" : armed ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                {pending ? "Running…" : tool.readOnly ? "Run" : armed ? "Confirm: write to production" : "Run (writes)"}
              </button>
              {armed && !pending && <button type="button" onClick={() => setArmed(false)} className="text-sm text-slate-600 underline">Cancel</button>}
              {!token && <span className="text-xs text-slate-500">Paste a token to enable.</span>}
            </div>
          </form>

          {result && result.tool === tool.name && <ResultPanel result={result} />}
        </section>
      )}
    </div>
  );
}

function ResourcesTab({ resources }: { resources: ResourceView[] }) {
  const [result, formAction, pending] = useActionState<ResourceResult | null, FormData>(readResource, null);
  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <nav className="flex flex-col gap-2">
        {resources.map((r) => (
          <form key={r.uri} action={formAction}>
            <input type="hidden" name="__uri" value={r.uri} />
            <button type="submit" disabled={pending}
              className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 ${result?.uri === r.uri ? "bg-slate-900 text-white hover:bg-slate-900" : ""}`}>
              <span className="block">{r.title ?? r.name}</span>
              <code className={`text-[11px] ${result?.uri === r.uri ? "text-slate-300" : "text-slate-500"}`}>{r.uri}</code>
              {r.description && <span className={`mt-1 block text-xs ${result?.uri === r.uri ? "text-slate-300" : "text-slate-500"}`}>{r.description}</span>}
            </button>
          </form>
        ))}
      </nav>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        {!result && <p className="text-sm text-slate-500">Pick a resource to read it over <code>resources/read</code>.</p>}
        {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
        {result && !result.error && (
          <>
            <div className="mb-3 text-xs text-slate-500">{result.uri} · {result.mimeType}</div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{result.text}</pre>
          </>
        )}
      </section>
    </div>
  );
}

function PromptsTab({ prompts }: { prompts: PromptView[] }) {
  const [selected, setSelected] = useState(prompts[0]?.name ?? "");
  const [result, formAction, pending] = useActionState<PromptResult | null, FormData>(getPrompt, null);
  const prompt = prompts.find((p) => p.name === selected);
  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <nav className="flex flex-col gap-1">
        {prompts.map((p) => (
          <button key={p.name} type="button" onClick={() => setSelected(p.name)}
            className={`rounded-md px-3 py-2 text-left text-sm ${p.name === selected ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
            <span className="block">{p.title ?? p.name}</span>
            <code className={`text-[11px] ${p.name === selected ? "text-slate-300" : "text-slate-500"}`}>/{p.name}</code>
          </button>
        ))}
      </nav>
      {prompt && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">{prompt.title ?? prompt.name} <code className="text-sm font-normal text-slate-500">{prompt.name}</code></h2>
            {prompt.description && <p className="mt-1 text-sm text-slate-600">{prompt.description}</p>}
          </div>
          <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <input type="hidden" name="__prompt" value={prompt.name} />
            {(prompt.arguments ?? []).map((a) => (
              <label key={`${prompt.name}.${a.name}`} className="flex flex-col gap-1">
                <span className="flex items-baseline gap-2"><code className="text-sm font-medium">{a.name}</code>
                  {a.required ? <span className="text-[10px] uppercase text-red-700">required</span> : <span className="text-[10px] uppercase text-slate-400">optional</span>}</span>
                <input name={a.name} className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" />
                {a.description && <span className="text-xs text-slate-500">{a.description}</span>}
              </label>
            ))}
            <div><button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{pending ? "Rendering…" : "Render prompt"}</button></div>
          </form>
          {result && result.name === prompt.name && (
            <div className={`rounded-xl border p-5 ${result.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
              {result.error ? <p className="text-sm text-red-800">{result.error}</p> : result.messages.map((m, i) => (
                <div key={i}><div className="mb-1 text-xs uppercase text-slate-500">{m.role}</div><pre className="whitespace-pre-wrap rounded bg-white p-3 text-sm leading-relaxed">{m.text}</pre></div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Badge({ readOnly, destructive, inverted = false }: { readOnly: boolean; destructive: boolean; inverted?: boolean }) {
  const label = readOnly ? "read-only" : destructive ? "writes · overwrites" : "writes";
  const tone = readOnly ? (inverted ? "bg-slate-700 text-slate-100" : "bg-slate-100 text-slate-700") : inverted ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-900";
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>{label}</span>;
}

function Field({ spec }: { spec: FieldSpec }) {
  const cls = "rounded-md border border-slate-300 px-3 py-2 text-sm font-mono";
  let control;
  if (spec.kind === "boolean") {
    control = <select name={spec.name} defaultValue="" className={cls}><option value="">(not sent)</option><option value="true">true</option><option value="false">false</option></select>;
  } else if (spec.enum) {
    control = <select name={spec.name} defaultValue="" className={cls}><option value="">(not sent)</option>{spec.enum.map((v) => <option key={v} value={v}>{v}</option>)}</select>;
  } else if (spec.kind === "json") {
    control = <textarea name={spec.name} rows={3} placeholder="JSON, e.g. [1, 2]" className={cls} />;
  } else {
    control = <input name={spec.name} type="text" inputMode={spec.kind === "number" ? "decimal" : undefined} placeholder={spec.nullable ? `value, or ${NULL_MARKER} to clear` : undefined} className={cls} />;
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <code className="text-sm font-medium">{spec.name}</code>
        {spec.required ? <span className="text-[10px] uppercase text-red-700">required</span> : <span className="text-[10px] uppercase text-slate-400">optional · blank = not sent</span>}
      </span>
      {control}
      {spec.description && <span className="text-xs text-slate-500">{spec.description}</span>}
    </label>
  );
}

function ResultPanel({ result }: { result: RunResult }) {
  const failed = result.errors.length > 0;
  const [view, setView] = useState<"structured" | "text">("structured");
  return (
    <div className={`rounded-xl border p-5 ${failed || result.isError ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">{failed ? "Not sent" : result.isError ? "Tool returned an error" : "OK"}{!failed && <span className="ml-2 text-slate-500">{result.elapsedMs} ms</span>}</span>
        {!failed && !result.isError && result.structured != null && (
          <span className="flex gap-2 text-xs">
            <button type="button" className={view === "structured" ? "font-semibold" : "underline"} onClick={() => setView("structured")}>structuredContent</button>
            <button type="button" className={view === "text" ? "font-semibold" : "underline"} onClick={() => setView("text")}>content[0].text</button>
          </span>
        )}
      </div>
      {failed ? <ul className="list-disc pl-5 text-sm text-red-800">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul> : (
        <>
          <details className="mb-3 text-xs text-slate-600"><summary className="cursor-pointer">arguments sent</summary><pre className="mt-2 overflow-x-auto rounded bg-white p-3">{JSON.stringify(result.args, null, 2)}</pre></details>
          <pre className="overflow-x-auto rounded bg-white p-3 text-xs">{view === "structured" && result.structured != null ? JSON.stringify(result.structured, null, 2) : result.text}</pre>
        </>
      )}
    </div>
  );
}
