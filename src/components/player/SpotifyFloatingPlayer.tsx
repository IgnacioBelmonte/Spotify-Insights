"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { t } from "@/src/lib/i18n";
import { SpotifyDeviceChipSelector, type SpotifyDeviceOption } from "@/src/components/player/SpotifyDeviceChipSelector";

interface FloatingTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
}

interface SpotifyFloatingPlayerProps {
  visible: boolean;
  track: FloatingTrack | null;
  isPlaying: boolean;
  disabled?: boolean;
  syncing?: boolean;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  devices: SpotifyDeviceOption[];
  deviceName?: string | null;
  positionMs: number;
  durationMs: number;
  volumePercent: number;
  onTogglePlay: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volumePercent: number) => void;
  onOpenDevicePicker: () => void;
  onOpenModal: () => void;
}

function formatMilliseconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(1, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function SpotifyFloatingPlayer({
  visible,
  track,
  isPlaying,
  disabled = false,
  syncing = false,
  activeDeviceId,
  activeDeviceName,
  devices,
  deviceName = null,
  positionMs,
  durationMs,
  onTogglePlay,
  onPreviousTrack,
  onNextTrack,
  onSeek,
  onOpenDevicePicker,
  onOpenModal,
}: SpotifyFloatingPlayerProps) {
  const touchStartYRef = useRef<number | null>(null);
  const floatingRootRef = useRef<HTMLDivElement | null>(null);
  const [reservedHeight, setReservedHeight] = useState(0);

  const handleOpenFromSurface = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // Keep explicit controls working without opening the modal.
    const interactiveAncestor = target.closest(
      "button, input, select, textarea, a, [role='button'], [role='slider']"
    );
    if (interactiveAncestor) {
      return;
    }

    onOpenModal();
  };

  useEffect(() => {
    if (!visible || !track) {
      return;
    }

    const floatingRoot = floatingRootRef.current;
    if (!floatingRoot) {
      return;
    }

    const measureHeight = () => {
      const nextHeight = Math.ceil(floatingRoot.getBoundingClientRect().height);
      setReservedHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };

    measureHeight();
    window.addEventListener("resize", measureHeight);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measureHeight);
      observer.observe(floatingRoot);
    }

    return () => {
      window.removeEventListener("resize", measureHeight);
      observer?.disconnect();
    };
  }, [track, visible]);

  if (!visible || !track) {
    return null;
  }

  const progressMs = Math.min(positionMs, Math.max(durationMs, 1));
  const progressPercent = Math.max(0, Math.min((progressMs / Math.max(durationMs, 1)) * 100, 100));
  const spacerStyle = reservedHeight > 0 ? { height: `${reservedHeight}px` } : undefined;

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none h-[140px] lg:h-[112px]" style={spacerStyle} />
      <div
        ref={floatingRootRef}
        className="fixed inset-x-0 bottom-0 z-[70] bg-transparent animate-fade-up lg:bg-[#050b10]/96 lg:shadow-[0_-18px_45px_rgba(0,0,0,0.42)] lg:backdrop-blur-md"
        onClick={handleOpenFromSurface}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-8 hidden h-8 bg-linear-to-t from-[#050b10]/75 to-transparent lg:block"
        />

        <div
          className="mx-auto hidden h-5 w-full max-w-[1480px] lg:block"
          onTouchStart={(event) => {
            touchStartYRef.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            const startY = touchStartYRef.current;
            const endY = event.changedTouches[0]?.clientY ?? null;
            touchStartYRef.current = null;
            if (startY === null || endY === null) {
              return;
            }

            if (startY - endY > 40) {
              onOpenModal();
            }
          }}
        >
          <button
            type="button"
            onClick={onOpenModal}
            className="mx-auto mt-2 block h-1.5 w-12 rounded-full bg-[#7ba8a4]/60 transition hover:bg-[#9ad6d1]"
            aria-label={t("player.openPlayer")}
            title={t("player.openPlayer")}
          />
        </div>

        <div className="mx-auto w-full max-w-[1480px] px-2 pb-2 pt-2 lg:hidden">
          <div className="rounded-xl border border-[#3f2a28] bg-[#4f221b]/95 px-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenModal}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5"
                aria-label={t("player.openPlayer")}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#6b4a44] bg-[#10222c]">
                  {track.albumImageUrl ? (
                    <Image src={track.albumImageUrl} alt={track.name} fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8ec7bd]">
                      {track.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{track.name}</p>
                  <p className="truncate text-[11px] text-[#8cf2b6]">
                    {syncing ? t("player.syncing") : deviceName ?? t("player.deviceUnknown")}
                  </p>
                </div>
              </button>

              <SpotifyDeviceChipSelector
                triggerMode="icon"
                activeDeviceId={activeDeviceId}
                activeDeviceName={activeDeviceName}
                devices={devices}
                disabled={disabled}
                onOpenDevicePicker={onOpenDevicePicker}
              />

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={disabled}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f4f5] text-[#16181b] shadow-md shadow-black/45 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isPlaying ? t("player.pause") : t("player.play")}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path d="M7.2 5.4h2.2v9.2H7.2zM10.6 5.4h2.2v9.2h-2.2z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path d="M7.2 5.3L14.8 10l-7.6 4.7V5.3z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>

            <div className="mt-2.5">
              <div
                className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#7f4f48]/85"
                aria-hidden="true"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-[#1ed760] via-[#66f3a0] to-[#b7ffd2] shadow-[0_0_14px_rgba(30,215,96,0.55)] transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent opacity-70 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto hidden w-full max-w-[1480px] grid-cols-1 gap-2 px-3 pb-3 pt-1 lg:grid lg:grid-cols-[minmax(220px,1fr)_minmax(420px,620px)_minmax(220px,1fr)] lg:items-center lg:gap-4">
          <button
            type="button"
            onClick={onOpenModal}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-[#2d5b60] hover:bg-[#0f1a22]"
            aria-label={t("player.openPlayer")}
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#204249] bg-[#10222c]">
              {track.albumImageUrl ? (
                <Image src={track.albumImageUrl} alt={track.name} fill sizes="48px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8ec7bd]">
                  {track.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{track.name}</p>
              <p className="truncate text-xs text-slate-400">{track.artistName}</p>
            </div>
          </button>

          <div className="mx-auto w-full max-w-[620px]">
            <div className="mb-1.5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onPreviousTrack}
                disabled={disabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={t("player.previous")}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path d="M11.6 5.1L6.8 10l4.8 4.9M6.8 5.1v9.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={disabled}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#dff7f1] text-[#062018] shadow-md shadow-black/45 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={isPlaying ? t("player.pause") : t("player.play")}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path d="M7.2 5.4h2.2v9.2H7.2zM10.6 5.4h2.2v9.2h-2.2z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path d="M7.2 5.3L14.8 10l-7.6 4.7V5.3z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                disabled={disabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={t("player.next")}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path d="M8.4 5.1L13.2 10l-4.8 4.9M13.2 5.1v9.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-9 text-right text-[11px] text-slate-400">{formatMilliseconds(progressMs)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(durationMs, 1)}
                step={500}
                value={progressMs}
                onChange={(event) => onSeek(Number(event.target.value))}
                disabled={disabled}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#1f353a] accent-[#54ddb8] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="w-9 text-[11px] text-slate-400">{formatMilliseconds(durationMs)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-2">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isPlaying ? "bg-[#1ed760] animate-pulse shadow-[0_0_0_3px_rgba(30,215,96,0.2)]" : "bg-[#4f6164]"}`} />
            <span className="hidden max-w-[190px] truncate text-xs text-[#9fe7be] lg:inline">
              {syncing ? t("player.syncing") : deviceName ?? t("player.deviceUnknown")}
            </span>
            <button
              type="button"
              onClick={onOpenModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#274b51] bg-[#0d1a22] text-slate-300 transition hover:border-[#48b89a] hover:text-white"
              aria-label={t("player.openPlayer")}
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M7 4H4v3M13 4h3v3M7 16H4v-3M13 16h3v-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
