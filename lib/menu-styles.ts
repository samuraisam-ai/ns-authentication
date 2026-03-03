/**
 * Shared menu button styles used across workspace, tasks, and checkin task page sidebars.
 * These constants ensure consistent styling for menu bubble buttons throughout the app.
 */

/**
 * Base rounded menu button (e.g., "New chat")
 * Includes border, rounded corners, and full spacing.
 */
export const MENU_BUBBLE_BUTTON =
  "flex w-full items-center rounded-2xl border border-slate-900/10 bg-[#f0f1c9] px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-[#e3e5b4]";

/**
 * Expandable menu button (e.g., "Your chats", "Your tasks")
 * Includes border and rounded corners for visual consistency with bubble buttons.
 */
export const MENU_EXPANDABLE_BUTTON =
  "flex w-full items-center justify-between rounded-2xl border border-slate-900/10 px-4 py-3 text-left text-sm font-semibold text-slate-900 bg-[#f0f1c9] hover:bg-[#e3e5b4]";
