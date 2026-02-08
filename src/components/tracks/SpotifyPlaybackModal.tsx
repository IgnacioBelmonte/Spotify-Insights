"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { t } from "@/src/lib/i18n";
import { SpotifyPlaybackControls } from "@/src/components/player/SpotifyPlaybackControls";
import { SpotifyFloatingPlayer } from "@/src/components/player/SpotifyFloatingPlayer";

interface PlaybackTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
}

interface SpotifyPlaybackModalProps {
  isOpen: boolean;
  isPremium: boolean;
  track: PlaybackTrack | null;
  onClose: () => void;
  onOpen: () => void;
}

interface CurrentPlaybackResponse {
  playback?: {
    trackId: string;
    trackName: string;
    artistName: string;
    albumImageUrl: string | null;
    durationMs: number;
    positionMs: number;
    isPlaying: boolean;
  } | null;
  error?: string;
}

const CURRENT_PLAYBACK_POLL_MS = 4000;

let sdkLoadPromise: Promise<void> | null = null;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return t("player.unexpectedError");
}

async function fetchPlayerAccessToken(): Promise<string> {
  const response = await fetch("/api/spotify/player-token", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.accessToken) {
    throw new Error(payload?.error ?? t("player.tokenError"));
  }

  return payload.accessToken as string;
}

