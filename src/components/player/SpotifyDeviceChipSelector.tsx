"use client";

import { t } from "@/src/lib/i18n";

export interface SpotifyDeviceOption {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
}

interface SpotifyDeviceChipSelectorProps {
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  devices: SpotifyDeviceOption[];
  disabled?: boolean;
  triggerMode?: "chip" | "icon";
  onOpenDevicePicker: () => void;
}

export function SpotifyDeviceChipSelector({
  activeDeviceName,
  disabled = false,
  triggerMode = "chip",
  onOpenDevicePicker,
}: SpotifyDeviceChipSelectorProps) {
  const canOpen = !disabled;
  const activeLabel = activeDeviceName ?? t("player.deviceUnknown");

  return (
    <div className={triggerMode === "icon" ? "relative w-auto shrink-0" : "relative mx-auto w-full max-w-[560px]"}>
      {triggerMode === "icon" ? (
        <button
          type="button"
          onClick={onOpenDevicePicker}
          disabled={!canOpen}
          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
            canOpen
              ? "border-[#6d4b44] bg-[#5f2d25] text-slate-100 hover:border-[#1ed760] hover:text-white"
              : "cursor-default border-[#4f403d] bg-[#4c2a25] text-[#a4b4ad]"
          }`}
          aria-label={`${t("player.deviceLabel")}: ${activeLabel}`}
          title={activeLabel}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path
              d="M3.8 5.4h12.4v7.2H3.8zM8 14.8h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={`absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full ${
              activeDeviceName
                ? "animate-pulse bg-[#1ed760] shadow-[0_0_0_2px_rgba(30,215,96,0.22)]"
                : "bg-slate-500"
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenDevicePicker}
          disabled={!canOpen}
          className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 transition ${
            canOpen
              ? "border-[#2e724f] bg-[#0e2e21]/90 text-[#b9f3cf] hover:border-[#1db954] hover:text-[#d6ffe8]"
              : "cursor-default border-[#375348] bg-[#16231f] text-[#a4b4ad]"
          }`}
          aria-label={t("player.deviceLabel")}
          title={activeLabel}
        >
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              activeDeviceName
                ? "animate-pulse bg-[#1ed760] shadow-[0_0_0_3px_rgba(30,215,96,0.2)]"
                : "bg-slate-500"
            }`}
            aria-hidden="true"
          />
          <span className="max-w-[320px] truncate text-xs font-medium">{activeLabel}</span>
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M5 7.6L10 12.4l5-4.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
