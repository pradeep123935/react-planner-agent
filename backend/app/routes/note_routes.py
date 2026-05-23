from datetime import datetime
import re
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_database
from app.models.note import NoteCreate, NoteFolderCreate, NoteFolderResponse, NoteResponse, NoteUpdate
from app.routes.deps import get_current_user

router = APIRouter(tags=["notes"])

DEFAULT_FOLDERS = {"work", "personal", "ideas", "learning", "journal", "other"}


def serialize_note(note: dict) -> NoteResponse:
    note_dict = dict(note)
    note_dict["id"] = str(note_dict.pop("_id"))
    note_dict["user_id"] = str(note_dict["user_id"])
    return NoteResponse(**note_dict)


def make_folder_id(name: str) -> str:
    folder_id = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return folder_id or "untitled"


def serialize_folder(folder: dict) -> NoteFolderResponse:
    folder_dict = dict(folder)
    folder_dict["id"] = str(folder_dict.pop("_id"))
    folder_dict["user_id"] = str(folder_dict["user_id"])
    return NoteFolderResponse(**folder_dict)


@router.get("/folders", response_model=List[NoteFolderResponse])
async def list_folders(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    folders = await db.note_folders.find({"user_id": current_user["id"]}).sort("name", 1).to_list(200)
    return [serialize_folder(folder) for folder in folders]


@router.post("/folders", response_model=NoteFolderResponse)
async def create_folder(folder: NoteFolderCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    folder_id = make_folder_id(folder.name)
    if folder_id in DEFAULT_FOLDERS:
        raise HTTPException(status_code=409, detail="That folder already exists")

    existing = await db.note_folders.find_one({"_id": folder_id, "user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="That folder already exists")

    now = datetime.utcnow()
    folder_dict = {
        "_id": folder_id,
        "name": folder.name.strip(),
        "user_id": current_user["id"],
        "created_at": now,
    }
    await db.note_folders.insert_one(folder_dict)
    created_folder = await db.note_folders.find_one({"_id": folder_id, "user_id": current_user["id"]})
    return serialize_folder(created_folder)


@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    now = datetime.utcnow()
    note_dict = note.model_dump()
    note_dict["tags"] = [tag.strip().lower() for tag in note.tags if tag.strip()]
    note_dict["user_id"] = current_user["id"]
    note_dict["created_at"] = now
    note_dict["updated_at"] = now

    result = await db.notes.insert_one(note_dict)
    created_note = await db.notes.find_one({"_id": result.inserted_id})
    return serialize_note(created_note)


@router.get("/", response_model=List[NoteResponse])
async def list_notes(status: Optional[str] = "active", current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    query = {"user_id": current_user["id"]}
    if status:
        query["status"] = status
    notes = await db.notes.find(query).sort("updated_at", -1).to_list(300)
    return [serialize_note(note) for note in notes]


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note: NoteUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note id")

    update_data = {key: value for key, value in note.model_dump(exclude_unset=True).items() if value is not None}
    if "tags" in update_data:
        update_data["tags"] = [tag.strip().lower() for tag in update_data["tags"] if tag.strip()]
    update_data["updated_at"] = datetime.utcnow()

    result = await db.notes.update_one(
        {"_id": ObjectId(note_id), "user_id": current_user["id"]},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")

    updated_note = await db.notes.find_one({"_id": ObjectId(note_id)})
    return serialize_note(updated_note)


@router.delete("/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note id")

    result = await db.notes.update_one(
        {"_id": ObjectId(note_id), "user_id": current_user["id"]},
        {"$set": {"status": "trash", "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")

    return {"status": "success"}
