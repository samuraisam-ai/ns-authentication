export default function GoogleLoginPage() {
  return (
    <div className="rounded-3xl border border-[var(--ns-border)] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="text-xl font-semibold tracking-tight">Sign in</div>
      <div className="mt-1 text-sm text-black/60">
        Continue with Google to access the system.
      </div>

      <button className="mt-6 w-full rounded-2xl bg-[var(--ns-charcoal)] px-4 py-3 text-sm font-medium text-white">
        Continue with Google
      </button>

      <div className="mt-4 text-xs text-black/50">
        Use your work Google account.
      </div>
    </div>
  );
}