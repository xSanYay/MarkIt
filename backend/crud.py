from sqlalchemy.orm import Session
import models, schemas
from datetime import date

def get_habits(db: Session):
    return db.query(models.Habit).all()

def create_habit(db: Session, habit: schemas.HabitCreate):
    db_habit = models.Habit(name=habit.name, description=habit.description)
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

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
