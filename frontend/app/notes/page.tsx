"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bold,
  FileText,
  Folder,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Quote,
  Save,
  Search,
  Star,
  Trash2,
  Underline,
} from "lucide-react";

type Note = {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  is_favorite: boolean;
  status: "active" | "archived" | "trash";
  created_at: string;
  updated_at: string;
};

type NoteFolder = {
  id: string;
  name: string;
};

type FolderNavItem = NoteFolder & {
  icon: React.ElementType;
};

const defaultFolders: NoteFolder[] = [
  { id: "work", name: "Work" },
  { id: "personal", name: "Personal" },
  { id: "ideas", name: "Ideas" },
  { id: "learning", name: "Learning" },
  { id: "journal", name: "Journal" },
  { id: "other", name: "Other" },
];

const emptyDraft = {
  title: "",
  content: "",
  folder: "other",
  tagsText: "",
  is_favorite: false,
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-app-border bg-app-panel shadow-[0_16px_50px_rgba(0,0,0,0.14)] ${className}`}>{children}</section>;
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function stripHtml(value: string) {
  if (typeof window === "undefined") return value;
  const element = document.createElement("div");
  element.innerHTML = value;
  return element.textContent ?? "";
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  const tools = [
    { label: "Bold", icon: Bold, command: "bold" },
    { label: "Italic", icon: Italic, command: "italic" },
    { label: "Underline", icon: Underline, command: "underline" },
    { label: "Heading", icon: Heading2, command: "formatBlock", value: "h2" },
    { label: "Quote", icon: Quote, command: "formatBlock", value: "blockquote" },
    { label: "Bullets", icon: List, command: "insertUnorderedList" },
    { label: "Numbers", icon: ListOrdered, command: "insertOrderedList" },
  ];

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-app-border bg-app-input">
      <div className="flex flex-wrap gap-1 border-b border-app-border bg-app-soft/60 p-2">
        {tools.map(({ label, icon: Icon, command, value: commandValue }) => (
          <button
            key={label}
            type="button"
            onClick={() => runCommand(command, commandValue)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-panel hover:text-app-primary"
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="notes-editor min-h-[500px] overflow-y-auto px-5 py-4 text-base leading-8 outline-none"
        data-placeholder="Start writing..."
      />
    </div>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [customFolders, setCustomFolders] = useState<NoteFolder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folders = useMemo(() => {
    const seen = new Set<string>();
    return [...defaultFolders, ...customFolders].filter((folder) => {
      if (seen.has(folder.id)) return false;
      seen.add(folder.id);
      return true;
    });
  }, [customFolders]);

  const folderNavItems: FolderNavItem[] = useMemo(
    () => [
      { id: "all", name: "All Notes", icon: FileText },
      { id: "favorites", name: "Favorites", icon: Star },
      ...folders.map((folder) => ({ ...folder, icon: Folder })),
    ],
    [folders],
  );

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [notesResponse, foldersResponse] = await Promise.all([
        fetch("/api/notes", { cache: "no-store" }),
        fetch("/api/notes/folders", { cache: "no-store" }),
      ]);
      if (!notesResponse.ok) throw new Error("Failed to load notes");
      if (!foldersResponse.ok) throw new Error("Failed to load folders");

      const notesData = sortNotes((await notesResponse.json()) as Note[]);
      const foldersData = ((await foldersResponse.json()) as NoteFolder[]).sort((a, b) => a.name.localeCompare(b.name));
      setNotes(notesData);
      setCustomFolders(foldersData);
      setSelectedId((currentSelectedId) => {
        if (currentSelectedId || notesData.length === 0) return currentSelectedId;
        const first = notesData[0];
        setDraft({
          title: first.title,
          content: first.content,
          folder: first.folder,
          tagsText: first.tags.join(", "),
          is_favorite: first.is_favorite,
        });
        return first.id;
      });
    } catch {
      setError("Could not load notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotes();
  }, [loadNotes]);

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return notes.filter((note) => {
      const plainContent = stripHtml(note.content).toLowerCase();
      const matchesFolder =
        activeFolder === "all" ||
        (activeFolder === "favorites" && note.is_favorite) ||
        note.folder === activeFolder;
      const matchesQuery = !term || `${note.title} ${plainContent} ${note.tags.join(" ")}`.toLowerCase().includes(term);
      return matchesFolder && matchesQuery;
    });
  }, [activeFolder, notes, query]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: notes.length,
      favorites: notes.filter((note) => note.is_favorite).length,
    };
    for (const folder of folders) counts[folder.id] = notes.filter((note) => note.folder === folder.id).length;
    return counts;
  }, [folders, notes]);

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setDraft({
      title: note.title,
      content: note.content,
      folder: note.folder,
      tagsText: note.tags.join(", "),
      is_favorite: note.is_favorite,
    });
  }

  function createLocalDraft() {
    setSelectedId(null);
    setDraft({ ...emptyDraft, folder: activeFolder !== "all" && activeFolder !== "favorites" ? activeFolder : "other" });
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setIsCreatingFolder(true);
    setError(null);
    try {
      const response = await fetch("/api/notes/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to create folder");
      }
      const created = (await response.json()) as NoteFolder;
      setCustomFolders((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
      setActiveFolder(created.id);
      setDraft((current) => ({ ...current, folder: created.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function saveNote() {
    if (!draft.title.trim()) {
      setError("Note title is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const payload = {
      title: draft.title.trim(),
      content: draft.content,
      folder: draft.folder,
      tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      is_favorite: draft.is_favorite,
      status: "active",
    };

    try {
      const response = await fetch(selectedNote ? `/api/notes/${selectedNote.id}` : "/api/notes", {
        method: selectedNote ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to save note");
      }
      const saved = (await response.json()) as Note;
      setNotes((current) => sortNotes(selectedNote ? current.map((note) => note.id === saved.id ? saved : note) : [saved, ...current]));
      setSelectedId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote() {
    if (!selectedNote) return;
    const confirmed = window.confirm(`Delete "${selectedNote.title}"?`);
    if (!confirmed) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/notes/${selectedNote.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete note");
      setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
      setSelectedId(null);
      setDraft(emptyDraft);
    } catch {
      setError("Failed to delete note.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveNote() {
    if (!selectedNote) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/notes/${selectedNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!response.ok) throw new Error("Failed to archive note");
      setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
      setSelectedId(null);
      setDraft(emptyDraft);
    } catch {
      setError("Failed to archive note.");
    } finally {
      setIsSaving(false);
    }
  }

  const plainDraftContent = stripHtml(draft.content).trim();

  return (
    <div className="min-h-screen min-w-0 space-y-4 text-app-primary">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-base text-app-muted">Capture ideas, meeting notes, research, and daily reflections.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-full border border-app-border bg-app-input pl-11 pr-4 text-sm outline-none placeholder:text-app-subtle focus:border-[#7C3AED]" placeholder="Search notes..." />
          </div>
          <button onClick={createLocalDraft} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#6D38E8] px-5 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 sm:w-auto">
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300">{error}</div>}

      <section className="grid min-w-0 gap-4 xl:grid-cols-[260px_360px_minmax(0,1fr)]">
        <Panel className="overflow-hidden p-3">
          <div className="mb-2 px-2 py-2 text-sm font-semibold text-app-muted">Folders</div>
          <div className="space-y-1">
            {folderNavItems.map(({ id, name, icon: Icon }) => (
              <button key={id} onClick={() => setActiveFolder(id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm transition ${activeFolder === id ? "bg-[#6D38E8] text-white" : "text-app-secondary hover:bg-app-soft"}`}>
                <span className="flex min-w-0 items-center gap-3"><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{name}</span></span>
                <span className={activeFolder === id ? "text-white/80" : "text-app-muted"}>{folderCounts[id] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-app-border pt-4">
            <div className="flex gap-2">
              <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} className="h-10 min-w-0 flex-1 rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none placeholder:text-app-subtle focus:border-[#7C3AED]" placeholder="New folder" />
              <button onClick={() => void createFolder()} disabled={isCreatingFolder || !newFolderName.trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6D38E8] text-white disabled:opacity-50" aria-label="Create folder">
                {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-app-border p-4">
            <h2 className="font-semibold">{folderNavItems.find((folder) => folder.id === activeFolder)?.name ?? "Notes"}</h2>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-app-muted" />}
          </div>
          <div className="max-h-[calc(100vh-220px)] divide-y divide-app-border overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <FileText className="mx-auto h-9 w-9 text-[#7C3AED]" />
                <p className="mt-4 font-semibold">No notes yet</p>
                <p className="mt-2 text-sm text-app-muted">Create your first note to start building your knowledge base.</p>
              </div>
            ) : filteredNotes.map((note) => (
              <button key={note.id} onClick={() => selectNote(note)} className={`w-full p-4 text-left transition ${selectedId === note.id ? "bg-app-soft shadow-[inset_3px_0_0_#7C3AED]" : "hover:bg-app-soft"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{note.title}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-app-muted">{stripHtml(note.content) || "No content yet."}</p>
                    <p className="mt-3 text-xs text-app-subtle">{new Date(note.updated_at).toLocaleString()}</p>
                  </div>
                  {note.is_favorite && <Star className="h-4 w-4 shrink-0 fill-[#FACC15] text-[#FACC15]" />}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-app-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-app-subtle" placeholder="Untitled note" />
              <div className="mt-3 flex flex-wrap gap-2">
                <select value={draft.folder} onChange={(event) => setDraft({ ...draft, folder: event.target.value })} className="h-9 rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]">
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
                <input value={draft.tagsText} onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-app-border bg-app-input px-3 text-sm outline-none placeholder:text-app-subtle" placeholder="Tags, comma separated" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDraft({ ...draft, is_favorite: !draft.is_favorite })} className={`flex h-10 w-10 items-center justify-center rounded-lg border border-app-border ${draft.is_favorite ? "text-[#FACC15]" : "text-app-muted"}`} aria-label="Toggle favorite">
                <Star className={`h-5 w-5 ${draft.is_favorite ? "fill-current" : ""}`} />
              </button>
              <button onClick={() => void saveNote()} disabled={isSaving} className="flex h-10 items-center gap-2 rounded-lg bg-[#6D38E8] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          <RichTextEditor value={draft.content} onChange={(content) => setDraft((current) => ({ ...current, content }))} />

          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-app-border pt-4 text-sm text-app-muted">
            <span>{plainDraftContent ? plainDraftContent.split(/\s+/).length : 0} words</span>
            <div className="flex gap-3">
              {selectedNote && <button onClick={() => void archiveNote()} className="flex items-center gap-2 text-app-muted hover:text-app-primary"><Archive className="h-4 w-4" />Archive</button>}
              {selectedNote && <button onClick={() => void deleteNote()} className="flex items-center gap-2 text-rose-500"><Trash2 className="h-4 w-4" />Delete</button>}
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
