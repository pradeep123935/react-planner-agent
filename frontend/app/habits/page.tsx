"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Droplet,
  Dumbbell,
  Edit3,
  Flame,
  HeartPulse,
  Loader2,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";

type HabitCategory = "health" | "learning" | "mindfulness" | "productivity" | "personal" | "other";
type HabitFrequency = "daily" | "weekly";
type HabitStatus = "active" | "paused" | "archived";

type Habit = {
  id: string;
  title: string;
  description?: string | null;
  category: HabitCategory;
  frequency: HabitFrequency;
  target: number;
  unit: string;
  color: string;
  icon: string;
  status: HabitStatus;
  completed_dates: string[];
  created_at: string;
  updated_at: string;
};

const iconOptions = [
  { id: "check", label: "Check", icon: CheckCircle2 },
  { id: "sparkles", label: "Mindful", icon: Sparkles },
  { id: "book", label: "Read", icon: BookOpen },
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "water", label: "Water", icon: Droplet },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "learn", label: "Learn", icon: Brain },
  { id: "target", label: "Target", icon: Target },
];

const colors = ["#7C3AED", "#3B82F6", "#22C55E", "#14B8A6", "#F59E0B", "#EC4899"];
const tabs: Array<"all" | "active" | "paused"> = ["all", "active", "paused"];

