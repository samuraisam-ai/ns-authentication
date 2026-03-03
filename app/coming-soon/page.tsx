export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] text-center">
        <h1 className="text-3xl font-semibold text-black">Coming soon</h1>
        <p className="mt-3 text-black/60">
          This feature isn’t ready yet. Please check back soon.
        </p>
        <a
          href="/"
          className="mt-8 inline-block text-black/70 hover:text-black underline underline-offset-4"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
