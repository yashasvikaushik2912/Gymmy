async function loadProfile() { // Make the function async to use await
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.email) { // Assuming email is used as a unique identifier for fetching
        console.error('User data or user email not found in localStorage. Redirecting to login.');
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('profileName').textContent = user.name || 'User';

    try {
        // Assume your server uses the user's email or a user ID stored in 'user' object
        // Adjust '/api/workouts' and query parameter as needed for your backend
        // You might need to send an auth token in headers if your API is secured
        const response = await fetch(`/api/workouts?userId=${encodeURIComponent(user.email)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${user.token}` // If you use token-based auth
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch workouts, server error.' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const workouts = await response.json(); // Assuming the server returns an array of workout objects

        if (!Array.isArray(workouts)) {
            console.error('Received workout data is not an array:', workouts);
            throw new Error('Workout data format from server is incorrect.');
        }
        
        console.log(`Found ${workouts.length} workouts for ${user.email} from database.`);

        // Calculate stats
        const weeklyHours = calculateWeeklyHours(workouts);
        const currentStreak = calculateStreak(workouts);
        
        document.getElementById('weeklyHours').textContent = `${weeklyHours.toFixed(1)} hours`;
        document.getElementById('currentStreak').textContent = `${currentStreak} days`;
        document.getElementById('totalWorkouts').textContent = workouts.length;

        // Populate workout history
        const workoutList = document.getElementById('workoutList');
        if (workoutList) {
            if (workouts.length > 0) {
                workoutList.innerHTML = ''; 
                workouts.slice(-5).reverse().forEach(workout => {
                    const workoutItem = document.createElement('div');
                    workoutItem.className = 'workout-item';
                    const workoutDate = workout.date ? new Date(workout.date).toLocaleDateString() : 'N/A';
                    const workoutDuration = workout.duration ? formatDuration(workout.duration) : 'N/A';
                    const workoutExercises = Array.isArray(workout.exercises) ? workout.exercises.join(', ') : 'N/A';
                    workoutItem.innerHTML = `
                        <h4>Workout on ${workoutDate}</h4>
                        <p>Duration: ${workoutDuration}</p>
                        <p>Exercises: ${workoutExercises}</p>
                    `;
                    workoutList.appendChild(workoutItem);
                });
            } else {
                workoutList.innerHTML = '<p>No workouts recorded yet. Get started!</p>';
            }
        }

        // Create progress chart
        const chartCanvas = document.getElementById('progressChart');
        if (chartCanvas) {
            createProgressChart(workouts);
        }

    } catch (error) {
        console.error('Failed to load profile data:', error);
        const workoutList = document.getElementById('workoutList');
        if (workoutList) {
            workoutList.innerHTML = `<p>Error loading workout data: ${error.message}. Please try again later.</p>`;
        }
        // Optionally clear other stats or show error messages for them too
        document.getElementById('weeklyHours').textContent = 'Error';
        document.getElementById('currentStreak').textContent = 'Error';
        document.getElementById('totalWorkouts').textContent = 'Error';
    }
}

// Helper functions (calculateWeeklyHours, calculateStreak, formatDuration, createProgressChart)
// remain the same as in the previous response, ensuring they handle empty workout arrays gracefully.

// Ensure calculateWeeklyHours, calculateStreak, formatDuration, and createProgressChart
// are robust and can handle an empty `workouts` array without errors.
// For example, in calculateWeeklyHours:
function calculateWeeklyHours(workouts) {
    if (!workouts || workouts.length === 0) return 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return workouts
        .filter(w => w.date && new Date(w.date) > oneWeekAgo) // Check w.date exists
        .reduce((total, w) => total + ((w.duration || 0) / 3600), 0); // Use w.duration || 0
}

// In calculateStreak:
function calculateStreak(workouts) {
    if (!workouts || workouts.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));

    for (let i = 0; i < sortedWorkouts.length; i++) {
        if (!sortedWorkouts[i].date) continue; 
        const workoutDate = new Date(sortedWorkouts[i].date);
        workoutDate.setHours(0, 0, 0, 0);
        
        if (workoutDate.getTime() === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1); 
        } else if (workoutDate.getTime() < currentDate.getTime()) {
            break;
        }
    }
    return streak;
}

function formatDuration(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function createProgressChart(workouts) {
    const canvasElement = document.getElementById('progressChart');
    if (!canvasElement) {
        console.warn('Canvas element for progress chart not found.');
        return;
    }
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    if (window.myProfileChart instanceof Chart) {
        window.myProfileChart.destroy();
    }

    if (!workouts || workouts.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8f9fa'; 
        ctx.fillText('No workout data available for chart.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const last4Weeks = Array.from({length: 4}, (_, i) => {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1); // Start from Monday of the week
        weekStart.setHours(0,0,0,0);
        return weekStart;
    }).reverse();

    const weeklyData = last4Weeks.map(weekStart => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        return workouts
            .filter(w => {
                if (!w.date) return false;
                const date = new Date(w.date);
                return date >= weekStart && date < weekEnd;
            })
            .reduce((total, w) => total + ((w.duration || 0) / 3600), 0);
    });

    window.myProfileChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last4Weeks.map(date => `Week of ${date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`),
            datasets: [{
                label: 'Weekly Workout Hours',
                data: weeklyData,
                borderColor: '#e63946',
                backgroundColor: 'rgba(230, 57, 70, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f8f9fa'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#f8f9fa'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#f8f9fa'
                    }
                }
            }
        }
    });
}

// Make sure loadProfile is called when the body loads
// This is typically in profile.html: <body onload="checkAuth(); loadProfile();">