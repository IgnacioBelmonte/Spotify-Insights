"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface UserMenuProps {
  displayName: string | null;
  imageUrl: string | null;
  onLogout?: () => void;
}

export function UserMenu({ displayName, imageUrl, onLogout }: UserMenuProps) {
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
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) {
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName ?? "avatar"}
            width={32}
            height={32}
            className="rounded-full object-cover border border-slate-600"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-semibold">
            {displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-slate-700">
            <p className="text-sm font-semibold text-white">{displayName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700/50 hover:text-red-300 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
