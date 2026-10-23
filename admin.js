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

let globalContentData = {}; 

// ================= 2. GLOBAL AUTHENTICATION & PAGE PROTECTION =================
document.addEventListener('DOMContentLoaded', () => {
    
    // Logout Button
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
        
        if (user && path.includes('admin-login.html')) {
            window.location.href = 'admin-dashboard.html';
        }
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
                .then(() => { window.location.href = 'admin-dashboard.html'; })
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
                .then(() => { window.location.href = 'admin-dashboard.html'; })
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
        db.ref('content').on('value', (snapshot) => {
            globalContentData = snapshot.val() || {};
            animeListContainer.innerHTML = '';
            movieListContainer.innerHTML = '';
            let hasAnime = false, hasMovies = false;
            let animeCount = 0, movieCount = 0;

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
                if (item.type === 'movie') { 
                    movieListContainer.innerHTML += listHTML; 
                    hasMovies = true; 
                    movieCount++;
                } else { 
                    animeListContainer.innerHTML += listHTML; 
                    hasAnime = true; 
                    animeCount++;
                }
            });

            if(document.getElementById('animeCount')) document.getElementById('animeCount').innerText = `${animeCount} Items`;
            if(document.getElementById('movieCount')) document.getElementById('movieCount').innerText = `${movieCount} Items`;

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
                seasons: {},
                gdrive_id: ""
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

        // Show/Hide Fields based on type
        uploadTitleSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            const movieFields = document.getElementById('uploadMovieFields');
            const animeFields = document.getElementById('uploadAnimeFields');
            const submitBtn = document.getElementById('uploadSubmitBtn');

            if(!selectedKey) {
                movieFields.style.display = 'none'; 
                animeFields.style.display = 'none'; 
                submitBtn.style.display = 'none';
                return;
            }
            submitBtn.style.display = 'flex';
            const item = globalContentData[selectedKey];

            if (item.type === 'movie') {
                movieFields.style.display = 'block'; 
                animeFields.style.display = 'none';
                
                // Pre-fill existing movie data if any
                if(item.qualities) {
                    document.getElementById('movieVideo480').value = item.qualities['480p'] || '';
                    document.getElementById('movieVideo720').value = item.qualities['720p'] || '';
                    document.getElementById('movieVideo1080').value = item.qualities['1080p'] || '';
                }
                document.getElementById('movieAudio').value = item.audio || 'Hindi';
                document.getElementById('movieSubtitle').value = item.subtitle || '';
            } else {
                movieFields.style.display = 'none'; 
                animeFields.style.display = 'block';
            }
        });

        // Submit Upload Form
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedKey = uploadTitleSelect.value;
            const item = globalContentData[selectedKey];
            const status = document.getElementById('uploadStatus');
            status.innerText = "Uploading..."; status.style.color = "#a855f7";

            if(item.type === 'movie') {
                const qualities = {
                    "480p": document.getElementById('movieVideo480').value.trim(),
                    "720p": document.getElementById('movieVideo720').value.trim(),
                    "1080p": document.getElementById('movieVideo1080').value.trim()
                };
                const audioLang = document.getElementById('movieAudio').value.trim() || "Hindi";
                const subtitleUrl = document.getElementById('movieSubtitle').value.trim();

                db.ref('content/' + selectedKey).update({
                    qualities: qualities,
                    audio: audioLang,
                    subtitle: subtitleUrl
                }).then(() => { 
                    status.innerText = "Movie Updated Successfully!"; 
                    status.style.color = "#22c55e";
                    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
                });
            } else {
                const seasonName = document.getElementById('uploadSeasonName').value.trim() || "Season 1";
                const epNo = document.getElementById('newEpNumber').value;
                const epTitle = document.getElementById('newEpTitle').value.trim();
                const audioLang = document.getElementById('animeAudio').value.trim() || "Hindi";
                
                if(!epNo || !epTitle) {
                    status.innerText = "Please fill Episode No and Title!"; status.style.color = "#ff4d4d"; return;
                }

                const newEp = { 
                    ep: parseInt(epNo), 
                    title: epTitle,
                    audio: audioLang,
                    qualities: {
                        "480p": document.getElementById('newEpVideo480').value.trim(),
                        "720p": document.getElementById('newEpVideo720').value.trim(),
                        "1080p": document.getElementById('newEpVideo1080').value.trim()
                    },
                    subtitle: document.getElementById('animeSubtitle').value.trim()
                };

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

        // Fetch Data
        db.ref('content/' + editId).once('value').then(snapshot => {
            const data = snapshot.val();
            if(data) {
                document.getElementById('editId').value = editId;
                document.getElementById('editTitle').value = data.title || '';
                document.getElementById('editType').value = data.type === 'movie' ? 'Movie' : 'Anime Series';
                document.getElementById('editImage').value = data.image || '';
                document.getElementById('editBanner').value = data.banner || '';
                document.getElementById('editRating').value = data.rating || '';
                document.getElementById('editYear').value = data.year || '';
                document.getElementById('editGenres').value = data.genres ? data.genres.join(', ') : '';
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
                banner: document.getElementById('editBanner').value.trim(),
                rating: parseFloat(document.getElementById('editRating').value) || 0,
                year: document.getElementById('editYear').value.trim(),
                genres: document.getElementById('editGenres').value.split(',').map(g => g.trim()).filter(g => g),
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

        // Delete Button Logic
        const deleteBtn = document.getElementById('deleteBtn');
        if(deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const id = document.getElementById('editId').value;
                if(confirm("Are you sure you want to delete this title? This action cannot be undone!")) {
                    db.ref('content/' + id).remove().then(() => {
                        alert("Content Deleted Successfully!");
                        window.location.href = 'admin-dashboard.html';
                    }).catch(err => alert("Error deleting: " + err.message));
                }
            });
        }
    }
});
