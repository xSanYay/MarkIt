// ===== GLOBAL STATE =====
let habits = [];
let checkins = {};
const WEEKS_TO_SHOW = 4;

// Common emojis for habits
const COMMON_EMOJIS = [
    '⏰', '🚫', '💧', '🏋️', '📚', '🧘', '🏃', '🎯', 
    '💪', '🌅', '🌙', '🍎', '🥗', '☕', '🚭', '💻',
    '✍️', '🎨', '🎵', '🧠', '❤️', '😴', '📱', '🧹'
];

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-add-habit').addEventListener('click', openAddHabitModal);
    document.getElementById('btn-cancel').addEventListener('click', closeHabitModal);
    document.getElementById('btn-refresh').addEventListener('click', () => {
        loadHabits();
        loadAnalytics();
    });
    document.getElementById('habit-form').addEventListener('submit', handleHabitSubmit);
    
    // Initialize emoji picker
    initializeEmojiPicker();
}

function initializeEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    COMMON_EMOJIS.forEach(emoji => {
        const option = document.createElement('div');
        option.className = 'emoji-option';
        option.textContent = emoji;
        option.addEventListener('click', () => selectEmoji(emoji, option));
        picker.appendChild(option);
    });
    
    // Select first emoji by default
    selectEmoji(COMMON_EMOJIS[0], picker.children[0]);
}

function selectEmoji(emoji, element) {
    document.querySelectorAll('.emoji-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('habit-emoji').value = emoji;
}

// ===== MODAL MANAGEMENT =====
function openAddHabitModal() {
    document.getElementById('habit-modal').classList.add('active');
    document.getElementById('habit-form').reset();
    // Reset to first emoji
    const firstEmoji = document.querySelector('.emoji-option');
    if (firstEmoji) {
        selectEmoji(COMMON_EMOJIS[0], firstEmoji);
    }
}

function closeHabitModal() {
    document.getElementById('habit-modal').classList.remove('active');
}

async function handleHabitSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('habit-name').value;
    const goal = parseInt(document.getElementById('habit-goal').value);
    const emoji = document.getElementById('habit-emoji').value;
    
    try {
        const response = await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, goal, emoji, description: '' })
        });
        
        if (response.ok) {
            closeHabitModal();
            await loadHabits();
        }
    } catch (error) {
        console.error('Error creating habit:', error);
    }
}

// ===== DATA LOADING =====
async function initializeApp() {
    await loadHabits();
    await loadAnalytics();
}

async function loadHabits() {
    try {
        const response = await fetch('/api/habits');
        habits = await response.json();
        
        // Build checkins map for quick lookup
        checkins = {};
        habits.forEach(habit => {
            habit.checkins.forEach(checkin => {
                const key = `${habit.id}-${checkin.date}`;
                checkins[key] = checkin.status;
            });
        });
        
        renderSpreadsheet();
    } catch (error) {
        console.error('Error loading habits:', error);
    }
}

// ===== SPREADSHEET RENDERING =====
function renderSpreadsheet() {
    const grid = document.getElementById('tracker-grid');
    grid.innerHTML = '';
    
    // Generate date range (4 weeks = 28 days)
    const dates = generateDateRange(WEEKS_TO_SHOW);
    const totalDays = dates.length;
    
    // Set grid template: habit column + goal column + date columns
    grid.style.gridTemplateColumns = `var(--col-habit-width) var(--col-goal-width) repeat(${totalDays}, var(--col-day-width))`;
    
    // Render headers
    renderHeaders(grid, dates);
    
    // Render habit rows
    habits.forEach(habit => {
        renderHabitRow(grid, habit, dates);
    });
}

function renderHeaders(grid, dates) {
    // Row 1: Super headers (DAILY HABITS, GOALS, WEEK 1, WEEK 2, etc.)
    const habitHeader = createCell('DAILY HABITS', 'header-section frozen-col');
    grid.appendChild(habitHeader);
    
    const goalHeader = createCell('GOALS', 'header-section frozen-goal-col');
    grid.appendChild(goalHeader);
    
    // Week headers (7 days each)
    for (let week = 0; week < WEEKS_TO_SHOW; week++) {
        const weekCell = createCell(`WEEK ${week + 1}`, 'header-week');
        weekCell.style.gridColumn = `span 7`;
        grid.appendChild(weekCell);
    }
    
    // Row 2: Day headers (Mon, Tue, Wed, etc.)
    const emptyCell1 = createCell('', 'header-day frozen-col');
    grid.appendChild(emptyCell1);
    
    const emptyCell2 = createCell('', 'header-day frozen-goal-col');
    grid.appendChild(emptyCell2);
    
    dates.forEach(dateObj => {
        const dayCell = createCell(dateObj.dayName, 'header-day');
        grid.appendChild(dayCell);
    });
}

