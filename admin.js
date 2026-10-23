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
document.addEventListener('DOMContentLoaded', () => {
    
    const loginBtn = document.getElementById('loginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    // ================= GOOGLE REDIRECT RESULT CHECK =================
    // Ye check karega ki agar user redirect hokar wapas aaya hai (Agar popup block hua tha)
    auth.getRedirectResult().then((result) => {
        if (result.user) {
            window.location.href = 'admin-dashboard.html'; 
        }
    }).catch((error) => {
        if (loginError) {
            loginError.innerText = "Google Auth Error: " + error.message;
            loginError.style.color = "#ff4d4d";
        }
    });

    // Email/Password Login
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Page refresh rokne ke liye

            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            
            if(!email || !password) {
                loginError.innerText = "Please enter Email and Password.";
                loginError.style.color = "#ff4d4d";
                return;
            }

            loginError.innerText = "Logging in... Please wait.";
            loginError.style.color = "#a855f7";

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    alert("Login Successful!");
                    window.location.href = 'admin-dashboard.html'; 
                })
                .catch((error) => {
                    console.error("Login Error:", error);
                    if(error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        loginError.innerText = "Invalid Email or Password!";
                    } else if (error.code === 'auth/network-request-failed') {
                        loginError.innerText = "Network Error! Check your internet.";
                    } else {
                        loginError.innerText = error.message;
                    }
                    loginError.style.color = "#ff4d4d";
                });
        });
    }

    // Google Login (Fixed for Mobile)
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const provider = new firebase.auth.GoogleAuthProvider();
            
            loginError.innerText = "Opening Google Login...";
            loginError.style.color = "#a855f7";

            // Sabse pehle Popup try karenge (Mobile me zyada reliable hai)
            auth.signInWithPopup(provider)
                .then((result) => {
                    alert("Google Login Successful!");
                    window.location.href = 'admin-dashboard.html';
                })
                .catch((error) => {
                    console.error("Google Popup Error:", error);
                    // Agar popup block ho jaye, toh Redirect try karo
                    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                        loginError.innerText = "Popup blocked. Redirecting...";
                        auth.signInWithRedirect(provider);
                    } else {
                        loginError.innerText = "Google Error: " + error.message;
                        loginError.style.color = "#ff4d4d";
                    }
                });
        });
    }

    // Auth State Change (Dashboard Protect karega)
    auth.onAuthStateChanged((user) => {
        const path = window.location.href;
        if (user && path.includes('admin-login.html')) {
            window.location.href = 'admin-dashboard.html';
        }
    });

    // ================= 3. DASHBOARD LOGIC =================
    const contentType = document.getElementById('contentType');
    const dynamicFields = document.getElementById('dynamicFields');
    const contentForm = document.getElementById('contentForm');
    const uploadStatus = document.getElementById('uploadStatus');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'admin-login.html';
            });
        });
    }

    if (contentType) {
        contentType.addEventListener('change', () => {
            if (contentType.value === 'movie') {
                dynamicFields.innerHTML = `
                    <div class="input-group full-width">
                        <label>Google Drive Video ID / URL</label>
                        <input type="text" id="movieVideoId" class="admin-input" placeholder="Enter GDrive ID or Link" required>
                    </div>
                `;
            } else {
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
        contentType.dispatchEvent(new Event('change'));
    }

    if (contentForm) {
        contentForm.addEventListener('submit', (e) => {
            e.preventDefault();

            if (!auth.currentUser) {
                alert("You must be logged in to add content!");
                window.location.href = 'admin-login.html';
                return;
            }
            
            uploadStatus.innerText = "Uploading... Please wait.";
            uploadStatus.style.color = "#a855f7";

            const type = contentType.value;
            const title = document.getElementById('contentTitle').value.trim();
            const image = document.getElementById('contentImage').value.trim();
            const banner = document.getElementById('contentBanner').value.trim() || image;
            const rating = parseFloat(document.getElementById('contentRating').value) || 0;
            const year = parseInt(document.getElementById('contentYear').value) || new Date().getFullYear();
            const synopsis = document.getElementById('contentSynopsis').value.trim();
            
            const genresString = document.getElementById('contentGenres').value;
            const genres = genresString.split(',').map(g => g.trim()).filter(g => g);

            let finalData = {
                title: title, type: type, image: image, banner: banner,
                rating: rating, year: year, genres: genres, synopsis: synopsis
            };

            if (type === 'movie') {
                finalData.gdrive_id = document.getElementById('movieVideoId').value.trim();
            } else {
                const epRows = document.querySelectorAll('#episodesContainer .ep-row');
                let episodesArray = [];
                epRows.forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    episodesArray.push({
                        ep: parseInt(inputs[0].value),
                        title: inputs[1].value.trim(),
                        gdrive_id: inputs[2].value.trim()
                    });
                });
                finalData.seasons = { "Season 1": episodesArray };
            }

            db.ref('content').push(finalData)
                .then(() => {
                    uploadStatus.innerText = "Content Uploaded Successfully!";
                    uploadStatus.style.color = "#22c55e";
                    contentForm.reset();
                    contentType.dispatchEvent(new Event('change')); 
                    setTimeout(() => { uploadStatus.innerText = ""; }, 3000);
                })
                .catch((error) => {
                    uploadStatus.innerText = "Error: " + error.message;
                    uploadStatus.style.color = "#ff4d4d";
                });
        });
    }
});
