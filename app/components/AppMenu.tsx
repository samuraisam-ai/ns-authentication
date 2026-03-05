"use client";

import { useRouter } from "next/navigation";
import { MENU_BUBBLE_BUTTON } from "@/lib/menu-styles";

interface AppMenuProps {
  onClose: () => void;
  showNewChat?: boolean;
  onNewChat?: () => void;
  currentPath?: string;
}

export default function AppMenu({ 
  onClose, 
  showNewChat = true, 
  onNewChat,
  currentPath 
}: AppMenuProps) {
  const router = useRouter();

  const handleNewChatClick = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      router.push("/workspace?newChat=1");
    }
    onClose();
  };

  const handleChatsClick = () => {
    router.push("/chats");
    onClose();
  };

  const handleTasksClick = () => {
    router.push("/tasks");
    onClose();
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-900/10 px-8 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-lg font-semibold text-[#d8cd72] hover:bg-slate-50"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-hidden px-6 py-4">
        <div className="flex h-full flex-col gap-2">
          {showNewChat && (
            <button
              type="button"
              onClick={handleNewChatClick}
              className={MENU_BUBBLE_BUTTON}
            >
              New chat
            </button>
          )}

          <button
            type="button"
            onClick={handleChatsClick}
            className={MENU_BUBBLE_BUTTON}
          >
            Your chats
          </button>

          <button
            type="button"
            onClick={handleTasksClick}
            className={MENU_BUBBLE_BUTTON}
          >
            Your tasks
          </button>
        </div>
      </nav>
    </>
  );
}
