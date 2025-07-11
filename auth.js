function handleStartNow() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        window.location.href = 'workout.html';
    } else {
        window.location.href = 'signup.html';
    }
}

function validateSignup(event) {
    event.preventDefault();
    clearErrors();
    
    const email = document.getElementById('email').value;
    const name = document.getElementById('name').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        return false;
    }

    fetch('/api/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, name, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError('signupError', data.error);
        } else {
            // After successful registration, automatically log in
            return fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError('loginError', data.error);
        } else {
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('isLoggedIn', 'true');  // Add this line
            window.location.href = 'index.html';
        }
    })
    .catch(err => {
        showError('signupError', 'Failed to connect to server');
    });
    
    return false;
}

function validateLogin(event) {
    event.preventDefault();
    clearErrors();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Add validation for empty fields
    if (!email) {
        showError('loginError', 'Please enter your email');
        return false;
    }

    if (!password) {
        showError('loginError', 'Please enter your password');
        return false;
    }

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Login failed');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            showError('loginError', data.error);
        } else {
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'index.html';
        }
    })
    .catch(err => {
        // Check if it's an unregistered email
        fetch('/api/check-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        })
        .then(emailResponse => emailResponse.json())
        .then(emailData => {
            if (emailData.exists === false) {
                showError('loginError', 'Email not registered. Please sign up first.');
            } else {
                showError('loginError', 'Invalid login credentials. Please check your password.');
            }
        })
        .catch(() => {
            showError('loginError', 'Failed to connect to server');
        });
    });
    
    return false;
}
function clearErrors() {
    const errorElements = document.getElementsByClassName('error');
    for (let element of errorElements) {
        element.textContent = '';
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; // Get isLoggedIn status
    
    const navRight = document.querySelector('.nav-right');
    const profileLink = document.getElementById('profileLink'); // Get profile link by ID
    const loginBtn = document.querySelector('.login-btn'); // Assuming this is in index.html initially
    const signupBtn = document.querySelector('.signup-btn'); // Assuming this is in index.html initially

    if (navRight) {
        if (isLoggedIn && user) {
            // User is logged in
            if (profileLink) {
                profileLink.innerHTML = `<a href="profile.html" style="text-decoration: none; color: inherit;">My Profile (${user.name})</a>`;
                profileLink.style.display = 'inline-block';
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (signupBtn) signupBtn.style.display = 'none';

            // Add logout button if it doesn't exist
            let logoutButton = navRight.querySelector('.auth-btn.logout-btn-js'); // Use a specific class to find it
            if (!logoutButton) {
                logoutButton = document.createElement('button');
                logoutButton.textContent = 'Logout';
                logoutButton.className = 'auth-btn logout-btn-js'; // Add a class for styling/selection
                logoutButton.onclick = logout;
                navRight.appendChild(logoutButton);
            }
            logoutButton.style.display = 'inline-block';

        } else {
            // User is not logged in
            if (profileLink) profileLink.style.display = 'none';
            if (loginBtn) {
                loginBtn.style.display = 'inline-block';
                loginBtn.onclick = function() { window.location.href='login.html'; }; // Ensure onclick is set
            }
            if (signupBtn) {
                signupBtn.style.display = 'inline-block';
                signupBtn.onclick = function() { window.location.href='signup.html'; }; // Ensure onclick is set
            }
            
            // Remove logout button if it exists
            const logoutButton = navRight.querySelector('.auth-btn.logout-btn-js');
            if (logoutButton) logoutButton.remove();
        }
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    // Call checkAuth again to update UI immediately after logout, then redirect
    checkAuth(); 
    window.location.href = 'index.html';
}

async function checkServerHealth() {
    try {
        const response = await fetch('/api/exercises'); // Assuming this is a valid health check endpoint
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        return true;
    } catch (error) {
        console.error('Server is down:', error);
        // It's generally not a good idea to auto-logout on server health check failure
        // as it could be a temporary network blip. Consider just logging or notifying the user.
        // logout(); // Commenting this out for now, decide if this behavior is desired.
        return false;
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');  // Add this line to remove user data
    window.location.href = 'index.html';
}


function login(email, password) {
    // Add your login logic here
    localStorage.setItem('isLoggedIn', 'true');
    window.location.href = 'index.html';
}

// Add periodic health check
setInterval(checkServerHealth, 30000); // Check every 30 seconds


