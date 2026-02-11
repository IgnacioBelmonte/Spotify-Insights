"use client";

import { useEffect, useMemo } from "react";
import { t } from "@/src/lib/i18n";
import type { SpotifyDeviceOption } from "@/src/components/player/SpotifyDeviceChipSelector";

interface SpotifyDevicePickerModalProps {
  isOpen: boolean;
  activeDeviceId: string | null;
  devices: SpotifyDeviceOption[];
  disabled?: boolean;
  onClose: () => void;
  onSelectDevice: (deviceId: string) => void;
}

function DeviceTypeIcon({ type }: { type: string }) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("smartphone") || normalizedType.includes("phone")) {
    return (
      <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" aria-hidden="true">
        <rect x="6.2" y="2.6" width="7.6" height="14.8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="10" cy="14.8" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (normalizedType.includes("speaker")) {
    return (
      <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" aria-hidden="true">
        <rect x="5.4" y="3.2" width="9.2" height="13.6" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="10" cy="8.3" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="10" cy="13" r="1" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" aria-hidden="true">
      <rect x="2.8" y="4.8" width="14.4" height="9.2" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M8 15.8h4" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function DevicesHero() {
  return (
    <svg viewBox="0 0 220 92" className="h-auto w-full max-w-[220px] text-slate-100" aria-hidden="true">
      <rect x="16" y="40" width="72" height="42" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="104" y="14" width="80" height="52" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="190" y="44" width="18" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="160" y="40" width="24" height="44" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 22h48M64 22v18M64 84h20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M136 66l4-11h8l4 11M138 61h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpotifyDevicePickerModal({
  isOpen,
  activeDeviceId,
  devices,
  disabled = false,
  onClose,
  onSelectDevice,
}: SpotifyDevicePickerModalProps) {
  const sortedDevices = useMemo(
    () =>
      [...devices].sort((left, right) => {
        if (left.id === activeDeviceId) return -1;
        if (right.id === activeDeviceId) return 1;
        if (left.isActive === right.isActive) return left.name.localeCompare(right.name);
        return left.isActive ? -1 : 1;
      }),
    [activeDeviceId, devices]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        className="absolute inset-0 bg-black/88 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("player.close")}
      />

      <section className="absolute inset-0 overflow-hidden bg-[#030504]/98 animate-fade-up">
        <div className="mx-auto h-full w-full max-w-[620px] px-4 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d3932] bg-[#0e1211] text-slate-200 transition hover:border-[#1db954] hover:text-white"
              aria-label={t("player.close")}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t("player.deviceLabel")}
            </span>
            <span className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="mt-4 flex flex-col items-center">
            <DevicesHero />
            <h3 className="mt-3 text-sm font-semibold text-white">{t("player.connectDeviceTitle")}</h3>
          </div>

          <div className="mt-4 max-h-[calc(100svh-280px)] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[calc(100svh-300px)]">
            {sortedDevices.length === 0 ? (
              <p className="rounded-xl border border-[#1e2d24] bg-[#0b110f] px-3 py-2.5 text-sm text-slate-300">
                {t("player.noDevices")}
              </p>
            ) : (
              sortedDevices.map((device) => {
                const isSelected = device.id === activeDeviceId;
                const isBlocked = disabled || device.isRestricted;

                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => {
                      if (isBlocked || isSelected) {
                        return;
                      }
                      onSelectDevice(device.id);
                    }}
                    disabled={isBlocked}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "border-[#1db954] bg-[#0f2118] text-[#d7ffe8]"
                        : "border-[#1f2d24] bg-[#0b110f] text-slate-200 hover:border-[#2c4e3c] hover:bg-[#0f1814]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                      isSelected ? "border-[#2d8f5f] bg-[#0f2a1d] text-[#75e7a9]" : "border-[#29362f] bg-[#111816] text-slate-300"
                    }`}>
                      <DeviceTypeIcon type={device.type} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{device.name}</span>
                      <span className={`block text-[11px] ${isSelected ? "text-[#67d99a]" : "text-slate-400"}`}>
                        {t("player.spotifyConnect")}
                      </span>
                    </span>

                    {isSelected ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#1ed760]" aria-hidden="true" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
