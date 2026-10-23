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

let globalContentData = {}; // Data store for Upload & Dashboard pages

// ================= 2. GLOBAL AUTHENTICATION & PAGE PROTECTION =================
document.addEventListener('DOMContentLoaded', () => {
    
    // Logout Button Logic (Header me har page par hai)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'admin-login.html';
            });
        });
    }

    // Auth State Check (Page Protection)
    auth.onAuthStateChanged((user) => {
        const path = window.location.href;
        
        // Agar login page par hain aur user logged in hai, toh dashboard bhejo
        if (user && path.includes('admin-login.html')) {
            window.location.href = 'admin-dashboard.html';
        }
        
        // Agar kisi admin page par hain aur logged in nahi hai, toh login bhejo
        if (!user && !path.includes('admin-login.html')) {
            window.location.href = 'admin-login.html';
        }
    });


    // ================= 3. LOGIN PAGE LOGIC =================
    const loginBtn = document.getElementById('loginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const loginError = document.getElementById('loginError');

    // Email/Password Login
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            
            if(!email || !password) {
                loginError.innerText = "Please enter Email and Password.";
                loginError.style.color = "#ff4d4d";
                return;
            }

            loginError.innerText = "Logging in...";
            loginError.style.color = "#a855f7";

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    window.location.href = 'admin-dashboard.html'; 
                })
                .catch((error) => {
                    loginError.innerText = "Invalid Email or Password!";
                    loginError.style.color = "#ff4d4d";
                });
        });
    }

    // Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const provider = new firebase.auth.GoogleAuthProvider();
            loginError.innerText = "Opening Google...";
            
            auth.signInWithPopup(provider)
                .then(() => {
                    window.location.href = 'admin-dashboard.html';
                })
                .catch((error) => {
                    if (error.code === 'auth/popup-blocked') {
                        auth.signInWithRedirect(provider);
                    } else {
                        loginError.innerText = "Error: " + error.message;
                        loginError.style.color = "#ff4d4d";
                    }
                });
        });
    }

    // Check Google Redirect Result
    auth.getRedirectResult().then((result) => {
        if (result.user && window.location.href.includes('admin-login.html')) {
            window.location.href = 'admin-dashboard.html'; 
        }
    });


    // ================= 4. DASHBOARD PAGE LOGIC =================
    const animeListContainer = document.getElementById('animeListContainer');
    const movieListContainer = document.getElementById('movieListContainer');

    if (animeListContainer && movieListContainer) {
        // Real-time data fetch for Dashboard
        db.ref('content').on('value', (snapshot) => {
            globalContentData = snapshot.val() || {};
            animeListContainer.innerHTML = '';
            movieListContainer.innerHTML = '';
            let hasAnime = false, hasMovies = false;

            Object.keys(globalContentData).forEach(key => {
                const item = globalContentData[key];
                const listHTML = `
                    <div class="list-item">
                        <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/50x75'">
                        <div class="list-item-info">
                            <h4>${item.title}</h4>
                            <p>${item.type === 'movie' ? 'Movie' : 'Anime'} | ${item.year || 'N/A'}</p>
                        </div>
                        <button class="edit-btn" onclick="window.location.href='admin-edit.html?id=${key}'"><i class="fa-solid fa-pen"></i> Edit</button>
                    </div>
                `;
                if (item.type === 'movie') { movieListContainer.innerHTML += listHTML; hasMovies = true; }
                else { animeListContainer.innerHTML += listHTML; hasAnime = true; }
            });

            if(!hasAnime) animeListContainer.innerHTML = '<p class="loading-text">No Anime added yet.</p>';
            if(!hasMovies) movieListContainer.innerHTML = '<p class="loading-text">No Movies added yet.</p>';
        });
    }


    // ================= 5. ADD TITLE PAGE LOGIC =================
    const addTitleForm = document.getElementById('addTitleForm');
    if (addTitleForm) {
        addTitleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const status = document.getElementById('addStatus');
            status.innerText = "Saving..."; status.style.color = "#a855f7";

            const type = document.getElementById('addType').value;
            const newData = {
                title: document.getElementById('addTitle').value.trim(),
                type: type,
                image: document.getElementById('addImage').value.trim(),
                banner: document.getElementById('addBanner').value.trim() || document.getElementById('addImage').value.trim(),
                rating: parseFloat(document.getElementById('addRating').value) || 0,
                year: document.getElementById('addYear').value.trim() || new Date().getFullYear().toString(),
                genres: document.getElementById('addGenres').value.split(',').map(g => g.trim()).filter(g => g),
                synopsis: document.getElementById('addSynopsis').value.trim(),
                seasons: {}, // Empty init
                gdrive_id: "" // Empty init
            };

            db.ref('content').push(newData).then(() => {
                status.innerText = "Title Added Successfully! Redirecting...";
                status.style.color = "#22c55e";
                setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
            }).catch(err => { 
                status.innerText = "Error: " + err.message; status.style.color = "#ff4d4d"; 
            });
        });
    }


    // ================= 6. UPLOAD PAGE LOGIC =================
    const uploadTitleSelect = document.getElementById('uploadTitleSelect');
    if (uploadTitleSelect) {
        // Populate Dropdown
        db.ref('content').on('value', (snapshot) => {
            globalContentData = snapshot.val() || {};
            uploadTitleSelect.innerHTML = '<option value="">-- Select Content --</option>';
            Object.keys(globalContentData).forEach(key => {
                const item = globalContentData[key];
                uploadTitleSelect.innerHTML += `<option value="${key}">${item.title} (${item.type})</option>`;
            });
        });

        // Change Event to Show/Hide Fields
        uploadTitleSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            const movieFields = document.getElementById('uploadMovieFields');
            const animeFields = document.getElementById('uploadAnimeFields');
            const submitBtn = document.getElementById('uploadSubmitBtn');

            if(!selectedKey) {
                movieFields.style.display = 'none'; animeFields.style.display = 'none'; submitBtn.style.display = 'none';
                return;
            }
            submitBtn.style.display = 'flex';
            const item = globalContentData[selectedKey];

            if (item.type === 'movie') {
                movieFields.style.display = 'block'; animeFields.style.display = 'none';
                document.getElementById('movieVideoId').value = item.gdrive_id || '';
            } else {
                movieFields.style.display = 'none'; animeFields.style.display = 'block';
            }
        });

        // Submit Upload
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedKey = uploadTitleSelect.value;
            const item = globalContentData[selectedKey];
            const status = document.getElementById('uploadStatus');
            status.innerText = "Uploading..."; status.style.color = "#a855f7";

            if(item.type === 'movie') {
                db.ref('content/' + selectedKey + '/gdrive_id').set(document.getElementById('movieVideoId').value.trim())
                    .then(() => { 
                        status.innerText = "Movie Video Updated!"; 
                        status.style.color = "#22c55e";
                        setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
                    });
            } else {
                const seasonName = document.getElementById('uploadSeasonName').value.trim() || "Season 1";
                const epNo = document.getElementById('newEpNumber').value;
                const epTitle = document.getElementById('newEpTitle').value.trim();
                const epVideoId = document.getElementById('newEpVideoId').value.trim();

                if(!epNo || !epTitle || !epVideoId) {
                    status.innerText = "Please fill all episode fields!"; status.style.color = "#ff4d4d"; return;
                }
                const newEp = { ep: parseInt(epNo), title: epTitle, gdrive_id: epVideoId };

                db.ref(`content/${selectedKey}/seasons/${seasonName}`).push(newEp).then(() => {
                    status.innerText = `Episode Added Successfully!`;
                    status.style.color = "#22c55e";
                    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
                });
            }
        });
    }


    // ================= 7. EDIT PAGE LOGIC =================
    const editForm = document.getElementById('editForm');
    if (editForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');

        if(!editId) { window.location.href = 'admin-dashboard.html'; return; }

        // Fetch Data for specific item
        db.ref('content/' + editId).once('value').then(snapshot => {
            const data = snapshot.val();
            if(data) {
                document.getElementById('editId').value = editId;
                document.getElementById('editTitle').value = data.title || '';
                document.getElementById('editImage').value = data.image || '';
                document.getElementById('editRating').value = data.rating || '';
                document.getElementById('editYear').value = data.year || '';
                document.getElementById('editSynopsis').value = data.synopsis || '';
            }
        });

        // Update Data
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const status = document.getElementById('editStatus');
            status.innerText = "Updating..."; status.style.color = "#a855f7";

            const updatedData = {
                title: document.getElementById('editTitle').value.trim(),
                image: document.getElementById('editImage').value.trim(),
                rating: parseFloat(document.getElementById('editRating').value) || 0,
                year: document.getElementById('editYear').value.trim(),
                synopsis: document.getElementById('editSynopsis').value.trim()
            };

            db.ref('content/' + id).update(updatedData).then(() => {
                status.innerText = "Updated Successfully! Redirecting...";
                status.style.color = "#22c55e";
                setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
            }).catch(err => { 
                status.innerText = "Error: " + err.message; status.style.color = "#ff4d4d"; 
            });
        });
    }
});
