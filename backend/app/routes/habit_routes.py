from datetime import datetime
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_database
from app.models.habit import HabitCompletionUpdate, HabitCreate, HabitResponse, HabitUpdate
from app.routes.deps import get_current_user

router = APIRouter(tags=["habits"])


def serialize_habit(habit: dict) -> HabitResponse:
    habit_dict = dict(habit)
    habit_dict["id"] = str(habit_dict.pop("_id"))
    habit_dict["user_id"] = str(habit_dict["user_id"])
    habit_dict["completed_dates"] = habit_dict.get("completed_dates", [])
    return HabitResponse(**habit_dict)


@router.post("/", response_model=HabitResponse)
async def create_habit(habit: HabitCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    now = datetime.utcnow()
    habit_dict = habit.model_dump()
    habit_dict["user_id"] = current_user["id"]
    habit_dict["completed_dates"] = []
    habit_dict["created_at"] = now
    habit_dict["updated_at"] = now

    result = await db.habits.insert_one(habit_dict)
    created_habit = await db.habits.find_one({"_id": result.inserted_id})
    return serialize_habit(created_habit)


@router.get("/", response_model=List[HabitResponse])
async def list_habits(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    habits = await db.habits.find({"user_id": current_user["id"], "status": {"$ne": "archived"}}).sort("created_at", -1).to_list(200)
    return [serialize_habit(habit) for habit in habits]


@router.patch("/{habit_id}", response_model=HabitResponse)
async def update_habit(habit_id: str, habit: HabitUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(status_code=400, detail="Invalid habit id")

    update_data = {key: value for key, value in habit.model_dump(exclude_unset=True).items() if value is not None}
    update_data["updated_at"] = datetime.utcnow()

    result = await db.habits.update_one(
        {"_id": ObjectId(habit_id), "user_id": current_user["id"]},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")

    updated_habit = await db.habits.find_one({"_id": ObjectId(habit_id)})
    return serialize_habit(updated_habit)


@router.patch("/{habit_id}/completion", response_model=HabitResponse)
async def update_habit_completion(habit_id: str, completion: HabitCompletionUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(status_code=400, detail="Invalid habit id")

    habit = await db.habits.find_one({"_id": ObjectId(habit_id), "user_id": current_user["id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    completed_dates = set(habit.get("completed_dates", []))
    if completion.completed:
        completed_dates.add(completion.date)
    else:
        completed_dates.discard(completion.date)

    await db.habits.update_one(
        {"_id": ObjectId(habit_id), "user_id": current_user["id"]},
        {"$set": {"completed_dates": sorted(completed_dates), "updated_at": datetime.utcnow()}},
    )

    updated_habit = await db.habits.find_one({"_id": ObjectId(habit_id)})
    return serialize_habit(updated_habit)


@router.delete("/{habit_id}")
async def archive_habit(habit_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(status_code=400, detail="Invalid habit id")

    result = await db.habits.update_one(
        {"_id": ObjectId(habit_id), "user_id": current_user["id"]},
        {"$set": {"status": "archived", "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")

    return {"status": "success"}
