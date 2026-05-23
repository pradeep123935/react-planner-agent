from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

HabitCategory = Literal["health", "learning", "mindfulness", "productivity", "personal", "other"]
HabitFrequency = Literal["daily", "weekly"]
HabitStatus = Literal["active", "paused", "archived"]


class HabitCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=800)
    category: HabitCategory = "other"
    frequency: HabitFrequency = "daily"
    target: int = Field(1, ge=1, le=100)
    unit: str = Field("times", min_length=1, max_length=40)
    color: str = Field("#7C3AED", min_length=4, max_length=16)
    icon: str = Field("check", min_length=1, max_length=40)
    status: HabitStatus = "active"


class HabitUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=800)
    category: Optional[HabitCategory] = None
    frequency: Optional[HabitFrequency] = None
    target: Optional[int] = Field(None, ge=1, le=100)
    unit: Optional[str] = Field(None, min_length=1, max_length=40)
    color: Optional[str] = Field(None, min_length=4, max_length=16)
    icon: Optional[str] = Field(None, min_length=1, max_length=40)
    status: Optional[HabitStatus] = None
    completed_dates: Optional[List[str]] = None


class HabitCompletionUpdate(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)
    completed: bool = True


class HabitResponse(HabitCreate):
    id: str
    user_id: str
    completed_dates: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
