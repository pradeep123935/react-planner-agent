"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "done" | "archived";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type EnergyLevel = "low" | "medium" | "high";
type TaskTab = "All Tasks" | "To Do" | "In Progress" | "Completed" | "Overdue";

type ProjectOption = {
  id: string;
  title: string;
  goal_title: string;
};

type Task = {
  id: string;
  title: string;
  project_id: string;
  project_title: string;
  goal_id: string;
  goal_title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number | null;
  energy_level?: EnergyLevel | null;
  created_at: string;
};

type TaskForm = {
  title: string;
  project_id: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  estimated_minutes: string;
  energy_level: "" | EnergyLevel;
};

const emptyForm: TaskForm = {
  title: "",
  project_id: "",
  description: "",
  priority: "medium",
  status: "todo",
  due_date: "",
  estimated_minutes: "",
  energy_level: "",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Completed",
  archived: "Archived",
};

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300",
  medium: "bg-orange-500/15 text-orange-500 dark:text-orange-300",
  high: "bg-rose-500/15 text-rose-500 dark:text-rose-300",
  urgent: "bg-red-600/15 text-red-500 dark:text-red-300",
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-app-border bg-app-panel shadow-[0_16px_50px_rgba(0,0,0,0.14)] ${className}`}>{children}</section>;
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(task.due_date);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function StatusBadge({ task }: { task: Task }) {
  const label = isOverdue(task) ? "Overdue" : statusLabels[task.status];
  const classes =
    label === "Completed"
      ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300"
      : label === "In Progress"
        ? "bg-blue-500/15 text-blue-500 dark:text-blue-300"
        : label === "Overdue"
          ? "bg-rose-500/15 text-rose-500 dark:text-rose-300"
          : "bg-app-soft text-app-primary";

  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-semibold text-app-secondary">{children}</label>;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TaskTab>("All Tasks");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksResponse, projectsResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);

      if (!tasksResponse.ok || !projectsResponse.ok) throw new Error("Failed to load tasks");
      setTasks(await tasksResponse.json());
      setProjects(await projectsResponse.json());
    } catch {
      setError("Could not load tasks. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQuery = !term || `${task.title} ${task.description ?? ""} ${task.project_title} ${task.goal_title}`.toLowerCase().includes(term);
      const matchesTab =
        activeTab === "All Tasks" ||
        (activeTab === "To Do" && task.status === "todo" && !isOverdue(task)) ||
        (activeTab === "In Progress" && task.status === "in_progress") ||
        (activeTab === "Completed" && task.status === "done") ||
        (activeTab === "Overdue" && isOverdue(task));

      return matchesQuery && matchesTab;
    });
  }, [activeTab, query, tasks]);

  const stats = useMemo(() => {
    const todo = tasks.filter((task) => task.status === "todo" && !isOverdue(task)).length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const completed = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter(isOverdue).length;

    return [
      { label: "All Tasks", value: String(tasks.length), sub: "Total tasks", icon: ClipboardList, color: "#7C3AED" },
      { label: "To Do", value: String(todo), sub: "Not started", icon: Circle, color: "#94A3B8" },
      { label: "In Progress", value: String(inProgress), sub: "Active work", icon: BarChart3, color: "#3B82F6" },
      { label: "Completed", value: String(completed), sub: "Finished", icon: Check, color: "#22C55E" },
      { label: "Overdue", value: String(overdue), sub: "Need attention", icon: AlarmClock, color: "#EF4444" },
    ];
  }, [tasks]);

  function openCreateForm() {
    setEditingTask(null);
    setForm({ ...emptyForm, project_id: projects[0]?.id ?? "" });
    setIsFormOpen(true);
  }

  function openEditForm(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      project_id: task.project_id,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status === "archived" ? "todo" : task.status,
      due_date: task.due_date ?? "",
      estimated_minutes: task.estimated_minutes ? String(task.estimated_minutes) : "",
      energy_level: task.energy_level ?? "",
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingTask(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          project_id: form.project_id,
          description: form.description.trim() || null,
          priority: form.priority,
          status: form.status,
          due_date: form.due_date || null,
          estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
          energy_level: form.energy_level || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to save task");
      }

      const savedTask = (await response.json()) as Task;
      setTasks((current) => editingTask ? current.map((task) => task.id === savedTask.id ? savedTask : task) : [savedTask, ...current]);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTask(task: Task) {
    const confirmed = window.confirm(`Delete "${task.title}"? This will archive the task.`);
    if (!confirmed) return;

    setDeletingTaskId(task.id);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to delete task");
      }
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingTaskId(null);
    }
  }

  return (
    <div className="min-h-screen min-w-0 text-app-primary">
      <main className="min-w-0 space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
            <p className="mt-1 text-base text-app-muted">Create actionable tasks inside your projects.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-lg border border-app-border bg-app-input pl-10 pr-3 text-sm outline-none placeholder:text-app-subtle focus:border-[#7C3AED]" placeholder="Search tasks..." />
            </div>
            <button onClick={openCreateForm} disabled={projects.length === 0} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-4 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
              <Plus className="h-4 w-4" />
              New Task
            </button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300">{error}</div>}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Panel key={stat.label} className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-soft" style={{ color: stat.color }}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm text-app-muted">{stat.label}</p>
                    <p className="mt-1 text-3xl font-semibold leading-none">{stat.value}</p>
                    <p className="mt-2 text-sm text-app-muted">{stat.sub}</p>
                  </div>
                </div>
              </Panel>
            );
          })}
        </section>

        <Panel className="overflow-hidden">
          <div className="flex gap-6 overflow-x-auto border-b border-app-border px-5 py-3 text-sm">
            {(["All Tasks", "To Do", "In Progress", "Completed", "Overdue"] as TaskTab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`relative shrink-0 py-2 transition ${activeTab === tab ? "text-app-primary" : "text-app-muted hover:text-app-primary"}`}>
                {tab}
                {activeTab === tab && <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-[#7C3AED]" />}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-app-muted">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading tasks
            </div>
          ) : projects.length === 0 ? (
            <div className="min-h-64 px-5 py-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-[#7C3AED]" />
              <h2 className="mt-4 text-lg font-semibold">Create a project first</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">Tasks belong to projects, so add at least one project before creating tasks.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="min-h-64 px-5 py-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-[#7C3AED]" />
              <h2 className="mt-4 text-lg font-semibold">{tasks.length === 0 ? "No tasks yet" : "No matching tasks"}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">{tasks.length === 0 ? "Create your first task under a project." : "Try a different tab or search term."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-app-soft text-sm text-app-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium">Estimate</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-t border-app-border bg-app-elevated/30 transition hover:bg-app-soft">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{task.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-app-subtle">{task.description || "No description added."}</p>
                        <p className="mt-2 text-xs text-app-muted">Goal: {task.goal_title}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-app-secondary">{task.project_title}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${priorityColors[task.priority]}`}>{task.priority}</span></td>
                      <td className="px-4 py-4"><StatusBadge task={task} /></td>
                      <td className="px-4 py-4 text-sm text-app-secondary">{task.due_date ? new Date(task.due_date).toLocaleDateString() : "No due date"}</td>
                      <td className="px-4 py-4 text-sm text-app-muted">{task.estimated_minutes ? `${task.estimated_minutes}m` : "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditForm(task)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-elevated text-app-muted transition hover:text-app-primary" aria-label={`Edit ${task.title}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => void deleteTask(task)} disabled={deletingTaskId === task.id} className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-elevated text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-60" aria-label={`Delete ${task.title}`}>
                            {deletingTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <Panel className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{editingTask ? "Edit Task" : "Create Task"}</h2>
                <p className="mt-1 text-sm text-app-muted">Attach the task to a project and define the next action clearly.</p>
              </div>
              <button onClick={closeForm} className="rounded-lg p-2 text-app-subtle transition hover:bg-app-soft hover:text-app-primary" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Task title</FieldLabel>
                <input required minLength={1} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="Solve 2 graph problems" />
              </div>

              <div className="space-y-2">
                <FieldLabel>Project</FieldLabel>
                <div className="relative">
                  <select required value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })} className="h-11 w-full appearance-none rounded-lg border border-app-border bg-app-input px-3 pr-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.title} - {project.goal_title}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Description</FieldLabel>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} maxLength={1000} className="w-full resize-none rounded-lg border border-app-border bg-app-input px-3 py-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="What exactly should be done?" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Priority</FieldLabel>
                  <div className="relative">
                    <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} className="h-11 w-full appearance-none rounded-lg border border-app-border bg-app-input px-3 pr-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Status</FieldLabel>
                  <div className="relative">
                    <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })} className="h-11 w-full appearance-none rounded-lg border border-app-border bg-app-input px-3 pr-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Due date</FieldLabel>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                    <input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Estimate minutes</FieldLabel>
                  <input type="number" min={0} max={1440} value={form.estimated_minutes} onChange={(event) => setForm({ ...form, estimated_minutes: event.target.value })} className="h-11 w-full rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none focus:border-[#7C3AED]" placeholder="60" />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel>Energy level</FieldLabel>
                  <div className="relative">
                    <select value={form.energy_level} onChange={(event) => setForm({ ...form, energy_level: event.target.value as "" | EnergyLevel })} className="h-11 w-full appearance-none rounded-lg border border-app-border bg-app-input px-3 pr-10 text-sm text-app-primary outline-none transition [color-scheme:light] focus:border-[#7C3AED] dark:[color-scheme:dark]">
                      <option value="">Not specified</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} className="h-11 rounded-lg border border-app-border px-5 text-sm font-semibold text-app-secondary">Cancel</button>
                <button disabled={isSaving} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-5 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 disabled:opacity-70">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
