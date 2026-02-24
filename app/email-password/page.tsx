export default function EmailPasswordPage() {
  return (
    <div className="rounded-3xl border border-[var(--ns-border)] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="text-xl font-semibold tracking-tight">Sign in</div>
      <div className="mt-1 text-sm text-black/60">
        Use your NetworkSpace account to continue.
      </div>

      <div className="mt-6 space-y-3">
        <input
          className="w-full rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ns-olive)]/50"
          placeholder="Email"
        />
        <input
          type="password"
          className="w-full rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ns-olive)]/50"
          placeholder="Password"
        />

        <button className="w-full rounded-2xl bg-[var(--ns-charcoal)] px-4 py-3 text-sm font-medium text-white">
          Sign in
        </button>
      </div>

      <div className="mt-4 text-xs text-black/50">
        If you don’t have access, contact your manager.
      </div>
    </div>
  );
}