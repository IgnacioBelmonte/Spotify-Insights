"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { t } from "@/src/lib/i18n";

interface UserMenuProps {
  displayName: string | null;
  imageUrl: string | null;
  isPremium: boolean;
  onLogout?: () => void;
}

export function UserMenu({ displayName, imageUrl, isPremium, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      // The logout endpoint will redirect to home and clear the cookie
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      // If redirect happens, follow it
      if (res.redirected) {
        window.location.href = res.url;
      } else if (res.ok) {
        // Fallback if no redirect
        onLogout?.();
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 px-3 py-2 rounded-2xl border border-[#1c3a40] bg-[#0b1820] hover:bg-[#102631] hover:border-[#2a5a5f] transition-all shadow-sm shadow-emerald-500/10"
      >
        <div className="relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayName ?? t("common.avatarAlt")}
              width={36}
              height={36}
              className="rounded-full object-cover border border-[#1b3a40] ring-2 ring-[#0d2a2e] group-hover:ring-[#1dd6a7]/40 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#1c3a41] text-[#c6f5e5] flex items-center justify-center text-xs font-semibold border border-[#1b3a40] ring-2 ring-[#0d2a2e] group-hover:ring-[#1dd6a7]/40 transition-all">
              {displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          {isPremium ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#102631] ring-2 ring-[#0b1820]">
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-[#14f1b2]" aria-hidden="true">
                <circle cx="6.5" cy="8" r="2.1" fill="currentColor" />
                <circle cx="12" cy="6.2" r="2.2" fill="currentColor" />
                <circle cx="17.5" cy="8" r="2.1" fill="currentColor" />
                <circle cx="9" cy="12.8" r="2.2" fill="currentColor" />
                <circle cx="15" cy="12.8" r="2.2" fill="currentColor" />
              </svg>
            </span>
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#14f1b2] ring-2 ring-[#0b1820]" />
          )}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <span>{displayName || t("userMenu.userFallback")}</span>
          </span>
          <span className="text-[11px] text-[#9cc9c4]">
            {t("userMenu.activeAccount")}
          </span>
        </div>
        <svg
          viewBox="0 0 20 20"
          className={`ml-1 hidden sm:block h-4 w-4 text-[#9cc9c4] transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-60 bg-[#0f1b24] border border-[#1b3a40] rounded-2xl shadow-xl shadow-emerald-500/10 z-50 overflow-hidden">
          <div className="p-4 border-b border-[#1b3a40]">
            <div className="flex items-center gap-3">
              <div className="relative">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={displayName ?? t("common.avatarAlt")}
                    width={40}
                    height={40}
                    className="rounded-full object-cover border border-[#1b3a40]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1c3a41] text-[#c6f5e5] flex items-center justify-center text-xs font-semibold border border-[#1b3a40]">
                    {displayName?.[0]?.toUpperCase() ?? "U"}
                  </div>
                )}
                {isPremium ? (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#102631] ring-2 ring-[#0f1b24]">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-[#14f1b2]" aria-hidden="true">
                      <circle cx="6.5" cy="8" r="2.1" fill="currentColor" />
                      <circle cx="12" cy="6.2" r="2.2" fill="currentColor" />
                      <circle cx="17.5" cy="8" r="2.1" fill="currentColor" />
                      <circle cx="9" cy="12.8" r="2.2" fill="currentColor" />
                      <circle cx="15" cy="12.8" r="2.2" fill="currentColor" />
                    </svg>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {displayName || t("userMenu.userFallback")}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-xs text-[#9cc9c4]">
                    {t("userMenu.activeAccount")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-red-300 hover:bg-red-900/30 hover:text-red-200 transition-colors"
          >
            {t("common.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
