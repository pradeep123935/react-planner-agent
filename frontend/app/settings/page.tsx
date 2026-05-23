"use client";

import React from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Mail, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { useTheme } from "@/app/components/ThemeProvider";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-app-border bg-app-panel shadow-[0_16px_50px_rgba(0,0,0,0.14)] ${className}`}>
      {children}
    </section>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-app-border bg-app-elevated/70 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-app-subtle">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-app-primary">{value}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const displayName = session?.user?.name ?? "FlowPlan User";
  const displayEmail = session?.user?.email ?? "Signed in";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen min-w-0 space-y-5 text-app-primary">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-base text-app-muted">Manage your account and app appearance.</p>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-5">
          <Panel className="p-4 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E0F2FE] to-[#7DD3FC] text-xl font-bold text-[#0F172A]">
                {initials || "FP"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-app-muted">Signed in as</p>
                <h2 className="mt-1 truncate text-2xl font-semibold">{status === "loading" ? "Loading..." : displayName}</h2>
                <p className="mt-1 truncate text-sm text-app-muted">{displayEmail}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <InfoRow icon={User} label="Name" value={displayName} />
              <InfoRow icon={Mail} label="Email" value={displayEmail} />
              <InfoRow icon={ShieldCheck} label="Authentication" value="Email and password" />
              <InfoRow icon={theme === "dark" ? Moon : Sun} label="Theme" value={theme === "dark" ? "Dark mode" : "Light mode"} />
            </div>
          </Panel>

          <Panel className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Theme</h2>
                <p className="mt-1 text-sm text-app-muted">Switch between light and dark mode for the whole app.</p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex h-12 w-full items-center justify-between rounded-lg border border-app-border bg-app-elevated px-4 text-sm font-semibold text-app-primary transition hover:bg-app-soft sm:w-56"
                aria-label="Toggle theme"
              >
                <span className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-4 w-4 text-[#A78BFA]" /> : <Sun className="h-4 w-4 text-amber-500" />}
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
                <span className={`flex h-6 w-11 items-center rounded-full p-1 transition ${theme === "dark" ? "bg-[#6D38E8]" : "bg-slate-300"}`}>
                  <span className={`h-4 w-4 rounded-full bg-white transition ${theme === "dark" ? "translate-x-5" : ""}`} />
                </span>
              </button>
            </div>
          </Panel>
        </main>

        <Panel className="self-start p-4 sm:p-6">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
            <h2 className="text-lg font-semibold text-app-primary">Session</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">Log out from this browser when you are done working.</p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
