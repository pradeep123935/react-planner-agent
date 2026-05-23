from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

TaskPriority = Literal["low", "medium", "high", "urgent"]
TaskStatus = Literal["todo", "in_progress", "done", "archived"]
EnergyLevel = Literal["low", "medium", "high"]


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    project_id: str = Field(..., min_length=1)
    description: Optional[str] = Field(None, max_length=1000)
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    due_date: Optional[date] = None
    estimated_minutes: Optional[int] = Field(None, ge=0, le=1440)
    energy_level: Optional[EnergyLevel] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    project_id: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[date] = None
    estimated_minutes: Optional[int] = Field(None, ge=0, le=1440)
    energy_level: Optional[EnergyLevel] = None


class TaskResponse(TaskCreate):
    id: str
    user_id: str
    goal_id: str
    goal_title: str
    project_title: str
    created_at: datetime
    updated_at: datetime
