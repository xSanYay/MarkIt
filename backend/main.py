from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud
from database import SessionLocal, engine

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
        crud.create_habit(db, schemas.HabitCreate(name="Drink Water", description="2 Liters daily"))
        crud.create_habit(db, schemas.HabitCreate(name="Read 10 Pages", description="Non-fiction"))
        habits = crud.get_habits(db)
    return habits

@app.post("/api/checkin", response_model=schemas.CheckIn)
async def check_in(checkin: schemas.CheckInCreate, db: Session = Depends(get_db)):
    return crud.create_or_update_checkin(db, checkin)

# --- Serve Frontend (Vanilla) ---

# Mount the frontend directory to serve CSS/JS files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

# Serve the index.html on the root URL
@app.get("/")
async def read_root():
    return FileResponse("../frontend/index.html")
