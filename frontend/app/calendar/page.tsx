"use client";

import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { CalendarDays, ChevronDown, Clock3, Loader2, Plus, Trash2, X } from "lucide-react";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location?: string | null;
  category?: string | null;
  color?: string | null;
  task_id?: string | null;
  source: "manual" | "task";
};

type TaskOption = {
  id: string;
  title: string;
  project_title: string;
};

type EventForm = {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  task_id: string;
  color: string;
};

const defaultForm: EventForm = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  task_id: "",
  color: "#6D38E8",
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-app-border bg-app-panel ${className}`}>{children}</section>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-semibold text-app-secondary">{children}</label>;
}

function toDateTimeLocal(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  return new Date(value).toISOString();
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const calendarEvents: EventInput[] = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    allDay: event.is_all_day,
    backgroundColor: event.color ?? "#6D38E8",
    borderColor: event.color ?? "#6D38E8",
    extendedProps: {
      description: event.description,
      taskId: event.task_id,
      source: event.source,
    },
  })), [events]);

  async function loadRange(start: string, end: string) {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsResponse, tasksResponse] = await Promise.all([
        fetch(`/api/calendar-events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ]);

      if (!eventsResponse.ok || !tasksResponse.ok) throw new Error("Failed to load calendar");
      setEvents(await eventsResponse.json());
      setTasks(await tasksResponse.json());
    } catch {
      setError("Could not load calendar events. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDatesSet(info: DatesSetArg) {
    void loadRange(info.start.toISOString(), info.end.toISOString());
  }

  function openCreateForm(selection?: DateSelectArg) {
    const start = selection?.start ?? new Date();
    const end = selection?.end ?? new Date(start.getTime() + 60 * 60_000);
    setEditingEvent(null);
    setForm({
      ...defaultForm,
      start_time: toDateTimeLocal(start),
      end_time: toDateTimeLocal(end),
    });
    setIsFormOpen(true);
  }

  function openEditForm(arg: EventClickArg) {
    const found = events.find((event) => event.id === arg.event.id);
    if (!found) return;
    setEditingEvent(found);
    setForm({
      title: found.title,
      description: found.description ?? "",
      start_time: toDateTimeLocal(found.start_time),
      end_time: toDateTimeLocal(found.end_time),
      task_id: found.task_id ?? "",
      color: found.color ?? "#6D38E8",
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingEvent(null);
    setForm(defaultForm);
  }

  function handleTaskChange(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    setForm((current) => ({
      ...current,
      task_id: taskId,
      title: task && !current.title ? task.title : current.title,
      description: task && !current.description ? `Scheduled work block for ${task.project_title}` : current.description,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_time: toApiDateTime(form.start_time),
        end_time: toApiDateTime(form.end_time),
        is_all_day: false,
        color: form.color,
        task_id: form.task_id || null,
        source: form.task_id ? "task" : "manual",
      };

      const response = await fetch(editingEvent ? `/api/calendar-events/${editingEvent.id}` : "/api/calendar-events", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to save event");
      }

      const savedEvent = (await response.json()) as CalendarEvent;
      setEvents((current) => editingEvent ? current.map((item) => item.id === savedEvent.id ? savedEvent : item) : [...current, savedEvent]);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEvent() {
    if (!editingEvent) return;
    const confirmed = window.confirm(`Delete "${editingEvent.title}" from your calendar?`);
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/calendar-events/${editingEvent.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to delete event");
      }
      setEvents((current) => current.filter((item) => item.id !== editingEvent.id));
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setIsSaving(false);
    }
  }

  const upcoming = events
    .filter((event) => new Date(event.start_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen min-w-0 text-app-primary">
      <main className="min-w-0 space-y-4">
        <header className="flex flex-col gap-3 border-b border-app-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
            <p className="mt-1 text-sm text-app-muted">Schedule work blocks and task sessions.</p>
          </div>
          <button onClick={() => openCreateForm()} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#6D38E8] px-5 text-sm font-semibold text-white shadow-sm shadow-[#7C3AED]/20 sm:w-auto">
            <Plus className="h-4 w-4" />
            Create
          </button>
        </header>

        {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300">{error}</div>}

        <Panel className="calendar-shell overflow-hidden">
          <div className="relative min-h-[720px]">
            {isLoading && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-app-border bg-app-panel px-3 py-2 text-sm text-app-muted shadow">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </div>
            )}
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{
                today: "Today",
                month: "Month",
                week: "Week",
                day: "Day",
              }}
              events={calendarEvents}
              selectable
              editable={false}
              nowIndicator
              height="auto"
              slotMinTime="05:00:00"
              slotMaxTime="23:00:00"
              allDaySlot={false}
              select={openCreateForm}
              eventClick={openEditForm}
              datesSet={handleDatesSet}
            />
          </div>
        </Panel>
      </main>

      <aside className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-[#1A73E8]" />
            <h2 className="text-base font-semibold">Upcoming Events</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm leading-6 text-app-muted">No upcoming events yet. Select a time range on the calendar to schedule one.</p>
          ) : (
            <div className="space-y-4">
              {upcoming.map((item) => (
                <div key={item.id} className="grid grid-cols-[10px_1fr] gap-3 rounded-lg border border-app-border bg-app-elevated/70 p-3">
                  <span className="mt-1 h-10 w-1 rounded-full" style={{ backgroundColor: item.color ?? "#6D38E8" }} />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-app-muted">
                      {new Date(item.start_time).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                    <span className="mt-2 inline-flex rounded-md bg-app-soft px-2 py-1 text-xs text-app-muted">{item.source === "task" ? "Task" : "Manual"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#1A73E8]" />
            <h2 className="text-base font-semibold">Scheduling Tip</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-app-muted">Tasks keep deadlines. Calendar events define when you will work. Link a task when creating an event to schedule a focused work block.</p>
        </Panel>
      </aside>

      {isFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <Panel className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{editingEvent ? "Edit Event" : "Create Event"}</h2>
                <p className="mt-1 text-sm text-app-muted">Create a manual event or link it to a task work block.</p>
              </div>
              <button onClick={closeForm} className="rounded-lg p-2 text-app-subtle transition hover:bg-app-soft hover:text-app-primary" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Linked task</FieldLabel>
                <div className="relative">
                  <select value={form.task_id} onChange={(event) => handleTaskChange(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-app-border bg-app-input px-3 pr-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                    <option value="">Manual event</option>
                    {tasks.map((task) => <option key={task.id} value={task.id}>{task.title} - {task.project_title}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <input required minLength={1} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="Deep work block" />
              </div>

              <div className="space-y-2">
                <FieldLabel>Description</FieldLabel>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} maxLength={1000} className="w-full resize-none rounded-lg border border-app-border bg-app-input px-3 py-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="Optional notes" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Start</FieldLabel>
                  <input required type="datetime-local" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm text-app-primary outline-none [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <FieldLabel>End</FieldLabel>
                  <input required type="datetime-local" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm text-app-primary outline-none [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel>Color</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {["#6D38E8", "#3B82F6", "#22C55E", "#F97316", "#EC4899", "#64748B"].map((color) => (
                      <button key={color} type="button" onClick={() => setForm({ ...form, color })} className={`h-8 w-8 rounded-full border-2 ${form.color === color ? "border-app-primary" : "border-transparent"}`} style={{ backgroundColor: color }} aria-label={`Use color ${color}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                <div>
                  {editingEvent && (
                    <button type="button" onClick={() => void deleteEvent()} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-5 text-sm font-semibold text-rose-500">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={closeForm} className="h-11 rounded-lg border border-app-border px-5 text-sm font-semibold text-app-secondary">Cancel</button>
                  <button disabled={isSaving} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-5 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 disabled:opacity-70">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
