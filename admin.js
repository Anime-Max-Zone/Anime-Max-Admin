// ================= 1. FIREBASE SETUP =================
const firebaseConfig = {
  apiKey: "AIzaSyCpfrluxsBhnz48ve9RykIy1IxzbBfk7dA",
  authDomain: "sm-studio-7.firebaseapp.com",
  databaseURL: "https://sm-studio-7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sm-studio-7",
  storageBucket: "sm-studio-7.firebasestorage.app",
  messagingSenderId: "126291501472",
  appId: "1:126291501472:web:47386660af8ec3a57204c5",
  measurementId: "G-4X9Q0761SB"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// ================= 2. AUTHENTICATION LOGIC =================
// DOM Elements (Agar page par hain tabhi kaam karega)
const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Email/Password Login
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                window.location.href = 'admin-dashboard.html'; // Login success
            })
            .catch((error) => {
                loginError.innerText = error.message;
            });
    });
}

// Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(() => {
                window.location.href = 'admin-dashboard.html'; // Login success
            })
            .catch((error) => {
                loginError.innerText = error.message;
            });
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'admin-login.html';
        });
    });
}

// Auth State Change (Page Protect karega)
auth.onAuthStateChanged((user) => {
    if (user) {
        // Agar user logged in hai aur login page par hai, toh dashboard bhej do
        if (window.location.pathname.includes('admin-login')) {
            window.location.href = 'admin-dashboard.html';
        }
    } else {
        // Agar user logged out hai aur dashboard par hai, toh login page bhej do
        if (window.location.pathname.includes('admin-dashboard')) {
            window.location.href = 'admin-login.html';
        }
    }
});


// ================= 3. DASHBOARD DYNAMIC FORM LOGIC =================
const contentType = document.getElementById('contentType');
const dynamicFields = document.getElementById('dynamicFields');
const contentForm = document.getElementById('contentForm');
const uploadStatus = document.getElementById('uploadStatus');

// Dropdown change hone par UI update karein
if (contentType) {
    contentType.addEventListener('change', () => {
        if (contentType.value === 'movie') {
            // Movie Input
            dynamicFields.innerHTML = `
                <div class="input-group full-width">
                    <label>Google Drive Video ID / URL</label>
                    <input type="text" id="movieVideoId" class="admin-input" placeholder="Enter GDrive ID or Link" required>
                </div>
            `;
        } else {
            // Anime Input (Seasons)
            dynamicFields.innerHTML = `
                <div class="season-box">
                    <h4>Season 1 Episodes</h4>
                    <div id="episodesContainer">
                        <div class="ep-row">
                            <input type="number" class="admin-input" placeholder="Ep No." style="width: 80px;" value="1">
                            <input type="text" class="admin-input" placeholder="Episode Title" required>
                            <input type="text" class="admin-input" placeholder="GDrive ID / Link" required>
                        </div>
                    </div>
                    <button type="button" class="add-ep-btn" id="addEpBtn">+ Add Another Episode</button>
                </div>
            `;
            
            // Add Episode Button Logic
            document.getElementById('addEpBtn').addEventListener('click', () => {
                const container = document.getElementById('episodesContainer');
                const epCount = container.children.length + 1;
                const newRow = document.createElement('div');
                newRow.className = 'ep-row';
                newRow.innerHTML = `
                    <input type="number" class="admin-input" placeholder="Ep No." style="width: 80px;" value="${epCount}">
                    <input type="text" class="admin-input" placeholder="Episode Title" required>
                    <input type="text" class="admin-input" placeholder="GDrive ID / Link" required>
                `;
                container.appendChild(newRow);
            });
        }
    });
    // Trigger initial state
    contentType.dispatchEvent(new Event('change'));
}


// ================= 4. FORM SUBMIT (UPLOAD DATA TO FIREBASE) =================
if (contentForm) {
    contentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        uploadStatus.innerText = "Uploading... Please wait.";
        uploadStatus.style.color = "#a855f7";

        const type = contentType.value;
        const title = document.getElementById('contentTitle').value;
        const image = document.getElementById('contentImage').value;
        const banner = document.getElementById('contentBanner').value || image;
        const rating = document.getElementById('contentRating').value;
        const year = document.getElementById('contentYear').value;
        const synopsis = document.getElementById('contentSynopsis').value;
        
        // Genres ko array me convert karein
        const genresString = document.getElementById('contentGenres').value;
        const genres = genresString.split(',').map(g => g.trim()).filter(g => g);

        // Firebase me bhejne ke liye object banayein
        let finalData = {
            title: title,
            type: type,
            image: image,
            banner: banner,
            rating: rating,
            year: year,
            genres: genres,
            synopsis: synopsis
        };

        if (type === 'movie') {
            // Movie ke liye
            const movieVideoId = document.getElementById('movieVideoId').value;
            finalData.gdrive_id = movieVideoId;
        } else {
            // Anime ke liye (Episodes collect karein)
            const epRows = document.querySelectorAll('#episodesContainer .ep-row');
            let episodesArray = [];
            
            epRows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                episodesArray.push({
                    ep: inputs[0].value,
                    title: inputs[1].value,
                    gdrive_id: inputs[2].value
                });
            });

            finalData.seasons = {
                "Season 1": episodesArray
            };
        }

        // Push to Firebase
        db.ref('content').push(finalData)
            .then(() => {
                uploadStatus.innerText = "Content Uploaded Successfully!";
                uploadStatus.style.color = "#22c55e";
                contentForm.reset();
                contentType.dispatchEvent(new Event('change')); // Reset dynamic fields
                setTimeout(() => { uploadStatus.innerText = ""; }, 3000);
            })
            .catch((error) => {
                uploadStatus.innerText = "Error: " + error.message;
                uploadStatus.style.color = "#ff4d4d";
            });
    });
}