function renderHabitRow(grid, habit, dates) {
    // Habit name cell
    const habitCell = createCell('', 'grid-cell habit-cell frozen-col');
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'habit-emoji';
    emojiSpan.textContent = habit.emoji || '📌';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'habit-name';
    nameSpan.textContent = habit.name;
    
    habitCell.appendChild(emojiSpan);
    habitCell.appendChild(nameSpan);
    grid.appendChild(habitCell);
    
    // Goal cell
    const goalCell = createCell(habit.goal || '7', 'grid-cell goal-cell frozen-goal-col');
    grid.appendChild(goalCell);
    
    // Date checkboxes
    dates.forEach(dateObj => {
        const dayCell = createCell('', 'grid-cell day-cell');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox-input';
        checkbox.dataset.habitId = habit.id;
        checkbox.dataset.date = dateObj.dateStr;
        
        // Check if already marked
        const key = `${habit.id}-${dateObj.dateStr}`;
        checkbox.checked = checkins[key] || false;
        
        checkbox.addEventListener('change', handleCheckboxToggle);
        dayCell.appendChild(checkbox);
        grid.appendChild(dayCell);
    });
}

function createCell(content, className) {
    const cell = document.createElement('div');
    cell.className = className;
    if (typeof content === 'string') {
        cell.textContent = content;
    }
    return cell;
}

// ===== DATE UTILITIES =====
function generateDateRange(weeks) {
    const dates = [];
    const today = new Date();
    const daysToShow = weeks * 7;
    
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        dates.push({
            date: date,
            dateStr: formatDateISO(date),
            dayName: getDayName(date),
            dayOfWeek: date.getDay()
        });
    }
    
    return dates;
}

function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

function getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

// ===== CHECKBOX INTERACTION =====
async function handleCheckboxToggle(e) {
    const checkbox = e.target;
    const habitId = parseInt(checkbox.dataset.habitId);
    const date = checkbox.dataset.date;
    const status = checkbox.checked;
    
    try {
        await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habit_id: habitId, date, status })
        });
        
        // Update local state
        const key = `${habitId}-${date}`;
        checkins[key] = status;
        
        // Reload analytics to reflect changes
        await loadAnalytics();
    } catch (error) {
        console.error('Error updating checkin:', error);
        // Revert checkbox on error
        checkbox.checked = !status;
    }
}

// ===== ANALYTICS =====
let charts = {
    monthlyProgress: null,
    topHabits: null,
    completion: null
};

async function loadAnalytics() {
    try {
        const [progressData, topHabitsData, completionData] = await Promise.all([
            fetch('/api/analytics/monthly-progress').then(r => r.json()),
            fetch('/api/analytics/top-habits').then(r => r.json()),
            fetch('/api/analytics/completion-ratio').then(r => r.json())
        ]);
        
        renderMonthlyProgressChart(progressData);
        renderTopHabitsChart(topHabitsData);
        renderCompletionChart(completionData);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function renderMonthlyProgressChart(data) {
    const ctx = document.getElementById('chart-monthly-progress');
    
    if (charts.monthlyProgress) {
        charts.monthlyProgress.destroy();
    }
    
    charts.monthlyProgress = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Completion %',
                data: data.map(d => d.percentage),
                borderColor: '#3C78D8',
                backgroundColor: 'rgba(109, 158, 235, 0.3)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        }
    });
}

function renderTopHabitsChart(data) {
    const ctx = document.getElementById('chart-top-habits');
    
    if (charts.topHabits) {
        charts.topHabits.destroy();
    }
    
    charts.topHabits = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(h => `${h.emoji} ${h.name}`),
            datasets: [{
                label: 'Completions',
                data: data.map(h => h.count),
                backgroundColor: '#6D9EEB',
                borderColor: '#3C78D8',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderCompletionChart(data) {
    const ctx = document.getElementById('chart-completion');
    
    if (charts.completion) {
        charts.completion.destroy();
    }
    
    charts.completion = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{
                data: [data.completed, data.remaining],
                backgroundColor: ['#6D9EEB', '#D9D9D9'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '50%',
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}
