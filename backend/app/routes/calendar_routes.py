from datetime import datetime
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_database
from app.models.calendar_event import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate
from app.routes.deps import get_current_user

router = APIRouter(tags=["calendar"])


def serialize_event(event: dict) -> CalendarEventResponse:
    event_dict = dict(event)
    event_dict["id"] = str(event_dict.pop("_id"))
    event_dict["user_id"] = str(event_dict["user_id"])
    if event_dict.get("task_id"):
        event_dict["task_id"] = str(event_dict["task_id"])
    event_dict.setdefault("updated_at", event_dict["created_at"])
    event_dict.setdefault("source", "manual")
    return CalendarEventResponse(**event_dict)


async def ensure_owned_task(db, task_id: str | None, user_id: str):
    if not task_id:
        return None
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")

    task = await db.tasks.find_one({"_id": ObjectId(task_id), "user_id": user_id, "status": {"$ne": "archived"}})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/", response_model=CalendarEventResponse)
async def add_event(event: CalendarEventCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    task = await ensure_owned_task(db, event.task_id, current_user["id"])
    now = datetime.utcnow()
    event_dict = event.model_dump()

    if task:
        event_dict["title"] = event.title or task["title"]
        event_dict["source"] = "task"

    event_dict["user_id"] = current_user["id"]
    event_dict["created_at"] = now
    event_dict["updated_at"] = now

    result = await db.calendar_events.insert_one(event_dict)
    created_event = await db.calendar_events.find_one({"_id": result.inserted_id})
    return serialize_event(created_event)


@router.get("/", response_model=List[CalendarEventResponse])
async def fetch_events(start_date: datetime, end_date: datetime, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    events = await db.calendar_events.find({
        "user_id": current_user["id"],
        "start_time": {"$lt": end_date},
        "end_time": {"$gt": start_date},
    }).sort("start_time", 1).to_list(500)
    return [serialize_event(event) for event in events]


@router.patch("/{event_id}", response_model=CalendarEventResponse)
async def patch_event(event_id: str, event: CalendarEventUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event id")

    update_data = {key: value for key, value in event.model_dump(exclude_unset=True).items() if value is not None}
    task = await ensure_owned_task(db, update_data.get("task_id"), current_user["id"])
    if task:
        update_data["source"] = "task"
    update_data["updated_at"] = datetime.utcnow()

    result = await db.calendar_events.update_one(
        {"_id": ObjectId(event_id), "user_id": current_user["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    updated_event = await db.calendar_events.find_one({"_id": ObjectId(event_id)})
    return serialize_event(updated_event)


@router.delete("/{event_id}")
async def remove_event(event_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event id")

    result = await db.calendar_events.delete_one({"_id": ObjectId(event_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"status": "success"}