const emptyForm = {
  title: "",
  description: "",
  category: "other" as HabitCategory,
  frequency: "daily" as HabitFrequency,
  target: 1,
  unit: "times",
  color: "#7C3AED",
  icon: "check",
  status: "active" as HabitStatus,
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-app-border bg-app-panel shadow-[0_16px_50px_rgba(0,0,0,0.14)] ${className}`}>
      {children}
    </section>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getIcon(iconId: string) {
  return iconOptions.find((item) => item.id === iconId)?.icon ?? CheckCircle2;
}

function getCurrentStreak(habit: Habit) {
  const done = new Set(habit.completed_dates);
  let streak = 0;
  let cursor = new Date();

  while (done.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(new Date(), index - 6)));
}

function getCompletionRate(habits: Habit[]) {
  const activeHabits = habits.filter((habit) => habit.status === "active");
  if (activeHabits.length === 0) return 0;
  const days = getLastSevenDays();
  const possible = activeHabits.length * days.length;
  const completed = activeHabits.reduce((total, habit) => total + days.filter((day) => habit.completed_dates.includes(day)).length, 0);
  return Math.round((completed / possible) * 100);
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "paused">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();

  const loadHabits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/habits", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load habits");
      const data = (await response.json()) as Habit[];
      setHabits(data);
    } catch {
      setError("Could not load habits. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHabits();
  }, [loadHabits]);

  const filteredHabits = useMemo(() => {
    const term = query.trim().toLowerCase();
    return habits.filter((habit) => {
      const matchesTab = activeTab === "all" || habit.status === activeTab;
      const matchesSearch = !term || `${habit.title} ${habit.description ?? ""} ${habit.category}`.toLowerCase().includes(term);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, habits, query]);

  const activeHabits = habits.filter((habit) => habit.status === "active");
  const completionRate = getCompletionRate(habits);
  const totalCompletions = habits.reduce((total, habit) => total + habit.completed_dates.length, 0);
  const bestStreak = habits.reduce((best, habit) => Math.max(best, getCurrentStreak(habit)), 0);
  const todayCompleted = activeHabits.filter((habit) => habit.completed_dates.includes(today)).length;
  const topStreaks = [...habits].sort((a, b) => getCurrentStreak(b) - getCurrentStreak(a)).slice(0, 4);
  const heatmapDays = Array.from({ length: 35 }, (_, index) => dateKey(addDays(new Date(), index - 34)));

  function startCreate() {
    setEditingHabitId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(habit: Habit) {
    setEditingHabitId(habit.id);
    setForm({
      title: habit.title,
      description: habit.description ?? "",
      category: habit.category,
      frequency: habit.frequency,
      target: habit.target,
      unit: habit.unit,
      color: habit.color,
      icon: habit.icon,
      status: habit.status,
    });
    setShowForm(true);
  }

  async function saveHabit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(editingHabitId ? `/api/habits/${editingHabitId}` : "/api/habits", {
        method: editingHabitId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to save habit");
      }
      const saved = (await response.json()) as Habit;
      setHabits((current) => editingHabitId ? current.map((habit) => habit.id === saved.id ? saved : habit) : [saved, ...current]);
      setShowForm(false);
      setEditingHabitId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save habit");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleToday(habit: Habit) {
    const completed = !habit.completed_dates.includes(today);
    try {
      const response = await fetch(`/api/habits/${habit.id}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, completed }),
      });
      if (!response.ok) throw new Error("Failed to update habit");
      const updated = (await response.json()) as Habit;
      setHabits((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setError("Could not update today's habit.");
    }
  }

  async function archiveHabit(habit: Habit) {
    const confirmed = window.confirm(`Delete "${habit.title}"?`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete habit");
      setHabits((current) => current.filter((item) => item.id !== habit.id));
    } catch {
      setError("Could not delete habit.");
    }
  }

  return (
    <div className="min-h-screen min-w-0 space-y-5 text-app-primary">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Habits</h1>
          <p className="mt-1 text-base text-app-muted">Build consistency and track daily progress.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-full border border-app-border bg-app-input pl-10 pr-4 text-sm outline-none placeholder:text-app-subtle focus:border-[#7C3AED]" placeholder="Search habits..." />
          </div>
          <button onClick={startCreate} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-5 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 sm:w-auto">
            <Plus className="h-4 w-4" />
            New Habit
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Habits", value: activeHabits.length, sub: `${habits.length} total`, icon: CheckCircle2, color: "#7C3AED" },
          { label: "Today Done", value: `${todayCompleted}/${activeHabits.length}`, sub: "Completed today", icon: Target, color: "#3B82F6" },
          { label: "Completion Rate", value: `${completionRate}%`, sub: "Last 7 days", icon: Flame, color: "#22C55E" },
          { label: "Best Streak", value: `${bestStreak} days`, sub: `${totalCompletions} completions`, icon: Sparkles, color: "#F59E0B" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Panel key={stat.label} className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: stat.color }}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-app-muted">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-sm text-app-subtle">{stat.sub}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </section>

      {showForm && (
        <Panel className="p-4 sm:p-6">
          <form onSubmit={(event) => void saveHabit(event)} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">{editingHabitId ? "Edit habit" : "Create habit"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border text-app-muted hover:bg-app-soft" aria-label="Close form">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-app-muted">Habit name</span>
                <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="Morning walk" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-app-muted">Category</span>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as HabitCategory })} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                  {["health", "learning", "mindfulness", "productivity", "personal", "other"].map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="block lg:col-span-2">
                <span className="text-sm font-medium text-app-muted">Description</span>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-app-border bg-app-input px-3 py-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="What should this habit help you do?" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-app-muted">Frequency</span>
                <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as HabitFrequency })} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                </select>
              </label>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-app-muted">Target</span>
                  <input type="number" min={1} max={100} value={form.target} onChange={(event) => setForm({ ...form, target: Number(event.target.value) })} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-app-muted">Unit</span>
                  <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="minutes" />
                </label>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-app-muted">Icon</p>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {iconOptions.map(({ id, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setForm({ ...form, icon: id })} className={`flex h-10 items-center justify-center rounded-lg border ${form.icon === id ? "border-[#7C3AED] bg-[#7C3AED]/15 text-[#7C3AED]" : "border-app-border text-app-muted hover:bg-app-soft"}`}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-app-muted">Color</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button key={color} type="button" onClick={() => setForm({ ...form, color })} className={`h-10 w-10 rounded-lg border-2 ${form.color === color ? "border-app-primary" : "border-transparent"}`} style={{ backgroundColor: color }} aria-label={`Use color ${color}`} />
                  ))}
                </div>
              </div>
            </div>

            <button disabled={isSaving} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingHabitId ? "Save habit" : "Create habit"}
            </button>
          </form>
        </Panel>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-app-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Habit List</h2>
            <div className="flex overflow-x-auto rounded-lg border border-app-border bg-app-elevated text-sm text-app-muted">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`min-w-24 px-4 py-2 capitalize ${activeTab === tab ? "bg-[#4F3ACD] text-white" : "hover:bg-app-soft"}`}>{tab}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-app-border">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-app-muted" /></div>
            ) : filteredHabits.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[#7C3AED]" />
                <p className="mt-4 font-semibold">No habits yet</p>
                <p className="mt-2 text-sm text-app-muted">Create one habit and start tracking today.</p>
              </div>
            ) : filteredHabits.map((habit) => {
              const Icon = getIcon(habit.icon);
              const doneToday = habit.completed_dates.includes(today);
              const streak = getCurrentStreak(habit);
              return (
                <div key={habit.id} className="grid gap-4 p-4 md:grid-cols-[48px_minmax(0,1fr)_100px_120px_112px] md:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: habit.color }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{habit.title}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-app-muted">{habit.description || `${habit.target} ${habit.unit} ${habit.frequency}`}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-app-soft px-2 py-1 text-app-muted">{habit.category}</span>
                      <span className="rounded-md bg-app-soft px-2 py-1 text-app-muted">{habit.status}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{streak} days</p>
                    <p className="text-app-muted">streak</p>
                  </div>
                  <button onClick={() => void toggleToday(habit)} className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${doneToday ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" : "border-app-border text-app-muted hover:bg-app-soft"}`}>
                    {doneToday && <Check className="h-4 w-4" />}
                    {doneToday ? "Done" : "Mark done"}
                  </button>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button onClick={() => startEdit(habit)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border text-app-muted hover:bg-app-soft" aria-label="Edit habit"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => void archiveHabit(habit)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border text-rose-500 hover:bg-rose-500/10" aria-label="Delete habit"><Trash2 className="h-4 w-4" /></button>
                    <MoreHorizontal className="hidden h-5 w-5 text-app-subtle md:block" />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-semibold">Today&apos;s Habits</h2>
          <div className="mt-5 space-y-3">
            {activeHabits.length === 0 ? (
              <p className="text-sm text-app-muted">No active habits yet.</p>
            ) : activeHabits.map((habit) => {
              const Icon = getIcon(habit.icon);
              const doneToday = habit.completed_dates.includes(today);
              return (
                <button key={habit.id} onClick={() => void toggleToday(habit)} className="flex w-full items-center gap-3 rounded-lg border border-app-border bg-app-elevated/70 p-3 text-left hover:bg-app-soft">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: habit.color }}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{habit.title}</span>
                    <span className="text-sm text-app-muted">{habit.target} {habit.unit}</span>
                  </span>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${doneToday ? "border-emerald-500 bg-emerald-500 text-white" : "border-app-border"}`}>
                    {doneToday && <Check className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">Activity</h2>
            <span className="text-sm text-app-muted">Last 35 days</span>
          </div>
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-[repeat(35,minmax(0,1fr))]">
            {heatmapDays.map((day) => {
              const count = habits.filter((habit) => habit.completed_dates.includes(day)).length;
              const opacity = activeHabits.length ? Math.max(0.12, count / activeHabits.length) : 0.12;
              return (
                <span key={day} title={`${day}: ${count} completed`} className="h-8 rounded-md border border-app-border" style={{ backgroundColor: count ? `rgba(124, 58, 237, ${opacity})` : "var(--app-soft)" }} />
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-5 font-semibold">Top Streaks</h2>
          <div className="space-y-3">
            {topStreaks.length === 0 ? <p className="text-sm text-app-muted">No streaks yet.</p> : topStreaks.map((habit) => (
              <p key={habit.id} className="flex items-center justify-between rounded-lg bg-app-soft px-3 py-2 text-sm">
                <span className="truncate">{habit.title}</span>
                <span className="shrink-0 text-app-muted">{getCurrentStreak(habit)} days</span>
              </p>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
