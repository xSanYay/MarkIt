from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class CheckInBase(BaseModel):
    habit_id: int
    date: date
    status: bool

class CheckInCreate(CheckInBase):
    pass

class CheckIn(CheckInBase):
    id: int

    class Config:
        from_attributes = True

class HabitBase(BaseModel):
    name: str
    description: Optional[str] = None

class HabitCreate(HabitBase):
    pass

class Habit(HabitBase):
    id: int
    checkins: List[CheckIn] = []

    class Config:
        from_attributes = True
