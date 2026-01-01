from sqlalchemy.orm import Session
from sqlalchemy import func, case
from . import models
from datetime import date, timedelta

def get_monthly_progress(db: Session):
    """Daily completion percentages for the last 30 days based on recorded activity."""
    today = date.today()
    days_to_show = 30
    start_date = today - timedelta(days=days_to_show - 1)

    activity_rows = db.query(
        models.CheckIn.date,
        func.sum(
            case((models.CheckIn.status == True, 1), else_=0)
        ).label("completed"),
        func.count(models.CheckIn.id).label("total")
    ).filter(
        models.CheckIn.date >= start_date,
        models.CheckIn.date <= today
    ).group_by(
        models.CheckIn.date
    ).order_by(
        models.CheckIn.date
    ).all()

    activity_map = {
        row.date: {
            "completed": row.completed or 0,
            "total": row.total or 0
        }
        for row in activity_rows
    }

    progress = []
    for day_offset in range(days_to_show):
        current_date = start_date + timedelta(days=day_offset)
        snapshot = activity_map.get(current_date, {"completed": 0, "total": 0})
        total = snapshot["total"]
        percentage = round((snapshot["completed"] / total) * 100, 1) if total else None

        progress.append({
            "date": current_date.isoformat(),
            "percentage": percentage,
            "completed": snapshot["completed"],
            "total": total
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
