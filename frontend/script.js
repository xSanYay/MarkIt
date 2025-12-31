// ===== GLOBAL STATE =====
let habits = [];
let checkins = {};
const WEEKS_TO_SHOW = 4;
let analyticsVisible = false;
let analyticsLoaded = false;
let debounceTimer = null;

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
        if (analyticsVisible) {
            loadAnalytics();
        }
    });
    document.getElementById('btn-toggle-analytics').addEventListener('click', toggleAnalytics);
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
    // Don't load analytics on init - wait for user to click toggle
}

function toggleAnalytics() {
    const section = document.getElementById('analytics-section');
    const btn = document.getElementById('btn-toggle-analytics');
    
    analyticsVisible = !analyticsVisible;
    
    if (analyticsVisible) {
        section.classList.remove('hidden');
        btn.textContent = '📊 Hide Analytics';
        
        // Load analytics only when showing for the first time
        if (!analyticsLoaded) {
            loadAnalytics();
            analyticsLoaded = true;
        }
    } else {
        section.classList.add('hidden');
        btn.textContent = '📊 Show Analytics';
    }
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
        const startIndex = week * 7;
        const endIndex = Math.min(startIndex + 6, dates.length - 1);
        const startDate = dates[startIndex]?.date;
        const endDate = dates[endIndex]?.date;
        const label = (startDate && endDate) ? formatWeekLabel(startDate, endDate) : `Week ${week + 1}`;
        const weekCell = createCell(label, 'header-week');
        weekCell.style.gridColumn = `span 7`;
        grid.appendChild(weekCell);
    }
    
    // Row 2: Day headers (Mon, Tue, Wed, etc.)
    const emptyCell1 = createCell('', 'header-day frozen-col');
    grid.appendChild(emptyCell1);
    
    const emptyCell2 = createCell('', 'header-day frozen-goal-col');
    grid.appendChild(emptyCell2);
    
    dates.forEach(dateObj => {
        const classes = ['header-day'];
        if (dateObj.isToday) {
            classes.push('today-highlight');
        }
        if (dateObj.isFuture) {
            classes.push('future-day');
        }
        const dayLabel = `${dateObj.dayName} ${dateObj.date.getDate()}`;
        const dayCell = createCell(dayLabel, classes.join(' '));
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
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-habit-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete habit';
    deleteBtn.addEventListener('click', () => handleDeleteHabit(habit.id, habit.name));
    
    habitCell.appendChild(emojiSpan);
    habitCell.appendChild(nameSpan);
    habitCell.appendChild(deleteBtn);
    grid.appendChild(habitCell);
    
    // Goal cell
    const goalCell = createCell(habit.goal || '7', 'grid-cell goal-cell frozen-goal-col');
    grid.appendChild(goalCell);
    
    // Date checkboxes
    dates.forEach(dateObj => {
        const classes = ['grid-cell', 'day-cell'];
        if (dateObj.isToday) {
            classes.push('today-cell');
        }
        if (dateObj.isFuture) {
            classes.push('future-cell');
        }
        const dayCell = createCell('', classes.join(' '));
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox-input';
        checkbox.dataset.habitId = habit.id;
        checkbox.dataset.date = dateObj.dateStr;
        checkbox.title = dateObj.isFuture ? 'Scheduled ahead; counts toward analytics once the day passes.' : 'Mark completion for this day.';
        
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
    today.setHours(0, 0, 0, 0);
    const daysToShow = weeks * 7;
    const futureDays = Math.min(7, daysToShow);
    const pastDays = Math.max(daysToShow - futureDays, 0);
    const startDate = new Date(today);
    if (pastDays > 0) {
        startDate.setDate(today.getDate() - (pastDays - 1));
    }

    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        dates.push({
            date,
            dateStr: formatDateISO(date),
            dayName: getDayName(date),
            dayOfWeek: date.getDay(),
            isToday: isSameDay(date, today),
            isFuture: date > today
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

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function formatWeekLabel(startDate, endDate) {
    const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} - ${endLabel}`;
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
        
        // Debounce analytics reload - only reload if analytics is visible
        // and wait 1 second after last checkbox change
        if (analyticsVisible) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                loadAnalytics();
            }, 1000);
        }
    } catch (error) {
        console.error('Error updating checkin:', error);
        // Revert checkbox on error
        checkbox.checked = !status;
    }
}

async function handleDeleteHabit(habitId, habitName) {
    if (!confirm(`Are you sure you want to delete "${habitName}"? This will remove all associated check-ins.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/habits/${habitId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadHabits();
            // Reload analytics if visible
            if (analyticsVisible) {
                await loadAnalytics();
            }
        } else {
            alert('Failed to delete habit');
        }
    } catch (error) {
        console.error('Error deleting habit:', error);
        alert('Error deleting habit');
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
    const chartContainer = ctx.closest('.chart-box');
    
    if (charts.monthlyProgress) {
        charts.monthlyProgress.destroy();
    }
    
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const percentages = data.map(d => (d.percentage === null || d.percentage === undefined) ? null : d.percentage);
    const hasData = percentages.some(value => value !== null);
    
    if (chartContainer) {
        chartContainer.classList.toggle('empty-state', !hasData);
    }
    
    charts.monthlyProgress = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Completion %',
                data: percentages,
                borderColor: '#3C78D8',
                backgroundColor: 'rgba(109, 158, 235, 0.15)',
                fill: false,
                spanGaps: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3C78D8',
                segment: {
                    borderColor: ctx => ctx.p0.raw === null || ctx.p1.raw === null ? 'rgba(60, 120, 216, 0.35)' : '#3C78D8'
                }
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const record = data[context.dataIndex];
                            if (context.raw === null) {
                                return 'No activity logged';
                            }
                            const base = `Completion: ${context.raw}%`;
                            if (record && typeof record.completed === 'number' && typeof record.total === 'number') {
                                return `${base} (${record.completed}/${record.total})`;
                            }
                            return base;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        callback: value => `${value}%`
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: hasData ? 10 : 6
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
            responsive: false,
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
            responsive: false,
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
