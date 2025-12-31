from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from datetime import date, timedelta

def get_habits(db: Session):
    return db.query(models.Habit).all()

def create_habit(db: Session, habit: schemas.HabitCreate):
    db_habit = models.Habit(name=habit.name, description=habit.description, emoji=habit.emoji, goal=habit.goal)
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
    """Get daily completion percentage for the last 30 days"""
    today = date.today()
    start_date = today - timedelta(days=30)
    
    # Get all habits
    habits = db.query(models.Habit).all()
    total_habits = len(habits)
    
    if total_habits == 0:
        return []
    
    progress = []
    for i in range(31):
        current_date = start_date + timedelta(days=i)
        completed = db.query(models.CheckIn).filter(
            models.CheckIn.date == current_date,
            models.CheckIn.status == True
        ).count()
        
        percentage = (completed / total_habits) * 100 if total_habits > 0 else 0
        progress.append({
            "date": current_date.isoformat(),
            "percentage": round(percentage, 1)
        })
    
    return progress

def get_top_habits(db: Session):
    """Get top 10 habits by completion count"""
    results = db.query(
        models.Habit.name,
        models.Habit.emoji,
        func.count(models.CheckIn.id).label('count')
    ).join(
        models.CheckIn, models.Habit.id == models.CheckIn.habit_id
    ).filter(
        models.CheckIn.status == True
    ).group_by(
        models.Habit.id
    ).order_by(
        func.count(models.CheckIn.id).desc()
    ).limit(10).all()
    
    return [{"name": r.name, "emoji": r.emoji, "count": r.count} for r in results]

def get_completion_ratio(db: Session):
    """Get completion ratio for current month"""
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    
    habits = db.query(models.Habit).all()
    total_habits = len(habits)
    days_in_month = (today - start_of_month).days + 1
    
    total_expected = total_habits * days_in_month
    
    completed = db.query(models.CheckIn).filter(
        models.CheckIn.date >= start_of_month,
        models.CheckIn.date <= today,
        models.CheckIn.status == True
    ).count()
    
    remaining = max(0, total_expected - completed)
    
    return {
        "completed": completed,
        "remaining": remaining,
        "total": total_expected
    }
