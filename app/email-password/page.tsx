import Link from "next/link";

type AuthDemoPageProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function AuthDemoPage({ title, description, children }: AuthDemoPageProps) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          ← Back to Home
        </Link>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm text-white/70">{description}</p>
          ) : null}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
