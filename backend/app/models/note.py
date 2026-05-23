from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

NoteStatus = Literal["active", "archived", "trash"]


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field("", max_length=20000)
    folder: str = Field("other", min_length=1, max_length=48)
    tags: List[str] = Field(default_factory=list, max_length=12)
    is_favorite: bool = False
    status: NoteStatus = "active"


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, max_length=20000)
    folder: Optional[str] = Field(None, min_length=1, max_length=48)
    tags: Optional[List[str]] = Field(None, max_length=12)
    is_favorite: Optional[bool] = None
    status: Optional[NoteStatus] = None


class NoteResponse(NoteCreate):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


class NoteFolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=48)


class NoteFolderResponse(BaseModel):
    id: str
    name: str
    user_id: str
    created_at: datetime
