from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

FocusSessionStatus = Literal["completed", "stopped"]


class FocusSessionCreate(BaseModel):
    task_id: Optional[str] = None
    task_title: str = Field("Deep work", min_length=1, max_length=200)
    duration_minutes: int = Field(..., ge=1, le=480)
    completed_minutes: int = Field(..., ge=0, le=480)
    status: FocusSessionStatus = "completed"
    notes: Optional[str] = Field(None, max_length=1000)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class FocusSessionResponse(FocusSessionCreate):
    id: str
    user_id: str
    created_at: datetime
