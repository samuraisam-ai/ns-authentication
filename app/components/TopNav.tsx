"use client";

import { useRouter } from "next/navigation";

interface TopNavProps {
  /**
   * Number of pending notifications to display in badge.
   * If 0 or undefined, badge is hidden.
   */
  badgeCount?: number;
  /**
   * Callback when NS logo is clicked.
   * If not provided, defaults to navigating to /workspace
   */
  onLogoClick?: () => void;
  /**
   * Callback when menu button is clicked.
   * If provided, menu button is shown.
   */
  onMenuClick?: () => void;
  /**
   * Aria label for the logo button
   */
  logoAriaLabel?: string;
  /**
   * Optional className for the header element
   */
  headerClassName?: string;
}

export default function TopNav({
  badgeCount = 0,
  onLogoClick,
  onMenuClick,
  logoAriaLabel = "Go to workspace",
  headerClassName = "sticky top-0 z-20 w-full border-b border-black/10 bg-white px-5 py-4 md:px-10",
}: TopNavProps) {
  const router = useRouter();

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      router.push("/workspace");
    }
  };

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={handleLogoClick}
              aria-label={logoAriaLabel}
            >
              <img
                src="https://res.cloudinary.com/dtjysgyny/image/upload/v1771966266/NS_Logos-01_1_2_snskdp.png"
                alt="NS logo"
                className="h-9 w-9 object-contain"
              />
            </button>
            {badgeCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </div>

          <p className="text-lg text-slate-900">
            <span className="font-semibold">NS</span>{" "}
            <span className="font-medium">Coach</span>
          </p>
        </div>

        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex items-center justify-center"
            aria-label="Open menu"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-[2px] w-6 bg-[#d8cd72]" />
              <span className="block h-[2px] w-6 bg-[#d8cd72]" />
              <span className="block h-[2px] w-6 bg-[#d8cd72]" />
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
