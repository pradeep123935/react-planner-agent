from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db.mongo import get_database
from app.models.ai_task import AITaskGenRequest
from app.models.task import TaskCreate, TaskResponse, TaskUpdate
from app.routes.deps import get_current_user
from app.services.task_service import generate_and_insert_ai_tasks

router = APIRouter(tags=["tasks"])


def serialize_task(task: dict) -> TaskResponse:
    task_dict = dict(task)
    task_dict["id"] = str(task_dict.pop("_id"))
    task_dict["user_id"] = str(task_dict["user_id"])
    task_dict["goal_id"] = str(task_dict["goal_id"])
    task_dict["project_id"] = str(task_dict["project_id"])
    return TaskResponse(**task_dict)


async def get_owned_project(db, project_id: str, user_id: str) -> dict:
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project id")

    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": user_id, "status": {"$ne": "archived"}})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.post("/ai-generate")
async def ai_generate_tasks(
    request: AITaskGenRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        inserted_ids = await generate_and_insert_ai_tasks(request.prompt, current_user["id"])
        return {"inserted_task_ids": inserted_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=TaskResponse)
async def add_task(task: TaskCreate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    project = await get_owned_project(db, task.project_id, current_user["id"])
    now = datetime.utcnow()
    task_dict = task.model_dump(mode="json")
    task_dict["user_id"] = current_user["id"]
    task_dict["goal_id"] = project["goal_id"]
    task_dict["goal_title"] = project["goal_title"]
    task_dict["project_title"] = project["title"]
    task_dict["created_at"] = now
    task_dict["updated_at"] = now

    result = await db.tasks.insert_one(task_dict)
    created_task = await db.tasks.find_one({"_id": result.inserted_id})
    return serialize_task(created_task)


@router.get("/", response_model=List[TaskResponse])
async def fetch_tasks(status: Optional[str] = None, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    query = {"user_id": current_user["id"], "status": {"$ne": "archived"}}
    if status:
        query["status"] = status

    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(200)
    return [serialize_task(task) for task in tasks]


@router.patch("/{task_id}", response_model=TaskResponse)
async def patch_task(task_id: str, task: TaskUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")

    update_data = {key: value for key, value in task.model_dump(mode="json", exclude_unset=True).items() if value is not None}

    if "project_id" in update_data:
        project = await get_owned_project(db, update_data["project_id"], current_user["id"])
        update_data["goal_id"] = project["goal_id"]
        update_data["goal_title"] = project["goal_title"]
        update_data["project_title"] = project["title"]

    update_data["updated_at"] = datetime.utcnow()

    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id), "user_id": current_user["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return serialize_task(updated_task)


@router.delete("/{task_id}")
async def remove_task(task_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")

    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id), "user_id": current_user["id"]},
        {"$set": {"status": "archived", "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"status": "success"}
