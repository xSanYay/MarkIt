from sqlalchemy.orm import Session
from sqlalchemy import func, case
from . import models, schemas, analytics
from datetime import date, timedelta

# Frontend starts rendering from Jan 1, 2026
TRACKING_START_DATE = date(2026, 1, 1)

def get_habits(db: Session):
    habits = db.query(models.Habit).all()
    today = date.today()
    
    # Auto-complete logic: fill missing check-ins from tracking start up to today
    # Limit to recent 60 days to avoid excessive writes
    window_start = max(TRACKING_START_DATE, today - timedelta(days=60))
    for habit in habits:
        if not habit.auto_complete:
            continue
        day = window_start
        while day <= today:
            if not get_checkin(db, habit.id, day):
                create_or_update_checkin(db, schemas.CheckInCreate(habit_id=habit.id, date=day, status=True))
            day += timedelta(days=1)
    
    return habits

def create_habit(db: Session, habit: schemas.HabitCreate):
    db_habit = models.Habit(name=habit.name, description=habit.description, emoji=habit.emoji, goal=habit.goal, auto_complete=habit.auto_complete)
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

def update_habit(db: Session, habit_id: int, habit: schemas.HabitCreate):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if db_habit:
        db_habit.name = habit.name
        db_habit.description = habit.description
        db_habit.emoji = habit.emoji
        db_habit.goal = habit.goal
        db_habit.auto_complete = habit.auto_complete
        db.commit()
        db.refresh(db_habit)
    return db_habit

def delete_habit(db: Session, habit_id: int):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if db_habit:
        db.delete(db_habit)
        db.commit()
    return {"ok": True}

def get_checkin(db: Session, habit_id: int, checkin_date: date):
    return db.query(models.CheckIn).filter(
        models.CheckIn.habit_id == habit_id, 
        models.CheckIn.date == checkin_date
    ).first()

def create_or_update_checkin(db: Session, checkin: schemas.CheckInCreate):
    db_checkin = get_checkin(db, habit_id=checkin.habit_id, checkin_date=checkin.date)
    if db_checkin:
        db_checkin.status = checkin.status
    else:
        db_checkin = models.CheckIn(habit_id=checkin.habit_id, date=checkin.date, status=checkin.status)
        db.add(db_checkin)
    
    db.commit()
    db.refresh(db_checkin)
    return db_checkin

def get_monthly_progress(db: Session):
    return analytics.get_monthly_progress(db)

def get_top_habits(db: Session):
    return analytics.get_top_habits(db)

def get_completion_ratio(db: Session):
    return analytics.get_completion_ratio(db)
