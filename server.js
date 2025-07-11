const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const path = require('path');
const app = express();
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));


app.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    // Get local IP address for easy access
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Access on your network at: http://${net.address}:${PORT}`);
            }
        }
    }
});
// User Routes
app.post('/api/register', async (req, res) => {
    const { email, name, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
            [email, name, hash]
        );
        res.json({ message: 'User registered successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

app.get('/api/exercises', (req, res) => {
    try {
        const exercisesPath = path.join(__dirname, 'exercises.json');
        const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
        res.json(exercises);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch exercises' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (match) {
            res.json({
                id: user.id,
                email: user.email,
                name: user.name,
                created_at: user.created_at
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Workout Routes
app.post('/api/workouts', async (req, res) => {
    const { user_id, duration, exercises } = req.body;
    const conn = await pool.getConnection();
    
    try {
        console.log('Received workout data:', { user_id, duration, exercises }); // Debug log
        
        await conn.beginTransaction();
        
        // Insert workout
        const [workoutResult] = await conn.execute(
            'INSERT INTO workouts (user_id, date, duration) VALUES (?, NOW(), ?)',
            [user_id, duration]
        );
        const workout_id = workoutResult.insertId;
        
        // Insert exercises and their sets
        for (const exercise of exercises) {
            console.log('Processing exercise:', exercise.name); // Debug log
            
            try {
                // First ensure the exercise exists in the exercises table
                await conn.execute(
                    'INSERT IGNORE INTO exercises (name, category) VALUES (?, ?)',
                    [exercise.name, 'General'] // Using 'General' as default category
                );
                
                // Get the exercise ID
                const [exerciseRows] = await conn.execute(
                    'SELECT id FROM exercises WHERE name = ?',
                    [exercise.name]
                );
                
                if (!exerciseRows || exerciseRows.length === 0) {
                    throw new Error(`Exercise not found: ${exercise.name}`);
                }
                
                const exercise_id = exerciseRows[0].id;
                
                // Insert the sets
                for (const [index, set] of exercise.sets.entries()) {
                    await conn.execute(
                        'INSERT INTO workout_exercises (workout_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?, ?)',
                        [workout_id, exercise_id, index + 1, set.weight, set.reps]
                    );
                }
            } catch (exerciseError) {
                console.error('Error processing exercise:', exercise.name, exerciseError);
                throw exerciseError;
            }
        }
        
        await conn.commit();
        res.json({ 
            success: true,
            message: 'Workout saved successfully',
            workout_id: workoutResult.insertId 
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error saving workout:', err);
        res.status(500).json({ 
            error: 'Failed to save workout',
            details: err.message,
            stack: err.stack // Adding stack trace for debugging
        });
    } finally {
        conn.release();
    }
});

app.get('/api/workouts', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ message: 'User ID (email) is required.' });
    }

    console.log(`Fetching workouts for userId: ${userId}`);

    try {
        // First get the user's ID from their email
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        const user_id = users[0].id;
        
        // Now fetch the workouts using the numeric user_id
        const [rows] = await pool.execute(`
            SELECT w.*, we.set_number, we.weight, we.reps, e.name as exercise_name
            FROM workouts w
            JOIN workout_exercises we ON w.id = we.workout_id
            JOIN exercises e ON we.exercise_id = e.id
            WHERE w.user_id = ?
            ORDER BY w.date DESC
        `, [user_id]);
        
        // Transform the data
        const workouts = rows.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = {
                    id: row.id,
                    date: row.date,
                    duration: row.duration,
                    exercises: []
                };
            }
            
            // Add exercise name to the exercises array if not already there
            if (!acc[row.id].exercises.includes(row.exercise_name)) {
                acc[row.id].exercises.push(row.exercise_name);
            }
            
            return acc;
        }, {});
        
        res.json(Object.values(workouts));
    } catch (error) {
        console.error('Error fetching workouts from database:', error);
        res.status(500).json({ message: 'Failed to retrieve workouts due to a server error.' });
    }
});

app.get('/api/workouts/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = await pool.execute(`
            SELECT w.*, we.set_number, we.weight, we.reps, e.name as exercise_name
            FROM workouts w
            JOIN workout_exercises we ON w.id = we.workout_id
            JOIN exercises e ON we.exercise_id = e.id
            WHERE w.user_id = ?
            ORDER BY w.date DESC
        `, [userId]);
        
        // Transform the data
        const workouts = rows.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = {
                    id: row.id,
                    date: row.date,
                    duration: row.duration,
                    exercises: {}
                };
            }
            if (!acc[row.id].exercises[row.exercise_name]) {
                acc[row.id].exercises[row.exercise_name] = [];
            }
            acc[row.id].exercises[row.exercise_name].push({
                set_number: row.set_number,
                weight: row.weight,
                reps: row.reps
            });
            return acc;
        }, {});
        
        res.json(Object.values(workouts));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
});

app.post('/api/check-email', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.execute(
            'SELECT COUNT(*) as count FROM users WHERE email = ?',
            [email]
        );
        res.json({ exists: users[0].count > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/profile/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const [users] = await pool.execute(
            'SELECT id, email, name, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});




app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});