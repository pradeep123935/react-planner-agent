from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    start_time: datetime
    end_time: datetime
    is_all_day: bool = False
    location: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None)
    task_id: Optional[str] = None
    source: Literal["manual", "task"] = "manual"

    @field_validator("end_time")
    @classmethod
    def end_time_must_be_after_start(cls, value: datetime, info):
        start_time = info.data.get("start_time")
        if start_time and value <= start_time:
            raise ValueError("End time must be after start time")
        return value


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    location: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = None
    task_id: Optional[str] = None
    source: Optional[Literal["manual", "task"]] = None


class CalendarEventResponse(CalendarEventCreate):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
