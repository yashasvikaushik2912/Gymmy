let seconds = 0;
let timer;

function startTimer() {
    if (!timer) {
        timer = setInterval(updateTimer, 1000);
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
    }
}

function addSet(button) {
    const setGrid = button.closest('.exercise-set').querySelector('.set-grid');
    const setNumber = setGrid.children.length + 1;
    
    const setDiv = document.createElement('div');
    setDiv.className = 'set-input';
    setDiv.innerHTML = `
        <span>Set ${setNumber}</span>
        <input type="number" placeholder="Weight" min="0" step="0.5" class="weight-input">
        <input type="number" placeholder="Reps" min="1" class="reps-input">
        <button onclick="this.closest('.set-input').remove(); updateSetNumbers(this)">×</button>
    `;
    
    setGrid.appendChild(setDiv);
}

function updateSetNumbers(button) {
    const setGrid = button.closest('.set-grid');
    const sets = setGrid.querySelectorAll('.set-input');
    sets.forEach((set, index) => {
        set.querySelector('span').textContent = `Set ${index + 1}`;
    });
}

// Load exercises when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadExercises();
    checkAuth(); // Make sure user is logged in
});

async function loadExercises() {
    try {
        const response = await fetch('exercises.json');
        if (!response.ok) {
            throw new Error('Failed to fetch exercises');
        }
        
        const data = await response.json();
        const exercises = data.exercises;
        const select = document.getElementById('exerciseSelect');
        select.innerHTML = '<option value="">Select Exercise</option>';
        
        if (Array.isArray(exercises)) {
            exercises.forEach(exercise => {
                const option = document.createElement('option');
                option.value = exercise.name;
                option.textContent = exercise.name;
                select.appendChild(option);
            });
        } else {
            throw new Error('Invalid exercises data format');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load exercises');
    }
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
}

function resetTimer() {
    clearInterval(timer);
    timer = null;
    seconds = 0;
    updateTimerDisplay();
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
}

function updateTimer() {
    seconds++;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    document.getElementById('timer').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

async function finishWorkout() {
    const exercises = Array.from(document.getElementsByClassName('exercise-set')).map(exerciseDiv => {
        const name = exerciseDiv.querySelector('.exercise-name').textContent;
        const sets = Array.from(exerciseDiv.querySelectorAll('.set-input')).map(set => ({
            weight: parseFloat(set.querySelector('.weight-input').value) || 0,
            reps: parseInt(set.querySelector('.reps-input').value) || 0
        }));
        
        return {
            name,
            sets
        };
    });
    
    if (exercises.length === 0) {
        alert('Please add at least one exercise');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert('Please log in to save your workout');
        window.location.href = 'login.html';
        return;
    }

    if (!user.id) {
        alert('User ID not found. Please try logging out and logging in again.');
        return;
    }

    const workoutData = {
        user_id: user.id,
        duration: seconds,
        exercises: exercises
    };

    try {
        console.log('Sending workout data:', workoutData); // Debug log

        const response = await fetch('/api/workouts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workoutData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('Server response:', errorData); // Debug log
            throw new Error(errorData?.message || 'Failed to save workout');
        }

        const data = await response.json();
        console.log('Workout saved:', data); // Debug log

        alert('Workout saved successfully!');
        resetTimer();
        document.getElementById('currentWorkout').innerHTML = '';
        window.location.href = 'profile.html';  // Changed to profile.html since that's where we show workouts
    } catch (error) {
        console.error('Error saving workout:', error);
        alert(`Failed to save workout: ${error.message}`);
    }
}

function addExerciseToWorkout() {
    const exercise = document.getElementById('exerciseSelect').value;
    if (!exercise) {
        alert('Please select an exercise');
        return;
    }

    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-set';
    exerciseDiv.innerHTML = `
        <div class="exercise-header">
            <span class="exercise-name">${exercise}</span>
            <button onclick="this.closest('.exercise-set').remove()">Remove Exercise</button>
        </div>
        <div class="sets-container">
            <div class="set-grid"></div>
            <div class="set-controls">
                <button onclick="addSet(this)">Add Set</button>
            </div>
        </div>
    `;

    document.getElementById('currentWorkout').appendChild(exerciseDiv);
    addSet(exerciseDiv.querySelector('button'));
}