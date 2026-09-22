import { signOut } from "@/auth";

// Top nav. Plain anchors, no client JS. Add a page by dropping
// app/<route>/page.tsx and a row here; middleware.ts protects it automatically.
export const LINKS: { label: string; href: string }[] = [
  { label: "Inspector", href: "/" },
];

export default function AdminNav({ adminEmail }: { adminEmail?: string }) {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">confidence-picks admin</span>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </div>
        {adminEmail && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
            className="flex items-center gap-3"
          >
            <span className="text-xs text-slate-500">{adminEmail}</span>
            <button type="submit" className="text-xs text-slate-600 underline hover:text-slate-900">
              Sign out
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
