"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/src/lib/i18n";
import { SpotifyDeviceChipSelector } from "@/src/components/player/SpotifyDeviceChipSelector";
import { SpotifyDevicePickerModal } from "@/src/components/player/SpotifyDevicePickerModal";
import { SpotifyFloatingPlayer } from "@/src/components/player/SpotifyFloatingPlayer";
import type { PlaybackTrack } from "@/src/components/tracks/playback.types";

interface SpotifyPlaybackModalProps {
  isOpen: boolean;
  isPremium: boolean;
  track: PlaybackTrack | null;
  playbackRequestId: number;
  onClose: () => void;
  onOpen: () => void;
}

interface PlaybackDeviceSnapshot {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  volumePercent: number | null;
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
    deviceId: string | null;
    deviceName: string | null;
    shuffleEnabled: boolean;
    repeatMode: "off" | "context" | "track";
    volumePercent: number | null;
  } | null;
  devices?: PlaybackDeviceSnapshot[];
  syncedAt?: string;
  error?: string;
}

type ControlAction =
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "seek"
  | "volume"
  | "shuffle"
  | "repeat"
  | "transfer";

interface ControlPayload {
  action: ControlAction;
  deviceId?: string;
  positionMs?: number;
  volumePercent?: number;
  state?: boolean;
  mode?: "off" | "context" | "track";
  play?: boolean;
}

const CURRENT_PLAYBACK_POLL_MS = 2200;
const LOCAL_PROGRESS_TICK_MS = 250;
const POSITION_DRIFT_TOLERANCE_MS = 900;
const POSITION_BACKWARD_TOLERANCE_MS = 1800;
const SEEK_COMMIT_DEBOUNCE_MS = 130;

let sdkLoadPromise: Promise<void> | null = null;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return t("player.unexpectedError");
}

function getNextRepeatMode(currentMode: "off" | "context" | "track"): "off" | "context" | "track" {
  if (currentMode === "off") {
    return "context";
  }

  if (currentMode === "context") {
    return "track";
  }

  return "off";
}

function formatMilliseconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString();
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clampPlaybackPosition(positionMs: number, durationMs: number): number {
  return Math.max(0, Math.min(positionMs, Math.max(durationMs, 1)));
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
  playbackRequestId,
  onClose,
  onOpen,
}: SpotifyPlaybackModalProps) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const requestedTrackRef = useRef<string | null>(null);
  const remoteSyncErrorRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);
  const activeDeviceIdRef = useRef<string | null>(null);
  const playIntentRef = useRef<{ value: boolean; expiresAt: number } | null>(null);
  const volumeIntentRef = useRef<{ value: number; expiresAt: number } | null>(null);
  const lastRemoteVolumeRef = useRef<number | null>(null);
  const volumeCommitTimeoutRef = useRef<number | null>(null);
  const seekCommitTimeoutRef = useRef<number | null>(null);
  const pendingSeekPositionRef = useRef<number | null>(null);
  const sheetTouchStartYRef = useRef<number | null>(null);
  const handledPlaybackRequestRef = useRef(0);
  const playbackAnchorRef = useRef({
    positionMs: 0,
    durationMs: 1,
    isPlaying: false,
    updatedAtMs: 0,
  });
  const isPlayingRef = useRef(false);
  const durationMsRef = useRef(1);

  const [displayTrack, setDisplayTrack] = useState<PlaybackTrack | null>(track);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [activeDeviceName, setActiveDeviceName] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<PlaybackDeviceSnapshot[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [sdkConnecting, setSdkConnecting] = useState(false);
  const [playbackStarting, setPlaybackStarting] = useState(false);
  const [syncingPlayback, setSyncingPlayback] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [volumePercent, setVolumePercent] = useState(80);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "context" | "track">("off");

  const [permissionsMissing, setPermissionsMissing] = useState(false);
  const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (volumeCommitTimeoutRef.current !== null) {
        window.clearTimeout(volumeCommitTimeoutRef.current);
      }
      if (seekCommitTimeoutRef.current !== null) {
        window.clearTimeout(seekCommitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!track) {
      return;
    }

    setDisplayTrack(track);
  }, [track]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    activeDeviceIdRef.current = activeDeviceId;
  }, [activeDeviceId]);

  const projectCurrentPosition = useCallback((atMs = Date.now()): number => {
    const anchor = playbackAnchorRef.current;
    if (!anchor.isPlaying) {
      return clampPlaybackPosition(anchor.positionMs, anchor.durationMs);
    }

    const elapsedMs = Math.max(0, atMs - anchor.updatedAtMs);
    return clampPlaybackPosition(anchor.positionMs + elapsedMs, anchor.durationMs);
  }, []);

  const applyPlaybackAnchor = useCallback(
    (
      nextPositionMs: number,
      nextDurationMs: number,
      nextIsPlaying: boolean,
      anchoredAtMs = Date.now()
    ) => {
      const safeDurationMs = Math.max(nextDurationMs, 1);
      const safePositionMs = clampPlaybackPosition(nextPositionMs, safeDurationMs);
      playbackAnchorRef.current = {
        positionMs: safePositionMs,
        durationMs: safeDurationMs,
        isPlaying: nextIsPlaying,
        updatedAtMs: anchoredAtMs,
      };
      setDurationMs((currentDurationMs) =>
        currentDurationMs === safeDurationMs ? currentDurationMs : safeDurationMs
      );
      setIsPlaying((currentIsPlaying) =>
        currentIsPlaying === nextIsPlaying ? currentIsPlaying : nextIsPlaying
      );
      setPositionMs((currentPositionMs) =>
        Math.abs(currentPositionMs - safePositionMs) < 30 ? currentPositionMs : safePositionMs
      );
    },
    []
  );

  const mergeRemotePlaybackPosition = useCallback(
    ({
      positionMs: remotePositionMs,
      durationMs: remoteDurationMs,
      isPlaying: remoteIsPlaying,
      sampledAtMs,
      force = false,
    }: {
      positionMs: number;
      durationMs: number;
      isPlaying: boolean;
      sampledAtMs?: number;
      force?: boolean;
    }) => {
      const nowMs = Date.now();
      const safeDurationMs = Math.max(remoteDurationMs, 1);
      const safeSampledAtMs =
        typeof sampledAtMs === "number" && Number.isFinite(sampledAtMs) ? sampledAtMs : nowMs;
      const elapsedSinceSampleMs = remoteIsPlaying ? Math.max(0, nowMs - safeSampledAtMs) : 0;
      const projectedRemotePositionMs = clampPlaybackPosition(
        remotePositionMs + elapsedSinceSampleMs,
        safeDurationMs
      );

      if (force || !remoteIsPlaying) {
        applyPlaybackAnchor(projectedRemotePositionMs, safeDurationMs, remoteIsPlaying, nowMs);
        return;
      }

      const projectedCurrentPositionMs = projectCurrentPosition(nowMs);
      const driftMs = projectedRemotePositionMs - projectedCurrentPositionMs;
      const shouldResync =
        driftMs > POSITION_DRIFT_TOLERANCE_MS || driftMs < -POSITION_BACKWARD_TOLERANCE_MS;

      applyPlaybackAnchor(
        shouldResync ? projectedRemotePositionMs : projectedCurrentPositionMs,
        safeDurationMs,
        remoteIsPlaying,
        nowMs
      );
    },
    [applyPlaybackAnchor, projectCurrentPosition]
  );

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
          if (cancelled) {
            return;
          }

          setError(incomingError.message || t("player.playbackError"));
          setSdkConnecting(false);
        };

        player.addListener("ready", ({ device_id }) => {
          if (cancelled) {
            return;
          }

          setDeviceId(device_id);
          setError(null);
          setSdkConnecting(false);
          setActiveDeviceId((current) => current ?? device_id);
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

          const localDeviceId = deviceIdRef.current;
          const activeDevice = activeDeviceIdRef.current;
          const localDeviceControlsPlayback = Boolean(
            localDeviceId && (!activeDevice || activeDevice === localDeviceId)
          );
          if (!localDeviceControlsPlayback) {
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

          mergeRemotePlaybackPosition({
            positionMs: Math.max(state.position, 0),
            durationMs: Math.max(state.duration, 1),
            isPlaying: !state.paused,
            sampledAtMs: Date.now(),
          });
        });

        const connected = await player.connect();
        if (!connected) {
          throw new Error(t("player.connectError"));
        }

        const currentVolume = await player.getVolume().catch(() => 0.8);
        if (!cancelled) {
          const safeVolume = Math.round(Math.max(0, Math.min(currentVolume, 1)) * 100);
          lastRemoteVolumeRef.current = safeVolume;
          setVolumePercent(safeVolume);
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
  }, [isPremium, mergeRemotePlaybackPosition]);

  const syncCurrentPlayback = useCallback(
    async (silent = true) => {
      if (!isPremium || permissionsMissing) {
        return;
      }

      if (!silent) {
        setSyncingPlayback(true);
      }

      try {
        const response = await fetch("/api/spotify/player/current", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as CurrentPlaybackResponse | null;

        if (response.status === 403) {
          setPermissionsMissing(true);
          setError(null);
          return;
        }

        if (!response.ok) {
          if (response.status >= 500 && !remoteSyncErrorRef.current) {
            setError(payload?.error ?? t("player.currentStateError"));
            remoteSyncErrorRef.current = true;
          }
          return;
        }

        remoteSyncErrorRef.current = false;

        const devices = Array.isArray(payload?.devices) ? payload.devices : [];
        setAvailableDevices(devices);

        const activeDevice = devices.find((device) => device.isActive) ?? null;

        const applyRemoteVolume = (incomingVolume: number) => {
          const safeVolume = Math.max(0, Math.min(incomingVolume, 100));
          lastRemoteVolumeRef.current = safeVolume;

          const intent = volumeIntentRef.current;
          if (intent && Date.now() <= intent.expiresAt) {
            if (Math.abs(safeVolume - intent.value) <= 2) {
              volumeIntentRef.current = null;
              setVolumePercent(safeVolume);
            }
            return;
          }

          volumeIntentRef.current = null;
          setVolumePercent(safeVolume);
        };

        if (activeDevice) {
          setActiveDeviceId(activeDevice.id);
          setActiveDeviceName(activeDevice.name);
          if (typeof activeDevice.volumePercent === "number") {
            applyRemoteVolume(activeDevice.volumePercent);
          }
        }

        const parsedSyncedAtMs =
          typeof payload?.syncedAt === "string" ? Date.parse(payload.syncedAt) : Number.NaN;
        const sampledAtMs = Number.isFinite(parsedSyncedAtMs) ? parsedSyncedAtMs : Date.now();

        const playback = payload?.playback;
        if (!playback) {
          const intent = playIntentRef.current;
          if (!intent || Date.now() > intent.expiresAt) {
            playIntentRef.current = null;
            applyPlaybackAnchor(0, 1, false);
            setDisplayTrack(null);
          }
          return;
        }

        setDisplayTrack({
          id: playback.trackId,
          name: playback.trackName,
          artistName: playback.artistName,
          albumImageUrl: playback.albumImageUrl,
        });

        let resolvedIsPlaying = playback.isPlaying;
        const intent = playIntentRef.current;
        if (intent && Date.now() <= intent.expiresAt) {
          if (playback.isPlaying === intent.value) {
            playIntentRef.current = null;
          } else {
            resolvedIsPlaying = intent.value;
          }
        } else {
          playIntentRef.current = null;
        }

        mergeRemotePlaybackPosition({
          positionMs: Math.max(playback.positionMs, 0),
          durationMs: Math.max(playback.durationMs, 1),
          isPlaying: resolvedIsPlaying,
          sampledAtMs,
          force: !resolvedIsPlaying,
        });
        setShuffleEnabled(Boolean(playback.shuffleEnabled));
        setRepeatMode(playback.repeatMode ?? "off");

        if (playback.deviceId) {
          setActiveDeviceId(playback.deviceId);
        }
        if (playback.deviceName) {
          setActiveDeviceName(playback.deviceName);
        }
        if (typeof playback.volumePercent === "number") {
          applyRemoteVolume(playback.volumePercent);
        }
      } catch (incomingError) {
        if (!remoteSyncErrorRef.current) {
          setError(readErrorMessage(incomingError));
          remoteSyncErrorRef.current = true;
        }
      } finally {
        if (!silent) {
          setSyncingPlayback(false);
        }
      }
    },
    [applyPlaybackAnchor, isPremium, mergeRemotePlaybackPosition, permissionsMissing]
  );

  useEffect(() => {
    if (!isPremium || permissionsMissing) {
      return;
    }

    let cancelled = false;

    const safeSync = () => {
      if (cancelled) {
        return;
      }

      void syncCurrentPlayback(true);
    };

    safeSync();
    const interval = window.setInterval(safeSync, CURRENT_PLAYBACK_POLL_MS);

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        safeSync();
      }
    };

    window.addEventListener("focus", safeSync);
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", safeSync);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [isPremium, permissionsMissing, syncCurrentPlayback]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      const projectedPositionMs = projectCurrentPosition(Date.now());
      setPositionMs((currentPositionMs) =>
        Math.abs(currentPositionMs - projectedPositionMs) < 30 ? currentPositionMs : projectedPositionMs
      );
    }, LOCAL_PROGRESS_TICK_MS);

    return () => window.clearInterval(interval);
  }, [isPlaying, projectCurrentPosition]);

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
    if (!isOpen || !isPremium || !track) {
      return;
    }
    const requestedTrack = track;

    if (playbackRequestId <= handledPlaybackRequestRef.current) {
      return;
    }

    const targetDeviceId = activeDeviceId ?? deviceId;
    if (!targetDeviceId) {
      return;
    }

    handledPlaybackRequestRef.current = playbackRequestId;
    let cancelled = false;

    async function startPlayback() {
      const requestKey = `${requestedTrack.id}:${targetDeviceId}`;
      if (requestedTrackRef.current === requestKey) {
        return;
      }

      requestedTrackRef.current = requestKey;
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
            trackId: requestedTrack.id,
            deviceId: targetDeviceId,
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

        if (cancelled) {
          return;
        }

        setDisplayTrack(requestedTrack);
        applyPlaybackAnchor(0, durationMsRef.current, true);
        setActiveDeviceId(targetDeviceId);
      } catch (incomingError) {
        if (!cancelled) {
          setError(readErrorMessage(incomingError));
        }
      } finally {
        if (!cancelled) {
          setPlaybackStarting(false);
        }
        window.setTimeout(() => {
          if (!cancelled) {
            void syncCurrentPlayback(true);
          }
        }, 500);
      }
    }

    void startPlayback();

    return () => {
      cancelled = true;
    };
  }, [activeDeviceId, applyPlaybackAnchor, deviceId, isOpen, isPremium, playbackRequestId, syncCurrentPlayback, track]);

  const performRemoteControl = useCallback(
    async (payload: ControlPayload, syncAfter = true) => {
      const response = await fetch("/api/spotify/player/control", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json().catch(() => null);

      if (response.status === 403) {
        setPermissionsMissing(true);
        throw new Error(responsePayload?.error ?? t("player.permissionsMissing"));
      }

      if (!response.ok) {
        throw new Error(responsePayload?.error ?? t("player.controlError"));
      }

      if (syncAfter) {
        void syncCurrentPlayback(true);
      }
    },
    [syncCurrentPlayback]
  );

  const resolveFallbackDeviceId = useCallback((): string | null => {
    if (activeDeviceId) {
      return activeDeviceId;
    }

    const activeDevice = availableDevices.find((device) => device.isActive && !device.isRestricted);
    if (activeDevice) {
      return activeDevice.id;
    }

    const firstAvailableDevice = availableDevices.find((device) => !device.isRestricted);
    if (firstAvailableDevice) {
      return firstAvailableDevice.id;
    }

    if (deviceId) {
      return deviceId;
    }

    return null;
  }, [activeDeviceId, availableDevices, deviceId]);

  const schedulePostActionSync = useCallback(() => {
    window.setTimeout(() => void syncCurrentPlayback(true), 280);
    window.setTimeout(() => void syncCurrentPlayback(true), 850);
  }, [syncCurrentPlayback]);

  const ensureControllableDevice = useCallback(async (): Promise<string> => {
    const candidateDeviceId = resolveFallbackDeviceId();
    if (!candidateDeviceId) {
      throw new Error(t("player.noActiveDevice"));
    }

    if (!activeDeviceId) {
      await performRemoteControl(
        {
          action: "transfer",
          deviceId: candidateDeviceId,
          play: isPlayingRef.current,
        },
        false
      );

      const targetDevice = availableDevices.find((device) => device.id === candidateDeviceId);
      setActiveDeviceId(candidateDeviceId);
      setActiveDeviceName(targetDevice?.name ?? activeDeviceName);
    }

    return candidateDeviceId;
  }, [
    activeDeviceId,
    activeDeviceName,
    availableDevices,
    performRemoteControl,
    resolveFallbackDeviceId,
  ]);

  const visualTrack = displayTrack ?? track;
  const canControlPlayer = isPremium && !permissionsMissing;
  const controlsDisabled = !canControlPlayer || playbackStarting;

  async function handleTogglePlay() {
    if (controlsDisabled) {
      return;
    }

    const basePositionMs = projectCurrentPosition(Date.now());
    const nextIsPlaying = !isPlaying;
    playIntentRef.current = {
      value: nextIsPlaying,
      expiresAt: Date.now() + 2200,
    };
    applyPlaybackAnchor(basePositionMs, durationMsRef.current, nextIsPlaying);

    try {
      setError(null);
      const targetDeviceId = await ensureControllableDevice();

      await performRemoteControl(
        {
          action: nextIsPlaying ? "play" : "pause",
          deviceId: targetDeviceId,
        },
        false
      );
      schedulePostActionSync();
    } catch (incomingError) {
      playIntentRef.current = null;
      applyPlaybackAnchor(basePositionMs, durationMsRef.current, !nextIsPlaying);
      setError(readErrorMessage(incomingError));
    }
  }

  async function handlePreviousTrack() {
    if (controlsDisabled) {
      return;
    }

    try {
      setError(null);
      const targetDeviceId = await ensureControllableDevice();

      await performRemoteControl({
        action: "previous",
        deviceId: targetDeviceId,
      });
      schedulePostActionSync();
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleNextTrack() {
    if (controlsDisabled) {
      return;
    }

    try {
      setError(null);
      const targetDeviceId = await ensureControllableDevice();

      await performRemoteControl({
        action: "next",
        deviceId: targetDeviceId,
      });
      schedulePostActionSync();
    } catch (incomingError) {
      setError(readErrorMessage(incomingError));
    }
  }

  function handleSeek(nextPositionMs: number) {
    if (controlsDisabled) {
      return;
    }

    const safePositionMs = clampPlaybackPosition(nextPositionMs, durationMsRef.current);
    pendingSeekPositionRef.current = safePositionMs;
    applyPlaybackAnchor(safePositionMs, durationMsRef.current, isPlayingRef.current);

    if (seekCommitTimeoutRef.current !== null) {
      window.clearTimeout(seekCommitTimeoutRef.current);
    }

    seekCommitTimeoutRef.current = window.setTimeout(() => {
      seekCommitTimeoutRef.current = null;
      const committedPositionMs = pendingSeekPositionRef.current;
      pendingSeekPositionRef.current = null;
      if (committedPositionMs === null) {
        return;
      }

      void (async () => {
        try {
          setError(null);
          const targetDeviceId = await ensureControllableDevice();

          await performRemoteControl(
            {
              action: "seek",
              positionMs: committedPositionMs,
              deviceId: targetDeviceId,
            },
            false
          );
          window.setTimeout(() => void syncCurrentPlayback(true), 700);
        } catch (incomingError) {
          setError(readErrorMessage(incomingError));
          void syncCurrentPlayback(true);
        }
      })();
    }, SEEK_COMMIT_DEBOUNCE_MS);
  }

  async function handleVolumeChange(nextVolumePercent: number) {
    if (controlsDisabled) {
      return;
    }

    const previousVolume = volumePercent;
    const safeVolumePercent = Math.max(0, Math.min(nextVolumePercent, 100));
    setVolumePercent(safeVolumePercent);
    volumeIntentRef.current = {
      value: safeVolumePercent,
      expiresAt: Date.now() + 2200,
    };

    if (volumeCommitTimeoutRef.current !== null) {
      window.clearTimeout(volumeCommitTimeoutRef.current);
    }

    volumeCommitTimeoutRef.current = window.setTimeout(async () => {
      volumeCommitTimeoutRef.current = null;

      try {
        setError(null);
        const targetDeviceId = await ensureControllableDevice();

        await performRemoteControl(
          {
            action: "volume",
            volumePercent: safeVolumePercent,
            deviceId: targetDeviceId,
          },
          false
        );
        schedulePostActionSync();
      } catch (incomingError) {
        volumeIntentRef.current = null;
        setVolumePercent(lastRemoteVolumeRef.current ?? previousVolume);
        setError(readErrorMessage(incomingError));
      }
    }, 140);
  }

  async function handleToggleShuffle() {
    if (controlsDisabled) {
      return;
    }

    const previousState = shuffleEnabled;
    const nextState = !previousState;
    setShuffleEnabled(nextState);

    try {
      setError(null);
      const targetDeviceId = await ensureControllableDevice();
      await performRemoteControl({
        action: "shuffle",
        state: nextState,
        deviceId: targetDeviceId,
      });
      schedulePostActionSync();
    } catch (incomingError) {
      setShuffleEnabled(previousState);
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleCycleRepeat() {
    if (controlsDisabled) {
      return;
    }

    const previousMode = repeatMode;
    const nextMode = getNextRepeatMode(previousMode);
    setRepeatMode(nextMode);

    try {
      setError(null);
      const targetDeviceId = await ensureControllableDevice();
      await performRemoteControl({
        action: "repeat",
        mode: nextMode,
        deviceId: targetDeviceId,
      });
      schedulePostActionSync();
    } catch (incomingError) {
      setRepeatMode(previousMode);
      setError(readErrorMessage(incomingError));
    }
  }

  async function handleTransferDevice(nextDeviceId: string) {
    if (!nextDeviceId || nextDeviceId === activeDeviceId || controlsDisabled) {
      return;
    }

    const previousDeviceId = activeDeviceId;
    const previousDeviceName = activeDeviceName;
    setActiveDeviceId(nextDeviceId);
    const nextDevice = availableDevices.find((device) => device.id === nextDeviceId);
    setActiveDeviceName(nextDevice?.name ?? null);

    try {
      setError(null);
      await performRemoteControl(
        {
          action: "transfer",
          deviceId: nextDeviceId,
          play: isPlaying,
        },
        true
      );
      schedulePostActionSync();
    } catch (incomingError) {
      setActiveDeviceId(previousDeviceId);
      setActiveDeviceName(previousDeviceName);
      setError(readErrorMessage(incomingError));
    }
  }

  function handleRefreshPlayback() {
    setError(null);
    void syncCurrentPlayback(false);
  }

  function handleOpenDevicePicker() {
    setIsDevicePickerOpen(true);
  }

  function handleCloseDevicePicker() {
    setIsDevicePickerOpen(false);
  }

  function handleSelectDeviceFromPicker(nextDeviceId: string) {
    if (!nextDeviceId) {
      return;
    }
    setIsDevicePickerOpen(false);
    void handleTransferDevice(nextDeviceId);
  }

  const statusText = permissionsMissing
    ? t("player.permissionsMissing")
    : playbackStarting
      ? t("player.starting")
      : syncingPlayback
        ? t("player.syncing")
        : activeDeviceName
          ? t("player.controllingDevice", { device: activeDeviceName })
          : sdkConnecting
            ? t("player.connecting")
            : t("player.ready");

  const hasActivePlayback = Boolean(visualTrack && (isPlaying || positionMs > 0 || playbackStarting));
  const floatingVisible = hasActivePlayback && !isOpen;
  const progressMs = Math.min(Math.max(positionMs, 0), Math.max(durationMs, 1));

  return (
    <>
      {isOpen && visualTrack ? (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/78 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <section
            className="absolute inset-x-0 bottom-0 z-[81] h-[100svh] overflow-hidden rounded-t-3xl border-t border-[#2b3e47] bg-linear-to-b from-[#303338] via-[#191b1f] to-[#090b0d] shadow-[0_-30px_90px_rgba(0,0,0,0.72)] animate-fade-up sm:h-[94vh] md:inset-x-1/2 md:bottom-6 md:h-[min(90vh,980px)] md:w-[min(90vw,700px)] md:-translate-x-1/2 md:rounded-3xl md:border"
            onTouchStart={(event) => {
              sheetTouchStartYRef.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              const startY = sheetTouchStartYRef.current;
              const endY = event.changedTouches[0]?.clientY ?? null;
              sheetTouchStartYRef.current = null;
              if (startY === null || endY === null) return;
              if (endY - startY > 70) {
                onClose();
              }
            }}
          >
            <div className="mx-auto flex h-full w-full max-w-[1260px] flex-col px-4 pb-4 pt-3 sm:px-6 md:px-7 md:pb-6 md:pt-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#4a5156] bg-[#212529]/90 text-slate-200 transition hover:border-[#1db954] hover:text-white"
                  aria-label={t("player.close")}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M5 8.2L10 12.8l5-4.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <p className="max-w-[68%] truncate text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  {visualTrack.artistName}
                </p>
                <button
                  type="button"
                  onClick={handleRefreshPlayback}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#4a5156] bg-[#212529]/90 text-slate-200 transition hover:border-[#1db954] hover:text-white"
                  aria-label={t("player.refresh")}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 ${syncingPlayback ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  >
                    <path
                      d="M15.6 10a5.6 5.6 0 11-1.4-3.7M15.6 4.8v2.6H13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex min-h-0 flex-1 items-center justify-center md:mt-4 md:items-start">
                <section className="flex h-full w-full max-w-[620px] flex-col px-1 py-2 sm:px-2 sm:py-3 md:h-auto md:max-w-[560px] md:px-1 md:py-1">
                  <div className="relative mx-auto w-full max-w-[min(84vw,42vh)] sm:max-w-[340px] md:max-w-[290px] lg:max-w-[315px]">
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-[#101215] shadow-[0_18px_42px_rgba(0,0,0,0.5)]">
                      {visualTrack.albumImageUrl ? (
                        <Image
                          src={visualTrack.albumImageUrl}
                          alt={visualTrack.name}
                          fill
                          sizes="(min-width: 1024px) 390px, (min-width: 640px) 360px, 84vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-[#83d4bb]">
                          {visualTrack.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <a
                        href={`https://open.spotify.com/track/${visualTrack.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#5a646b] bg-[#161d22]/90 text-slate-200 transition hover:border-[#1db954] hover:text-white"
                        aria-label={t("player.openInSpotify")}
                        title={t("player.openInSpotify")}
                      >
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                          <path
                            d="M4.2 10a5.8 5.8 0 1111.6 0 5.8 5.8 0 01-11.6 0zm2.2-.8c2.6-1 5.5-.8 8 .5m-7.6 2c2.2-.8 4.6-.7 6.6.3m-6.2-4c2.8-1.1 6-.9 8.6.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                          />
                        </svg>
                      </a>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                        <p className="truncate text-sm font-semibold text-white">{visualTrack.name}</p>
                        <p className="truncate text-xs text-slate-200/90">{visualTrack.artistName}</p>
                      </div>
                    </div>
                  </div>

                  {isPremium ? (
                    <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between gap-3 md:mt-4 md:flex-none md:justify-start md:gap-4">
                      <div className="space-y-1.5 md:mx-auto md:w-full md:max-w-[520px]">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(durationMs, 1)}
                          step={500}
                          value={progressMs}
                          onChange={(event) => {
                            handleSeek(Number(event.target.value));
                          }}
                          disabled={controlsDisabled}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#545b61] accent-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-55"
                          aria-label={t("player.controlRemote")}
                        />
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span>{formatMilliseconds(progressMs)}</span>
                          <span>{formatMilliseconds(durationMs)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-0.5 md:px-3">
                        <button
                          type="button"
                          onClick={() => {
                            void handleToggleShuffle();
                          }}
                          disabled={controlsDisabled}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9 ${
                            shuffleEnabled
                              ? "border-[#1db954] bg-[#113126] text-[#8fe8bb]"
                              : "border-[#4f585e] bg-[#1a1f24] text-slate-300 hover:border-[#1db954] hover:text-white"
                          }`}
                          aria-label={t("player.shuffle")}
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true">
                            <path
                              d="M2.5 5.8h2.9c1.2 0 2.3.5 3.1 1.4l5 5.6c.7.8 1.8 1.2 2.9 1.2h1.1M13.8 4.2h3.7v3.7M2.5 14.2h2.9c1.2 0 2.3-.5 3.1-1.4l1.6-1.8M13.8 15.8h3.7v-3.7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handlePreviousTrack();
                          }}
                          disabled={controlsDisabled}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-100 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                          aria-label={t("player.previous")}
                        >
                          <svg viewBox="0 0 20 20" className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true">
                            <path
                              d="M11.8 5.2L6.9 10l4.9 4.8M6.8 5.2v9.6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleTogglePlay();
                          }}
                          disabled={controlsDisabled}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f3f6f7] text-[#121418] shadow-xl shadow-black/45 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
                          aria-label={isPlaying ? t("player.pause") : t("player.play")}
                        >
                          {isPlaying ? (
                            <svg viewBox="0 0 20 20" className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true">
                              <path d="M7.1 5.2h2.6v9.6H7.1zM10.3 5.2h2.6v9.6h-2.6z" fill="currentColor" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true">
                              <path d="M7.2 4.9L14.8 10l-7.6 5.1V4.9z" fill="currentColor" />
                            </svg>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleNextTrack();
                          }}
                          disabled={controlsDisabled}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-100 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                          aria-label={t("player.next")}
                        >
                          <svg viewBox="0 0 20 20" className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true">
                            <path
                              d="M8.2 5.2l4.9 4.8-4.9 4.8M13.2 5.2v9.6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleCycleRepeat();
                          }}
                          disabled={controlsDisabled}
                          className={`inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full border px-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:min-w-9 sm:px-2 sm:text-[10px] ${
                            repeatMode !== "off"
                              ? "border-[#1db954] bg-[#113126] text-[#8fe8bb]"
                              : "border-[#4f585e] bg-[#1a1f24] text-slate-300 hover:border-[#1db954] hover:text-white"
                          }`}
                          aria-label={t("player.repeat")}
                          title={t("player.repeat")}
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                            <path
                              d="M4 6h9.2c1.8 0 3.2 1.4 3.2 3.2V10M16 14H6.8C5 14 3.6 12.6 3.6 10.8V10M15 4.6L16.8 6 15 7.4M5 12.6L3.2 14 5 15.4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {repeatMode === "track" ? <span>1</span> : null}
                        </button>
                      </div>

                      <div className="space-y-2 md:mx-auto md:w-full md:max-w-[520px]">
                        <SpotifyDeviceChipSelector
                          activeDeviceId={activeDeviceId}
                          activeDeviceName={activeDeviceName}
                          devices={availableDevices}
                          disabled={controlsDisabled}
                          onOpenDevicePicker={handleOpenDevicePicker}
                        />
                        <p className="truncate text-xs text-slate-400">{statusText}</p>
                        {error ? (
                          <p className="rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-100">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      {t("player.premiumRequired")}
                    </div>
                  )}
                </section>
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
        syncing={syncingPlayback}
        activeDeviceId={activeDeviceId}
        activeDeviceName={activeDeviceName}
        devices={availableDevices}
        deviceName={activeDeviceName}
        positionMs={positionMs}
        durationMs={durationMs}
        volumePercent={volumePercent}
        onTogglePlay={handleTogglePlay}
        onPreviousTrack={handlePreviousTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onOpenDevicePicker={handleOpenDevicePicker}
        onOpenModal={onOpen}
      />

      <SpotifyDevicePickerModal
        isOpen={isDevicePickerOpen}
        activeDeviceId={activeDeviceId}
        devices={availableDevices}
        disabled={controlsDisabled}
        onClose={handleCloseDevicePicker}
        onSelectDevice={handleSelectDeviceFromPicker}
      />
    </>
  );
}
