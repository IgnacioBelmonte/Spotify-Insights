"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync/recently-played", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
      });

      const json = await res.json();

      if (!res.ok) {
        setResult(JSON.stringify(json));
      } else {
        setResult(JSON.stringify(json));
      }
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok) {
          if (active) setUserName(null);
          return;
        }
        const json = await res.json();
        if (!active) return;
        const user = json?.user;
        setUserName(user?.displayName ?? null);
        setUserAvatar(user?.imageUrl ?? null);
      } catch (e) {
        console.error("/api/auth/session error:", e);
        if (active) setUserName(null);
      } finally {
        if (active) setSessionLoading(false);
      }
    }
    fetchSession();
    setMounted(true);

    // Check for auth error in URL query params
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setAuthError(decodeURIComponent(error));
    }

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-linear-to-b from-[#06151a] via-[#0b1f2a] to-[#0a0f14] text-[#e6f3f1] flex items-center justify-center p-6" suppressHydrationWarning>
      <div className="max-w-3xl w-full">
        <div className="bg-[#0f1b24]/75 backdrop-blur-md border border-[#1b3a40] rounded-2xl p-8 shadow-xl shadow-emerald-500/10">
          {authError && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-200 text-sm">
              <p className="font-semibold">Authentication Error</p>
              <p className="mt-1">{authError}</p>
              <button
                onClick={() => setAuthError(null)}
                className="mt-2 text-xs underline hover:text-red-100"
              >
                Dismiss
              </button>
            </div>
          )}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/spotify-insights-logo.svg"
                alt="Spotify Insights logo"
                width={44}
                height={44}
                priority
                className="rounded-2xl shadow-md shadow-emerald-500/20"
              />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Spotify Insights</h1>
                <p className="text-slate-300 mt-1">Your listening analytics, powered by Spotify.</p>
              </div>
            </div>
            <nav className="flex items-center gap-3">
              {!mounted || sessionLoading ? (
                <div className="text-sm text-slate-300">Checking session...</div>
              ) : userName ? (
                <div className="flex items-center gap-3">
                  {userAvatar ? (
                    <Image src={userAvatar} alt={userName ?? "avatar"} width={32} height={32} className="rounded-full object-cover border border-[#1b3a40]" />
                  ) : null}
                  <span className="text-sm text-slate-200">Logged in as <strong className="text-white">{userName}</strong></span>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#12323a] hover:bg-[#19424b] rounded-md text-sm font-medium border border-[#1b3a40] text-[#dff7f2]"
                  >
                    Dashboard
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
                        if (res.redirected) {
                          window.location.href = res.url;
                        } else if (res.ok) {
                          setUserName(null);
                          setUserAvatar(null);
                          window.location.href = "/";
                        }
                      } catch (err) {
                        console.error("Logout failed:", err);
                      }
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#14f1b2] hover:bg-[#5bf2c6] text-[#04221d] rounded-md text-sm font-semibold shadow-md shadow-emerald-500/20"
                >
                  Login with Spotify
                </a>
              )}
            </nav>
          </header>

          <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-2 bg-[#111f2a]/70 rounded-lg p-4 border border-[#1b3a40]">
              <h2 className="text-lg font-semibold">Quick Sync</h2>
              <p className="text-slate-300 text-sm mt-1">Fetch your latest recently played tracks and store them locally for analysis.</p>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleSync}
                  className="px-4 py-2 bg-[#1dd6a7] hover:bg-[#35e6b9] text-[#04221d] rounded-md font-semibold disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Syncing..." : "Sync Recently Played"}
                </button>

                <button
                  onClick={() => {
                    setResult(null);
                  }}
                  className="px-3 py-2 border border-[#2b4a50] rounded-md text-sm text-slate-200 hover:border-[#3a5c61]"
                >
                  Clear
                </button>
              </div>

              <div className="mt-4">
                <label className="text-sm text-slate-400">Result</label>
                <div className="mt-2 bg-black/40 p-3 rounded-md text-xs font-mono max-h-48 overflow-auto text-slate-200 border border-[#15252b]">
                  {result ? <pre className="whitespace-pre-wrap">{result}</pre> : <span className="text-slate-500">No results yet.</span>}
                </div>
              </div>
            </div>

            <aside className="bg-[#111f2a]/70 rounded-lg p-4 border border-[#1b3a40]">
              <h3 className="text-md font-semibold">Shortcuts</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>
                  <a href="/dashboard" className="text-[#9ef3d4] hover:underline">Open Dashboard</a>
                </li>
                <li>
                  <a href="/api/auth/login" className="text-[#f8c64a] hover:underline">Start OAuth Login</a>
                </li>
                <li>
                  <button onClick={handleSync} className="text-slate-200 hover:underline">Run Sync</button>
                </li>
              </ul>
            </aside>
          </section>

          <footer className="mt-6 text-xs text-slate-400">&copy; {new Date().getFullYear()} Spotify Insights — Sync will use your current session cookie.</footer>
        </div>
      </div>
    </main>
  );
}
