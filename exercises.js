function loadExercises() {
    // Fetch exercises from the JSON file
    fetch('exercises.json')
        .then(response => response.json())
        .then(data => {
            // Store exercises in localStorage
            localStorage.setItem('exercises', JSON.stringify(data.exercises));
            
            const user = JSON.parse(localStorage.getItem('user'));
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            
            // Get user's completed exercises from their workout history
            const completedExercises = new Set();
            if (user && users[user.email] && users[user.email].workouts) {
                users[user.email].workouts.forEach(workout => {
                    workout.exercises.forEach(exercise => {
                        completedExercises.add(exercise.split(' - ')[0]);
                    });
                });
            }

            displayExercises(data.exercises, completedExercises);
        })
        .catch(error => console.error('Error loading exercises:', error));
}


function displayExercises(exercises, completedExercises) {
    const exercisesList = document.getElementById('exercisesList');
    exercisesList.innerHTML = '';

    // Apply filters
    const categoryFilter = document.getElementById('categoryFilter').value;
    const muscleFilter = document.getElementById('muscleFilter').value;
    const difficultyFilter = document.getElementById('difficultyFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let filteredExercises = exercises.filter(exercise => {
        return (!categoryFilter || exercise.category === categoryFilter) &&
               (!muscleFilter || exercise.muscle === muscleFilter) &&
               (!difficultyFilter || exercise.difficulty === difficultyFilter);
    });

    // Sort exercises
    filteredExercises.sort((a, b) => {
        if (sortBy === 'difficulty') {
            const difficultyOrder = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
            return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        }
        return a[sortBy].localeCompare(b[sortBy]);
    });

    filteredExercises.forEach(exercise => {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        const isCompleted = completedExercises.has(exercise.name);
        
        card.innerHTML = `
            <img src="${exercise.image}" alt="${exercise.name}" class="exercise-image">
            <div class="exercise-content">
                <h3>${exercise.name}</h3>
                <p><strong>Category:</strong> ${exercise.category}</p>
                <p><strong>Muscle Group:</strong> ${exercise.muscle}</p>
                <p><strong>Difficulty:</strong> ${exercise.difficulty}</p>
                <p class="${isCompleted ? 'completed' : 'not-completed'}">
                    ${isCompleted ? '✓ Completed in workouts' : 'Not yet completed'}
                </p>
            </div>
        `;
        
        exercisesList.appendChild(card);
    });
}



function filterExercises() {
    loadExercises(); // This will reapply all filters and sort options
}