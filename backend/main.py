from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path

from . import models, schemas, crud
from .database import SessionLocal, engine

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- API Routes ---

@app.get("/api/habits", response_model=List[schemas.Habit])
async def get_habits(db: Session = Depends(get_db)):
    habits = crud.get_habits(db)
    # Seed data if empty (for demonstration)
    if not habits:
        crud.create_habit(db, schemas.HabitCreate(name="Morning Routine", emoji="\u23f0", goal=7))
        crud.create_habit(db, schemas.HabitCreate(name="No Social Media Before Noon", emoji="\ud83d\udeab", goal=7))
        crud.create_habit(db, schemas.HabitCreate(name="Drink Water", emoji="\ud83d\udca7", goal=7))
        crud.create_habit(db, schemas.HabitCreate(name="Exercise", emoji="\ud83c\udfcb\ufe0f", goal=5))
        crud.create_habit(db, schemas.HabitCreate(name="Read 10 Pages", emoji="\ud83d\udcda", goal=7))
        crud.create_habit(db, schemas.HabitCreate(name="Meditation", emoji="\ud83e\uddd8", goal=7))
        habits = crud.get_habits(db)
    return habits

@app.post("/api/checkin", response_model=schemas.CheckIn)
async def check_in(checkin: schemas.CheckInCreate, db: Session = Depends(get_db)):
    return crud.create_or_update_checkin(db, checkin)

@app.post("/api/habits", response_model=schemas.Habit)
async def create_habit(habit: schemas.HabitCreate, db: Session = Depends(get_db)):
    return crud.create_habit(db, habit)

@app.put("/api/habits/{habit_id}", response_model=schemas.Habit)
async def update_habit(habit_id: int, habit: schemas.HabitCreate, db: Session = Depends(get_db)):
    return crud.update_habit(db, habit_id, habit)

@app.delete("/api/habits/{habit_id}")
async def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    return crud.delete_habit(db, habit_id)

@app.get("/api/analytics/monthly-progress")
async def get_monthly_progress(db: Session = Depends(get_db)):
    return crud.get_monthly_progress(db)

@app.get("/api/analytics/top-habits")
async def get_top_habits(db: Session = Depends(get_db)):
    return crud.get_top_habits(db)

@app.get("/api/analytics/completion-ratio")
async def get_completion_ratio(db: Session = Depends(get_db)):
    return crud.get_completion_ratio(db)

# --- Serve Frontend (Vanilla) ---

# Get the absolute path to the frontend directory
frontend_dir = Path(__file__).parent.parent / "frontend"

# Mount the frontend directory to serve CSS/JS files
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

# Serve the index.html on the root URL
@app.get("/")
async def read_root():
    return FileResponse(str(frontend_dir / "index.html"))
