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
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-linear-to-b from-black via-slate-900 to-slate-800 text-white flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-lg">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Spotify Insights</h1>
              <p className="text-slate-300 mt-1">Your listening analytics, powered by Spotify.</p>
            </div>
            <nav className="flex items-center gap-3">
              {!mounted || sessionLoading ? (
                <div className="text-sm text-slate-300">Checking session...</div>
              ) : userName ? (
                <div className="flex items-center gap-3">
                  {userAvatar ? (
                    <Image src={userAvatar} alt={userName ?? "avatar"} width={32} height={32} className="rounded-full object-cover border border-slate-600" />
                  ) : null}
                  <span className="text-sm text-slate-200">Logged in as <strong className="text-white">{userName}</strong></span>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm font-medium border border-slate-600"
                  >
                    Dashboard
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
                        if (res.ok) {
                          setUserName(null);
                          setUserAvatar(null);
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-black rounded-md text-sm font-medium"
                >
                  Login with Spotify
                </a>
              )}
            </nav>
          </header>

          <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-2 bg-slate-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold">Quick Sync</h2>
              <p className="text-slate-300 text-sm mt-1">Fetch your latest recently played tracks and store them locally for analysis.</p>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleSync}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-md font-medium disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Syncing..." : "Sync Recently Played"}
                </button>

                <button
                  onClick={() => {
                    setResult(null);
                  }}
                  className="px-3 py-2 border border-slate-600 rounded-md text-sm"
                >
                  Clear
                </button>
              </div>

              <div className="mt-4">
                <label className="text-sm text-slate-400">Result</label>
                <div className="mt-2 bg-black/40 p-3 rounded-md text-xs font-mono max-h-48 overflow-auto text-slate-200">
                  {result ? <pre className="whitespace-pre-wrap">{result}</pre> : <span className="text-slate-500">No results yet.</span>}
                </div>
              </div>
            </div>

            <aside className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-md font-semibold">Shortcuts</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>
                  <a href="/dashboard" className="text-indigo-300 hover:underline">Open Dashboard</a>
                </li>
                <li>
                  <a href="/api/auth/login" className="text-green-300 hover:underline">Start OAuth Login</a>
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