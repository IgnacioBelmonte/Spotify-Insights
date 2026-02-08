"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { SyncWidget } from "@/src/components/SyncWidget";
import { t } from "@/src/lib/i18n";

export default function Home() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok) {
          if (active) {
            setUserName(null);
            setUserAvatar(null);
            setLastSyncedAt(null);
          }
          return;
        }
        const json = await res.json();
        if (!active) return;
        const user = json?.user;
        setUserName(user?.displayName ?? null);
        setUserAvatar(user?.imageUrl ?? null);
        setLastSyncedAt(user?.lastSyncedAt ?? null);
      } catch (e) {
        console.error("/api/auth/session error:", e);
        if (active) {
          setUserName(null);
          setUserAvatar(null);
          setLastSyncedAt(null);
        }
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
    <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.14),_transparent_55%)]" />
      <div className="absolute -top-40 right-[-10%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse-soft" />
      <div
        className="absolute -bottom-48 left-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-soft"
        style={{ animationDelay: "150ms" }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-12">
        <div className="bg-[#0f1b24]/75 backdrop-blur-md border border-[#1b3a40] rounded-3xl p-8 sm:p-10 shadow-2xl shadow-emerald-500/10">
          {authError && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-200 text-sm">
              <p className="font-semibold">{t("home.authErrorTitle")}</p>
              <p className="mt-1">{authError}</p>
              <button
                onClick={() => setAuthError(null)}
                className="mt-2 text-xs underline hover:text-red-100"
              >
                {t("home.authErrorDismiss")}
              </button>
            </div>
          )}

          <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-center">
            <div className="space-y-6 animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                {t("home.badge")}
              </div>
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
                {t("home.heroTitleLine1")}
                <span className="block text-emerald-300">{t("home.heroTitleLine2")}</span>
              </h1>
              <p className="text-slate-300 text-base sm:text-lg max-w-xl">
                {t("home.heroDescription")}
              </p>

              <nav className="flex flex-wrap items-center gap-3">
                {!mounted || sessionLoading ? (
                  <div className="text-sm text-slate-300">{t("common.checkingSession")}</div>
                ) : userName ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {userAvatar ? (
                      <Image
                        src={userAvatar}
                        alt={userName ?? t("common.avatarAlt")}
                        width={36}
                        height={36}
                        className="rounded-full object-cover border border-[#1b3a40]"
                      />
                    ) : null}
                    <span className="text-sm text-slate-200">
                      {t("common.loggedInAs")} <strong className="text-white">{userName}</strong>
                    </span>
                    <a
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#12323a] hover:bg-[#19424b] rounded-full text-sm font-medium border border-[#1b3a40] text-[#dff7f2]"
                    >
                      {t("common.dashboard")}
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
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full text-sm font-medium"
                    >
                      {t("common.logout")}
                    </button>
                  </div>
                ) : (
                  <a
                    href="/api/auth/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#14f1b2] hover:bg-[#5bf2c6] text-[#04221d] rounded-full text-sm font-semibold shadow-lg shadow-emerald-500/30"
                  >
                    {t("common.loginWithSpotify")}
                  </a>
                )}
              </nav>
            </div>

            <div className="relative flex items-center justify-center lg:justify-end animate-float">
              <div className="absolute -inset-8 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="relative flex h-56 w-56 sm:h-72 sm:w-72 items-center justify-center rounded-[2.5rem] border border-[#1b3a40] bg-gradient-to-br from-[#0f2a2f] via-[#0c1f27] to-[#0a141b] shadow-2xl shadow-emerald-500/25">
                <Image
                  src="/spotify-insights-logo.svg"
                  alt={t("common.logoAlt")}
                  width={160}
                  height={160}
                  priority
                  className="drop-shadow-xl"
                />
              </div>
            </div>
          </section>

          <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SyncWidget
                variant="compact"
                initialLastSyncedAt={lastSyncedAt}
                title={t("home.quickSyncTitle")}
                description={t("home.quickSyncDescription")}
              />
            </div>

            <aside className="bg-[#111f2a]/70 rounded-2xl p-6 border border-[#1b3a40] shadow-lg shadow-emerald-500/5">
              <h3 className="text-md font-semibold">{t("common.shortcuts")}</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>
                  <a href="/dashboard" className="text-[#9ef3d4] hover:underline">
                    {t("common.openDashboard")}
                  </a>
                </li>
                <li>
                  <a href="/api/auth/login" className="text-[#f8c64a] hover:underline">
                    {t("common.startOAuth")}
                  </a>
                </li>
              </ul>
            </aside>
          </section>

          <footer className="mt-8 text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {t("home.footer")}
          </footer>
        </div>
      </div>
    </main>
  );
}
