from datetime import datetime
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_database
from app.models.focus_session import FocusSessionCreate, FocusSessionResponse
from app.routes.deps import get_current_user

router = APIRouter(tags=["focus"])


def serialize_session(session: dict) -> FocusSessionResponse:
    session_dict = dict(session)
    session_dict["id"] = str(session_dict.pop("_id"))
    session_dict["user_id"] = str(session_dict["user_id"])
    if session_dict.get("task_id"):
        session_dict["task_id"] = str(session_dict["task_id"])
    return FocusSessionResponse(**session_dict)


async def get_owned_task(db, task_id: str, user_id: str) -> dict:
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")

    task = await db.tasks.find_one({"_id": ObjectId(task_id), "user_id": user_id, "status": {"$ne": "archived"}})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/sessions", response_model=FocusSessionResponse)
async def create_focus_session(session: FocusSessionCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    session_dict = session.model_dump()
    if session.task_id:
        task = await get_owned_task(db, session.task_id, current_user["id"])
        session_dict["task_id"] = ObjectId(session.task_id)
        session_dict["task_title"] = task["title"]

    now = datetime.utcnow()
    session_dict["user_id"] = current_user["id"]
    session_dict["started_at"] = session.started_at or now
    session_dict["ended_at"] = session.ended_at or now
    session_dict["created_at"] = now

    result = await db.focus_sessions.insert_one(session_dict)
    created_session = await db.focus_sessions.find_one({"_id": result.inserted_id})
    return serialize_session(created_session)


@router.get("/sessions", response_model=List[FocusSessionResponse])
async def list_focus_sessions(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    sessions = await db.focus_sessions.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [serialize_session(session) for session in sessions]
