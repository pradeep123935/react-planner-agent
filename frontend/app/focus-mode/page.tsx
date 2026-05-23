"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Clock3,
  Coffee,
  Flame,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Target,
  Timer,
  Trophy,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  project_title: string;
  goal_title: string;
  estimated_minutes?: number | null;
};

type FocusSession = {
  id: string;
  task_id?: string | null;
  task_title: string;
  duration_minutes: number;
  completed_minutes: number;
  status: "completed" | "stopped";
  notes?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
};

const durations = [15, 25, 45, 60];

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-app-border bg-app-panel shadow-[0_16px_50px_rgba(0,0,0,0.14)] ${className}`}>{children}</section>;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function FocusModePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("Deep work");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completionHandledRef = useRef(false);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const totalSeconds = durationMinutes * 60;
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  const circumference = 829;
  const today = todayKey();
  const todaysSessions = sessions.filter((session) => session.created_at.slice(0, 10) === today);
  const todaysMinutes = todaysSessions.reduce((total, session) => total + session.completed_minutes, 0);
  const completedSessions = sessions.filter((session) => session.status === "completed").length;
  const averageSession = completedSessions
    ? Math.round(sessions.filter((session) => session.status === "completed").reduce((total, session) => total + session.completed_minutes, 0) / completedSessions)
    : 0;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksResponse, sessionsResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/focus-sessions", { cache: "no-store" }),
      ]);
      if (!tasksResponse.ok) throw new Error("Failed to load tasks");
      if (!sessionsResponse.ok) throw new Error("Failed to load focus sessions");
      const taskData = ((await tasksResponse.json()) as Task[]).filter((task) => task.status !== "done");
      const sessionData = (await sessionsResponse.json()) as FocusSession[];
      setTasks(taskData);
      setSessions(sessionData);
      if (taskData.length > 0) {
        setSelectedTaskId((current) => current || taskData[0].id);
      }
    } catch {
      setError("Could not load focus mode data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const saveSession = useCallback(async (status: "completed" | "stopped", secondsWorked: number) => {
    const completedMinutes = Math.max(1, Math.round(secondsWorked / 60));
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/focus-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: selectedTask?.id ?? null,
          task_title: selectedTask?.title ?? customTitle,
          duration_minutes: durationMinutes,
          completed_minutes: completedMinutes,
          status,
          notes: notes || null,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to save focus session");
      }
      const saved = (await response.json()) as FocusSession;
      setSessions((current) => [saved, ...current]);
      if (status === "completed" && selectedTask) {
        await fetch(`/api/tasks/${selectedTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        }).catch(() => null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save focus session.");
    } finally {
      setIsSaving(false);
    }
  }, [customTitle, durationMinutes, notes, selectedTask, startedAt]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (remainingSeconds !== 0 || !isRunning || completionHandledRef.current) return;
    completionHandledRef.current = true;
    setIsRunning(false);
    void saveSession("completed", totalSeconds);
  }, [isRunning, remainingSeconds, saveSession, totalSeconds]);

  function startTimer() {
    if (remainingSeconds === 0) {
      setRemainingSeconds(durationMinutes * 60);
    }
    setStartedAt((current) => current ?? new Date().toISOString());
    setIsRunning(true);
  }

  function changeDuration(duration: number) {
    setDurationMinutes(duration);
    if (!isRunning) {
      setRemainingSeconds(duration * 60);
      completionHandledRef.current = false;
      setStartedAt(null);
    }
  }

  function pauseTimer() {
    setIsRunning(false);
  }

  function resetTimer() {
    setIsRunning(false);
    setRemainingSeconds(durationMinutes * 60);
    setStartedAt(null);
    completionHandledRef.current = false;
  }

  async function stopTimer() {
    setIsRunning(false);
    const worked = elapsedSeconds;
    resetTimer();
    if (worked >= 60) {
      await saveSession("stopped", worked);
    }
  }

  async function skipSession() {
    setIsRunning(false);
    setRemainingSeconds(0);
    if (!completionHandledRef.current) {
      completionHandledRef.current = true;
      await saveSession("completed", totalSeconds);
    }
  }

  const playlist = useMemo(() => tasks.slice(0, 6), [tasks]);

  return (
    <div className="grid min-h-screen min-w-0 gap-4 text-app-primary 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:gap-5">
      <main className="min-w-0 space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Focus Mode</h1>
            <p className="mt-1 text-base text-app-muted">Choose a task, start a timer, and save focused work sessions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {durations.map((duration) => (
              <button key={duration} onClick={() => changeDuration(duration)} disabled={isRunning} className={`h-10 rounded-lg border px-4 text-sm font-semibold ${durationMinutes === duration ? "border-[#7C3AED] bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA]" : "border-app-border bg-app-elevated text-app-muted hover:bg-app-soft"}`}>
                {duration}m
              </button>
            ))}
          </div>
        </header>

        {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300">{error}</div>}

        <Panel className="relative min-h-[520px] overflow-hidden p-4 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.16),transparent_42%)]" />
          <div className="relative flex min-h-[480px] flex-col items-center justify-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#7C3AED]/15 px-4 py-2 text-sm text-[#7C3AED] dark:text-[#A78BFA]">
              <Timer className="h-4 w-4" />
              {selectedTask?.title ?? customTitle}
            </span>
            <div className="relative h-64 w-64 sm:h-80 sm:w-80">
              <svg className="h-64 w-64 -rotate-90 sm:h-80 sm:w-80" viewBox="0 0 320 320" aria-hidden="true">
                <circle cx="160" cy="160" r="132" fill="none" stroke="currentColor" strokeWidth="16" className="text-app-border" />
                <circle cx="160" cy="160" r="132" fill="none" stroke="#6D38E8" strokeWidth="16" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-semibold tracking-tight sm:text-7xl">{formatSeconds(remainingSeconds)}</span>
                <span className="mt-4 text-base text-app-secondary sm:text-lg">{isRunning ? "Stay focused" : "Ready when you are"}</span>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {isRunning ? (
                <button onClick={pauseTimer} className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full bg-[#6D38E8] px-5 text-sm font-semibold text-white"><Pause className="h-5 w-5" />Pause</button>
              ) : (
                <button onClick={startTimer} className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full bg-[#6D38E8] px-5 text-sm font-semibold text-white"><Play className="h-5 w-5 fill-white" />Start</button>
              )}
              <button onClick={() => void skipSession()} disabled={isSaving} className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full border border-app-border bg-app-elevated px-5 text-sm font-semibold"><SkipForward className="h-5 w-5" />Complete</button>
              <button onClick={() => void stopTimer()} disabled={isSaving} className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full border border-app-border bg-app-elevated px-5 text-sm font-semibold"><Square className="h-5 w-5" />Stop</button>
              <button onClick={resetTimer} className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full border border-app-border bg-app-elevated px-5 text-sm font-semibold"><RotateCcw className="h-5 w-5" />Reset</button>
            </div>
            {isSaving && <p className="mt-4 flex items-center gap-2 text-sm text-app-muted"><Loader2 className="h-4 w-4 animate-spin" />Saving session...</p>}
          </div>
        </Panel>

        <section className="grid gap-4 xl:grid-cols-3">
          {[
            ["Today's Focus", `${todaysMinutes}m`, Target],
            ["Completed Sessions", completedSessions.toString(), Trophy],
            ["Avg. Session Time", `${averageSession}m`, BarChart3],
          ].map(([label, value, Icon]) => (
            <Panel key={label as string} className="p-5">
              <Icon className="h-8 w-8 rounded-full bg-app-soft p-2 text-[#7C3AED]" />
              <p className="mt-4 text-sm text-app-muted">{label as string}</p>
              <p className="mt-1 text-3xl font-semibold">{value as string}</p>
            </Panel>
          ))}
        </section>
      </main>

      <aside className="space-y-4">
        <Panel className="p-5">
          <h2 className="mb-4 font-semibold">Focus Target</h2>
          <label className="block">
            <span className="text-sm font-medium text-app-muted">Task</span>
            <select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
              <option value="">No task, custom focus</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          </label>
          {!selectedTask && (
            <label className="mt-4 block">
              <span className="text-sm font-medium text-app-muted">Custom title</span>
              <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" />
            </label>
          )}
          <label className="mt-4 block">
            <span className="text-sm font-medium text-app-muted">Session notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-app-border bg-app-input px-3 py-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="What did you work on?" />
          </label>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 font-semibold">Session Playlist</h2>
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-app-muted" /></div>
            ) : playlist.length === 0 ? (
              <p className="text-sm leading-6 text-app-muted">No open tasks yet. You can still run a custom focus session.</p>
            ) : playlist.map((task) => {
              const active = selectedTaskId === task.id;
              return (
                <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`grid w-full grid-cols-[42px_1fr_46px] items-center gap-3 rounded-lg border p-3 text-left ${active ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-app-border bg-app-elevated hover:bg-app-soft"}`}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED]">
                    {active ? <Play className="h-4 w-4 fill-white text-white" /> : <Clock3 className="h-4 w-4 text-white" />}
                  </div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 truncate text-xs text-app-muted">{task.project_title}</p></div>
                  <span className="text-sm text-app-muted">{task.estimated_minutes ?? durationMinutes}m</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-2"><Flame className="h-5 w-5 text-[#A855F7]" /><h2 className="font-semibold">Recent Sessions</h2></div>
          <div className="space-y-2">
            {sessions.slice(0, 5).length === 0 ? (
              <p className="text-sm leading-6 text-app-muted">Completed focus sessions will appear here.</p>
            ) : sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg bg-app-soft px-3 py-2 text-sm">
                <span className="truncate">{session.task_title}</span>
                <span className="shrink-0 text-app-muted">{session.completed_minutes}m</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2"><Coffee className="h-5 w-5 text-[#A855F7]" /><h2 className="font-semibold">Focus Tip</h2></div>
          <p className="text-sm leading-6 text-app-muted">Pick one task before starting. When the timer is running, treat anything else as a note for later.</p>
        </Panel>
      </aside>
    </div>
  );
}
