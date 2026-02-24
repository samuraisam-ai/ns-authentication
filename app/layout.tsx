"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/tasks", label: "Tasks" },
  { href: "/inbox", label: "Inbox" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Treat auth pages as "public"
  const isAuthPage = useMemo(() => {
    if (!pathname) return false;
    return pathname.startsWith("/email-password") || pathname.startsWith("/google-login");
  }, [pathname]);

  const pageTitle = useMemo(() => {
    if (!pathname) return "NetworkSpace";
    if (pathname.startsWith("/workspace")) return "Workspace";
    if (pathname.startsWith("/tasks")) return "Tasks";
    if (pathname.startsWith("/inbox")) return "Inbox";
    if (pathname.startsWith("/checkins")) return "Check-in";
    return "NetworkSpace";
  }, [pathname]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-[var(--ns-bg)] text-[var(--ns-text)]">
        {isAuthPage ? (
          <div className="min-h-dvh flex items-center justify-center p-6">
            <div className="w-full max-w-md">{children}</div>
          </div>
        ) : (
          <div className="min-h-dvh">
            {/* Mobile top bar */}
            <div className="md:hidden sticky top-0 z-40 border-b border-[var(--ns-border)] bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--ns-border)] bg-white px-3 py-2 text-sm font-medium"
                  aria-label="Open menu"
                >
                  Menu
                </button>
                <div className="text-sm font-semibold">{pageTitle}</div>
                <div className="w-[52px]" />
              </div>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
              <div className="md:hidden fixed inset-0 z-50">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setMobileOpen(false)}
                />
                <div className="absolute left-0 top-0 h-full w-[78%] max-w-[320px] bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--ns-border)] px-4 py-4">
                    <div className="font-semibold">NetworkSpace</div>
                    <button
                      type="button"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl border border-[var(--ns-border)] bg-white px-3 py-2 text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>

                  <nav className="p-3">
                    {NAV.map((item) => {
                      const active = pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium",
                            active
                              ? "bg-[var(--ns-olive)]/20 text-[var(--ns-text)]"
                              : "hover:bg-black/5"
                          )}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-black/50">›</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}

            <div className="mx-auto max-w-7xl">
              <div className="flex">
                {/* Desktop sidebar */}
                <aside className="hidden md:flex md:w-64 md:flex-col md:gap-3 md:border-r md:border-[var(--ns-border)] md:bg-white/70 md:backdrop-blur md:p-4 md:min-h-dvh md:sticky md:top-0">
                  <div className="rounded-3xl border border-[var(--ns-border)] bg-white p-4">
                    <div className="text-sm font-semibold">NetworkSpace</div>
                    <div className="mt-1 text-xs text-black/55">
                      Internal Check-in System
                    </div>
                  </div>

                  <nav className="rounded-3xl border border-[var(--ns-border)] bg-white p-2">
                    {NAV.map((item) => {
                      const active = pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium",
                            active
                              ? "bg-[var(--ns-olive)]/20 text-[var(--ns-text)]"
                              : "hover:bg-black/5"
                          )}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-black/50">›</span>
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-auto rounded-3xl border border-[var(--ns-border)] bg-white p-4">
                    <div className="text-xs text-black/55">
                      Keep it simple. Keep it consistent.
                    </div>
                  </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                  {/* Desktop page header */}
                  <div className="hidden md:block mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
                    <p className="mt-1 text-sm text-black/55">
                      Premium • Familiar • Fast
                    </p>
                  </div>

                  <div className="rounded-3xl border border-[var(--ns-border)] bg-white p-4 md:p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