function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Web playback is only available in the browser"));
  }

  if (window.Spotify?.Player) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const scriptSrc = "https://sdk.scdn.co/spotify-player.js";
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`) as
      | HTMLScriptElement
      | null;
    const scriptTag = existingScript ?? document.createElement("script");
    scriptTag.src = scriptSrc;
    scriptTag.async = true;

    const readyTimeout = window.setTimeout(() => {
      reject(new Error(t("player.sdkTimeout")));
    }, 12000);

    const previousReadyCallback = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReadyCallback?.();
      window.clearTimeout(readyTimeout);
      resolve();
    };

    scriptTag.onerror = () => {
      window.clearTimeout(readyTimeout);
      reject(new Error(t("player.sdkLoadError")));
    };

    if (!existingScript) {
      document.body.appendChild(scriptTag);
    }
  });

  return sdkLoadPromise;
}

export function SpotifyPlaybackModal({
  isOpen,
  isPremium,
  track,
  onClose,
  onOpen,
}: SpotifyPlaybackModalProps) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const requestedTrackRef = useRef<string | null>(null);
  const remoteSyncErrorRef = useRef(false);

  const [displayTrack, setDisplayTrack] = useState<PlaybackTrack | null>(track);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkConnecting, setSdkConnecting] = useState(false);
  const [playbackStarting, setPlaybackStarting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [volumePercent, setVolumePercent] = useState(80);
  const [permissionsMissing, setPermissionsMissing] = useState(false);

  useEffect(() => {
    if (!track) {
      return;
    }

    setDisplayTrack(track);
  }, [track]);

  useEffect(() => {
    if (!isPremium) {
      return;
    }

    let cancelled = false;

    async function initializePlayer() {
      setSdkConnecting(true);
      setError(null);

      try {
        await loadSpotifySdk();
        if (cancelled) {
          return;
        }

        if (!window.Spotify?.Player) {
          throw new Error(t("player.sdkUnavailable"));
        }

        const player = new window.Spotify.Player({
          name: "Spotify Insights Player",
          getOAuthToken: (callback) => {
            fetchPlayerAccessToken()
              .then((token) => callback(token))
              .catch((tokenError) => {
                setError(readErrorMessage(tokenError));
              });
          },
          volume: 0.8,
        });

        const setPlayerError = (incomingError: SpotifyPlayerError) => {
          if (!cancelled) {
            setError(incomingError.message || t("player.playbackError"));
            setSdkConnecting(false);
          }
        };

        player.addListener("ready", ({ device_id }) => {
          if (cancelled) {
            return;
          }
          setDeviceId(device_id);
          setError(null);
          setSdkConnecting(false);
        });

        player.addListener("not_ready", () => {
          if (cancelled) {
            return;
          }
          setDeviceId(null);
        });

        player.addListener("initialization_error", setPlayerError);
        player.addListener("authentication_error", setPlayerError);
        player.addListener("account_error", setPlayerError);
        player.addListener("playback_error", setPlayerError);

        player.addListener("player_state_changed", (state) => {
          if (cancelled || !state) {
            return;
          }

          const currentTrack = state.track_window.current_track;
          if (currentTrack?.id && currentTrack.name) {
            setDisplayTrack({
              id: currentTrack.id,
              name: currentTrack.name,
              artistName: currentTrack.artists.map((artist) => artist.name).join(", "),
              albumImageUrl: currentTrack.album.images?.[0]?.url ?? null,
            });
          }

          setIsPlaying(!state.paused);
          setPositionMs(state.position);
          setDurationMs(Math.max(state.duration, 1));
        });

        const connected = await player.connect();
        if (!connected) {
          throw new Error(t("player.connectError"));
        }

        const currentVolume = await player.getVolume().catch(() => 0.8);
        if (!cancelled) {
          setVolumePercent(Math.round(Math.max(0, Math.min(currentVolume, 1)) * 100));
        }

        playerRef.current = player;
      } catch (incomingError) {
        if (cancelled) {
          return;
        }
        setError(readErrorMessage(incomingError));
      } finally {
        if (!cancelled) {
          setSdkConnecting(false);
        }
      }
    }

    initializePlayer();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [isPremium]);

  useEffect(() => {
    if (!isOpen || !isPremium || !track || !deviceId) {
      return;
    }

    let cancelled = false;

    async function startPlayback() {
      if (requestedTrackRef.current === track.id) {
        return;
      }

      requestedTrackRef.current = track.id;
      setPlaybackStarting(true);
      setError(null);

      try {
        const response = await fetch("/api/spotify/player/play", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackId: track.id,
            deviceId,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (response.status === 403) {
          setPermissionsMissing(true);
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.error ?? t("player.playbackError"));
        }
      } catch (incomingError) {
        if (!cancelled) {
          setError(readErrorMessage(incomingError));
        }
      } finally {
        if (!cancelled) {
          setPlaybackStarting(false);
        }
      }
    }

    startPlayback();

    return () => {
      cancelled = true;
    };
  }, [deviceId, isOpen, isPremium, track]);

  useEffect(() => {
    if (!isOpen) {
      requestedTrackRef.current = null;
      return;
    }

    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keydownHandler);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", keydownHandler);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isPlaying || !playerRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      playerRef.current?.getCurrentState().then((state) => {
        if (!state) {
          return;
        }
        setPositionMs(state.position);
        setDurationMs(Math.max(state.duration, 1));
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPremium || permissionsMissing) {
      return;
    }

    let cancelled = false;

    async function syncCurrentPlayback() {
      try {
        const response = await fetch("/api/spotify/player/current", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as CurrentPlaybackResponse | null;

        if (response.status === 403) {
          if (!cancelled) {
            setPermissionsMissing(true);
            setError(null);
          }
          return;
        }

        if (!response.ok) {
          if (response.status >= 500 && !cancelled && !remoteSyncErrorRef.current) {
            setError(payload?.error ?? t("player.currentStateError"));
            remoteSyncErrorRef.current = true;
          }
          return;
        }

        remoteSyncErrorRef.current = false;
        const playback = payload?.playback;
        if (!playback || cancelled) {
          return;
        }

        setDisplayTrack({
          id: playback.trackId,
          name: playback.trackName,
          artistName: playback.artistName,
          albumImageUrl: playback.albumImageUrl,
        });
        setIsPlaying(playback.isPlaying);
        setPositionMs(Math.max(playback.positionMs, 0));
        setDurationMs(Math.max(playback.durationMs, 1));
      } catch (incomingError) {
        if (!cancelled && !remoteSyncErrorRef.current) {
          setError(readErrorMessage(incomingError));
          remoteSyncErrorRef.current = true;
        }
      }
    }

    syncCurrentPlayback();
    const interval = window.setInterval(syncCurrentPlayback, CURRENT_PLAYBACK_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isPremium, permissionsMissing]);

  const visualTrack = displayTrack ?? track;
  const canControlPlayer = Boolean(playerRef.current && deviceId && isPremium);
  const controlsDisabled = !canControlPlayer || sdkConnecting || playbackStarting;
  const floatingVisible = Boolean(visualTrack) && (isPlaying || positionMs > 0) && !isOpen;

  async function handleTogglePlay() {
    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.togglePlay();
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  async function handlePreviousTrack() {
    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.previousTrack();
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleNextTrack() {
    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.nextTrack();
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleSeek(nextPositionMs: number) {
    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.seek(nextPositionMs);
      setPositionMs(nextPositionMs);
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleVolumeChange(nextVolumePercent: number) {
    if (!playerRef.current) {
      return;
    }

    const safeVolumePercent = Math.max(0, Math.min(nextVolumePercent, 100));
    try {
      await playerRef.current.setVolume(safeVolumePercent / 100);
      setVolumePercent(safeVolumePercent);
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  return (
    <>
      {isOpen && visualTrack ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={onClose}
            aria-hidden="true"
          />
          <section className="relative z-[81] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#25535a] bg-[#0c1720]/95 shadow-2xl shadow-emerald-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.16),_transparent_60%)]" />
            <div className="relative p-5 sm:p-7">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#295a60] bg-[#0f232d] text-slate-200 hover:border-[#31a78a] hover:text-white"
                aria-label={t("player.close")}
              >
                x
              </button>

              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">
                {t("player.modalEyebrow")}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{t("player.modalTitle")}</h3>

              <div className="mt-6 grid gap-5 sm:grid-cols-[220px_1fr] sm:items-start">
                <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-[#2d5960] bg-[#10222c] shadow-xl shadow-emerald-500/20">
                  {visualTrack.albumImageUrl ? (
                    <Image
                      src={visualTrack.albumImageUrl}
                      alt={visualTrack.name}
                      fill
                      sizes="220px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[#8ec7bd]">
                      {visualTrack.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-300">{visualTrack.artistName}</p>
                    <p className="text-2xl font-semibold text-white leading-tight">{visualTrack.name}</p>
                  </div>

                  {isPremium ? (
                    <div className="space-y-3 rounded-2xl border border-[#24535a] bg-[#0b1c25]/80 p-4">
                      <SpotifyPlaybackControls
                        isPlaying={isPlaying}
                        disabled={controlsDisabled}
                        positionMs={positionMs}
                        durationMs={durationMs}
                        volumePercent={volumePercent}
                        onTogglePlay={handleTogglePlay}
                        onPreviousTrack={handlePreviousTrack}
                        onNextTrack={handleNextTrack}
                        onSeek={handleSeek}
                        onVolumeChange={handleVolumeChange}
                      />

                      <p className="text-xs text-slate-400">
                        {sdkConnecting
                          ? t("player.connecting")
                          : playbackStarting
                            ? t("player.starting")
                            : permissionsMissing
                              ? t("player.permissionsMissing")
                              : t("player.ready")}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                      {t("player.premiumRequired")}
                    </div>
                  )}

                  {error ? (
                    <p className="rounded-2xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-100">
                      {error}
                    </p>
                  ) : null}

                  <a
                    href={`https://open.spotify.com/track/${visualTrack.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#2c6665] bg-[#102a2f] px-4 py-2 text-sm text-[#d5f2eb] hover:border-[#47be9a] hover:text-white"
                  >
                    {t("player.openInSpotify")}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <SpotifyFloatingPlayer
        visible={floatingVisible}
        track={visualTrack}
        isPlaying={isPlaying}
        disabled={controlsDisabled}
        positionMs={positionMs}
        durationMs={durationMs}
        volumePercent={volumePercent}
        onTogglePlay={handleTogglePlay}
        onPreviousTrack={handlePreviousTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onOpenModal={onOpen}
      />
    </>
  );
}

