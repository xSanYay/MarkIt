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
    
    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);

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
    const autoComplete = document.getElementById('habit-auto-complete').checked;
    
    try {
        const response = await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, goal, emoji, description: '', auto_complete: autoComplete })
        });
        
        if (response.ok) {
            closeHabitModal();
            await loadHabits();
        }
    } catch (error) {
        console.error('Error creating habit:', error);
    }
}

// ===== SETTINGS MODAL =====
function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
    renderSettingsHabitList();
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function renderSettingsHabitList() {
    const list = document.getElementById('settings-habit-list');
    list.innerHTML = '';
    
    habits.forEach(habit => {
        const item = document.createElement('div');
        item.className = 'settings-habit-item';
        
        const label = document.createElement('label');
        label.className = 'settings-habit-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = habit.auto_complete;
        checkbox.addEventListener('change', () => toggleHabitAutoComplete(habit.id, checkbox.checked));
        
        const text = document.createTextNode(` ${habit.emoji} ${habit.name}`);
        
        label.appendChild(checkbox);
        label.appendChild(text);
        item.appendChild(label);
        list.appendChild(item);
    });
}

async function toggleHabitAutoComplete(habitId, autoComplete) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    try {
        await fetch(`/api/habits/${habitId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...habit, auto_complete: autoComplete })
        });
        habit.auto_complete = autoComplete;
    } catch (error) {
        console.error('Error updating habit settings:', error);
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
    // Start from Jan 1, 2026
    const startDate = new Date('2026-01-01T00:00:00');
    const daysToShow = weeks * 7;
    
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        dates.push({
            date,
            dateStr: formatDateISO(date),
            dayName: getDayName(date),
            dayOfWeek: date.getDay(),
            isToday: isSameDay(date, new Date()),
            isFuture: date > new Date()
        });
    }

    return dates;
}

function formatDateISO(date) {
    // Build an ISO string using local date parts to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
async function loadAnalytics() {
    try {
        const [progressData, topHabitsData, completionData] = await Promise.all([
            fetch('/api/analytics/monthly-progress').then(r => r.json()),
            fetch('/api/analytics/top-habits').then(r => r.json()),
            fetch('/api/analytics/completion-ratio').then(r => r.json())
        ]);
        
        renderStats(progressData, topHabitsData, completionData);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function renderStats(progressData, topHabitsData, completionData) {
    // 1. Monthly Completion Rate (Average of last 30 days)
    const validDays = progressData.filter(d => d.percentage !== null);
    const avgCompletion = validDays.length > 0 
        ? (validDays.reduce((sum, d) => sum + d.percentage, 0) / validDays.length).toFixed(1) 
        : 0;
    document.getElementById('stat-monthly-progress').textContent = `${avgCompletion}%`;

    // 2. Top Habit
    const topHabit = topHabitsData.length > 0 ? topHabitsData[0] : null;
    document.getElementById('stat-top-habit').textContent = topHabit 
        ? `${topHabit.emoji} ${topHabit.name}` 
        : 'None yet';

    // 3. Total Check-ins (from completion data)
    document.getElementById('stat-total-checkins').textContent = completionData.completed;

    // 4. Current Streak (Calculated from daily completion > 0)
    // This is a simplified "global streak" - days in a row with at least one check-in
    let streak = 0;
    // progressData is ordered by date ascending. Reverse to check from today backwards.
    const reversedData = [...progressData].reverse();
    for (const day of reversedData) {
        if (day.completed > 0) {
            streak++;
        } else {
            // Allow today to be incomplete if it's just started, but break if yesterday was empty
            const isToday = isSameDay(new Date(day.date), new Date());
            if (!isToday) break;
        }
    }
    document.getElementById('stat-streak').textContent = `${streak} days`;
}
