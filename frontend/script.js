document.addEventListener("DOMContentLoaded", () => {
    loadHabits();
});

async function loadHabits() {
    const grid = document.getElementById("tracker-grid");
    
    // 1. Fetch habits from FastAPI
    const response = await fetch("/api/habits");
    const habits = await response.json();

    // 2. Build Headers (Goal Name + Next 7 Days)
    const headers = ["Goal", ...getNext7Days()];
    headers.forEach(text => {
        const div = document.createElement("div");
        div.className = "grid-header";
        div.innerText = text;
        grid.appendChild(div);
    });

    // 3. Build Rows
    habits.forEach(habit => {
        // Goal Name Column
        const nameDiv = document.createElement("div");
        nameDiv.className = "habit-name";
        nameDiv.innerText = habit.name;
        grid.appendChild(nameDiv);

        // Date Columns (Clickable Boxes)
        for (let i = 0; i < 7; i++) {
            const btn = document.createElement("button");
            btn.className = "check-box";
            btn.dataset.habitId = habit.id;
            const dateStr = headers[i+1];
            btn.dataset.date = dateStr; // Associate date with button
            
            // Check if this date is marked in history
            const checkin = habit.checkins.find(c => c.date === dateStr);
            if (checkin && checkin.status) {
                btn.classList.add("marked");
            }
            
            btn.onclick = () => toggleMark(btn);
            grid.appendChild(btn);
        }
    });
}

function getNext7Days() {
    const dates = [];
    for(let i=0; i<7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
    }
    return dates;
}

async function toggleMark(btn) {
    // Visual update immediately (optimistic UI)
    btn.classList.toggle("marked");
    const isMarked = btn.classList.contains("marked");

    // Send to Backend
    await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            habit_id: parseInt(btn.dataset.habitId),
            date: btn.dataset.date,
            status: isMarked
        })
    });
}
