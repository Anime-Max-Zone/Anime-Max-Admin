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
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => { window.location.href = 'admin-login.html'; });
        });
    }

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

    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            
            if(!email || !password) {
                loginError.innerText = "Please enter Email and Password."; loginError.style.color = "#ff4d4d"; return;
            }

            loginError.innerText = "Logging in..."; loginError.style.color = "#a855f7";

            auth.signInWithEmailAndPassword(email, password)
                .then(() => { window.location.href = 'admin-dashboard.html'; })
                .catch((error) => {
                    loginError.innerText = "Invalid Email or Password!"; loginError.style.color = "#ff4d4d";
                });
        });
    }

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const provider = new firebase.auth.GoogleAuthProvider();
            loginError.innerText = "Opening Google...";
            
            auth.signInWithPopup(provider)
                .then(() => { window.location.href = 'admin-dashboard.html'; })
                .catch((error) => {
                    if (error.code === 'auth/popup-blocked') { auth.signInWithRedirect(provider); } 
                    else { loginError.innerText = "Error: " + error.message; loginError.style.color = "#ff4d4d"; }
                });
        });
    }

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
                
                // 🔥 FIX: Anime click par Series Page khulega, Movie click par Movie Edit Page
                const targetUrl = item.type === 'movie' ? `admin-movie-edit.html?id=${key}` : `admin-series.html?id=${key}`;
                
                const listHTML = `
                    <div class="list-item">
                        <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/50x75'" onclick="window.location.href='${targetUrl}'" style="cursor:pointer;">
                        <div class="list-item-info" style="cursor: pointer;" onclick="window.location.href='${targetUrl}'">
                            <h4>${item.title}</h4>
                            <p>${item.type === 'movie' ? 'Movie' : 'Anime'} | ${item.year || 'N/A'}</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-btn" onclick="window.location.href='admin-edit.html?id=${key}'"><i class="fa-solid fa-pen"></i></button>
                            <button class="edit-btn" style="border-color:#ff4d4d; color:#ff4d4d; background:rgba(255,77,77,0.1);" onclick="deleteItem('${key}', '${item.title}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
                if (item.type === 'movie') { movieListContainer.innerHTML += listHTML; hasMovies = true; movieCount++; } 
                else { animeListContainer.innerHTML += listHTML; hasAnime = true; animeCount++; }
            });

            if(document.getElementById('animeCount')) document.getElementById('animeCount').innerText = `${animeCount} Items`;
            if(document.getElementById('movieCount')) document.getElementById('movieCount').innerText = `${movieCount} Items`;

            if(!hasAnime) animeListContainer.innerHTML = '<p class="loading-text">No Anime added yet.</p>';
            if(!hasMovies) movieListContainer.innerHTML = '<p class="loading-text">No Movies added yet.</p>';
        });
    }

    // Global Delete Function for Dashboard
    window.deleteItem = (id, title) => {
        if(confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone!`)) {
            db.ref('content/' + id).remove().then(() => {
                alert("Deleted Successfully!");
            }).catch(err => alert("Error: " + err.message));
        }
    };


    // ================= 4.5 SERIES DETAILS PAGE LOGIC =================
    const seriesInfoCard = document.getElementById('seriesInfoCard');
    if (seriesInfoCard) {
        const seriesId = new URLSearchParams(window.location.search).get('id');
        if (!seriesId) { window.location.href = 'admin-dashboard.html'; }

        // Edit aur Add Episode Buttons
        document.getElementById('editSeriesBtn').onclick = () => window.location.href = `admin-edit.html?id=${seriesId}`;
        document.getElementById('uploadEpBtn').onclick = () => window.location.href = `admin-upload.html?series_id=${seriesId}`;

        // Series Data aur Episodes List Load karein
        db.ref('content/' + seriesId).on('value', snapshot => {
            const data = snapshot.val();
            if(data) {
                seriesInfoCard.style.display = 'block';
                document.getElementById('seriesImage').src = data.image;
                document.getElementById('seriesTitle').innerText = data.title;
                document.getElementById('seriesYear').innerText = data.year;

                const epContainer = document.getElementById('episodesListContainer');
                epContainer.innerHTML = '';
                
                if(data.seasons) {
                    Object.keys(data.seasons).forEach(seasonName => {
                        // Season Header
                        epContainer.innerHTML += `<h4 style="color: #a855f7; margin: 15px 0 10px 0;">${seasonName}</h4>`;
                        
                        const episodes = data.seasons[seasonName];
                        const epArray = Object.keys(episodes).map(k => ({ firebaseKey: k, ...episodes[k] }));

                        epArray.forEach(ep => {
                            epContainer.innerHTML += `
                                <div class="list-item" style="padding: 10px 15px;">
                                    <div class="list-item-info">
                                        <h4 style="font-size: 14px;">Ep ${ep.ep}: ${ep.title}</h4>
                                        <p style="font-size: 11px; color:#888;">Q: ${ep.qualities ? Object.keys(ep.qualities).join(', ') : 'N/A'}</p>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <!-- Episode Edit Button -->
                                        <button class="edit-btn" onclick="window.location.href='admin-episode-edit.html?series=${seriesId}&season=${encodeURIComponent(seasonName)}&ep=${ep.firebaseKey}'"><i class="fa-solid fa-pen"></i></button>
                                        <!-- Episode Delete Button -->
                                        <button class="edit-btn" style="border-color:#ff4d4d; color:#ff4d4d; background:rgba(255,77,77,0.1);" onclick="deleteEpisode('${seriesId}', '${seasonName}', '${ep.firebaseKey}', '${ep.title}')"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            `;
                        });
                    });
                } else {
                    epContainer.innerHTML = '<p class="loading-text">No Episodes added yet.</p>';
                }
            }
        });
    }

    // Global function to delete Episode
    window.deleteEpisode = (seriesId, seasonName, epKey, epTitle) => {
        if(confirm(`Delete ${epTitle} from ${seasonName}?`)) {
            db.ref(`content/${seriesId}/seasons/${seasonName}/${epKey}`).remove().then(() => {
                alert("Episode Deleted!");
            });
        }
    };


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
            }).catch(err => { status.innerText = "Error: " + err.message; status.style.color = "#ff4d4d"; });
        });
    }


    // ================= 6. UPLOAD PAGE LOGIC (Dynamic Dropdowns) =================
    const uploadTitleSelect = document.getElementById('uploadTitleSelect');
    
    window.addLink = (containerId, labelId, urlId) => {
        const label = document.getElementById(labelId).value;
        const url = document.getElementById(urlId).value.trim();
        if(!label || !url) { alert("Please fill Label and URL!"); return; }

        const container = document.getElementById(containerId);
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #0d0d12; padding: 8px 12px; border-radius: 6px; margin-bottom: 5px; border: 1px solid #2a2a35;";
        row.innerHTML = `
            <div style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <strong>${label}</strong>: <span style="color: #888;">${url}</span>
            </div>
            <button type="button" style="background:none; border:none; color:#ff4d4d; cursor:pointer;" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
            <input type="hidden" class="link-label" value="${label}">
            <input type="hidden" class="link-url" value="${url}">
        `;
        container.appendChild(row);
        document.getElementById(urlId).value = '';
    };

    function getLinksData(containerId) {
        const rows = document.querySelectorAll(`#${containerId} div`);
        let data = {};
        rows.forEach(row => {
            if(row.querySelector('.link-label')) {
                data[row.querySelector('.link-label').value] = row.querySelector('.link-url').value;
            }
        });
        return data;
    }

    if (uploadTitleSelect) {
        db.ref('content').on('value', (snapshot) => {
            globalContentData = snapshot.val() || {};
            uploadTitleSelect.innerHTML = '<option value="">-- Select Content --</option>';
            Object.keys(globalContentData).forEach(key => {
                uploadTitleSelect.innerHTML += `<option value="${key}">${globalContentData[key].title} (${globalContentData[key].type})</option>`;
            });
        });

        const urlSeriesId = new URLSearchParams(window.location.search).get('series_id');
        if(urlSeriesId) {
            setTimeout(() => {
                uploadTitleSelect.value = urlSeriesId;
                uploadTitleSelect.dispatchEvent(new Event('change'));
            }, 800);
        }

        uploadTitleSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            document.getElementById('uploadMovieFields').style.display = key && globalContentData[key].type === 'movie' ? 'block' : 'none';
            document.getElementById('uploadAnimeFields').style.display = key && globalContentData[key].type === 'anime' ? 'block' : 'none';
            document.getElementById('uploadSubmitBtn').style.display = key ? 'flex' : 'none';
            
            ['movieQualityContainer', 'movieAudioContainer', 'movieSubtitleContainer', 'animeQualityContainer', 'animeAudioContainer', 'animeSubtitleContainer'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).innerHTML = '';
            });
        });

        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const key = uploadTitleSelect.value;
            const item = globalContentData[key];
            const status = document.getElementById('uploadStatus');
            status.innerText = "Saving..."; status.style.color = "#a855f7";

            if(item.type === 'movie') {
                db.ref('content/' + key).update({
                    qualities: getLinksData('movieQualityContainer'),
                    audios: getLinksData('movieAudioContainer'),
                    subtitles: getLinksData('movieSubtitleContainer')
                }).then(() => { 
                    status.innerText = "Movie Updated!"; status.style.color = "#22c55e"; 
                    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000); 
                });
            } else {
                const seasonName = document.getElementById('uploadSeasonName').value.trim() || "Season 1";
                const epNo = document.getElementById('newEpNumber').value;
                const epTitle = document.getElementById('newEpTitle').value.trim();
                
                if(!epNo || !epTitle) { status.innerText = "Fill Episode No & Title!"; status.style.color = "#ff4d4d"; return; }

                db.ref(`content/${key}/seasons/${seasonName}`).push({ 
                    ep: parseInt(epNo), 
                    title: epTitle, 
                    qualities: getLinksData('animeQualityContainer'), 
                    audios: getLinksData('animeAudioContainer'), 
                    subtitles: getLinksData('animeSubtitleContainer')
                }).then(() => { 
                    status.innerText = "Episode Added!"; status.style.color = "#22c55e"; 
                    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000); 
                });
            }
        });
    }


    // ================= 7. EDIT PAGE LOGIC (Basic Info Only) =================
    const editForm = document.getElementById('editForm');
    
    if (editForm) {
        const editId = new URLSearchParams(window.location.search).get('id');
        if(!editId) { window.location.href = 'admin-dashboard.html'; return; }

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

        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const status = document.getElementById('editStatus');
            status.innerText = "Updating..."; status.style.color = "#a855f7";

            let updatedData = {
                title: document.getElementById('editTitle').value.trim(),
                image: document.getElementById('editImage').value.trim(),
                banner: document.getElementById('editBanner').value.trim(),
                rating: parseFloat(document.getElementById('editRating').value) || 0,
                year: document.getElementById('editYear').value.trim(),
                genres: document.getElementById('editGenres').value.split(',').map(g => g.trim()).filter(g => g),
                synopsis: document.getElementById('editSynopsis').value.trim()
            };

            db.ref('content/' + id).update(updatedData).then(() => {
                status.innerText = "Updated Successfully! Redirecting..."; status.style.color = "#22c55e";
                setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
            }).catch(err => { status.innerText = "Error: " + err.message; status.style.color = "#ff4d4d"; });
        });

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


    // ================= 8. EPISODE EDIT PAGE LOGIC =================
    const episodeEditForm = document.getElementById('episodeEditForm');
    if (episodeEditForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const seriesId = urlParams.get('series');
        const seasonName = urlParams.get('season');
        const epKey = urlParams.get('ep');

        if (!seriesId || !seasonName || !epKey) { window.location.href = 'admin-dashboard.html'; }

        const epRef = db.ref(`content/${seriesId}/seasons/${seasonName}/${epKey}`);

        epRef.once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                document.getElementById('editEpNumber').value = data.ep || '';
                document.getElementById('editEpTitle').value = data.title || '';
                
                renderExistingLinks('epQualityContainer', data.qualities);
                renderExistingLinks('epAudioContainer', data.audios);
                renderExistingLinks('epSubtitleContainer', data.subtitles);
            }
        });

        episodeEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const status = document.getElementById('epEditStatus');
            status.innerText = "Updating..."; status.style.color = "#a855f7";

            const updatedEp = {
                ep: parseInt(document.getElementById('editEpNumber').value),
                title: document.getElementById('editEpTitle').value.trim(),
                qualities: getEditLinksData('epQualityContainer'),
                audios: getEditLinksData('epAudioContainer'),
                subtitles: getEditLinksData('epSubtitleContainer')
            };

            epRef.update(updatedEp).then(() => {
                status.innerText = "Episode Updated Successfully!";
                status.style.color = "#22c55e";
                setTimeout(() => { window.history.back(); }, 1000);
            }).catch(err => {
                status.innerText = "Error: " + err.message;
                status.style.color = "#ff4d4d";
            });
        });
    }

    // ================= 9. MOVIE EDIT PAGE LOGIC =================
    const movieEditForm = document.getElementById('movieEditForm');
    if (movieEditForm) {
        const movieId = new URLSearchParams(window.location.search).get('id');
        if(!movieId) { window.location.href = 'admin-dashboard.html'; return; }

        const movieRef = db.ref('content/' + movieId);

        movieRef.once('value').then(snapshot => {
            const data = snapshot.val();
            if(data) {
                document.getElementById('editMovieId').value = movieId;
                document.getElementById('editMovieTitle').value = data.title || '';
                document.getElementById('editMovieType').value = 'Movie';
                document.getElementById('editMovieImage').value = data.image || '';
                document.getElementById('editMovieBanner').value = data.banner || '';
                document.getElementById('editMovieRating').value = data.rating || '';
                document.getElementById('editMovieYear').value = data.year || '';
                document.getElementById('editMovieGenres').value = data.genres ? data.genres.join(', ') : '';
                document.getElementById('editMovieSynopsis').value = data.synopsis || '';

                renderExistingLinks('movieQaContainer', data.qualities);
                renderExistingLinks('movieAuContainer', data.audios);
                renderExistingLinks('movieSubContainer', data.subtitles);
            }
        });

        movieEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const status = document.getElementById('movieEditStatus');
            status.innerText = "Updating..."; status.style.color = "#a855f7";

            const updatedData = {
                title: document.getElementById('editMovieTitle').value.trim(),
                image: document.getElementById('editMovieImage').value.trim(),
                banner: document.getElementById('editMovieBanner').value.trim(),
                rating: parseFloat(document.getElementById('editMovieRating').value) || 0,
                year: document.getElementById('editMovieYear').value.trim(),
                genres: document.getElementById('editMovieGenres').value.split(',').map(g => g.trim()).filter(g => g),
                synopsis: document.getElementById('editMovieSynopsis').value.trim(),
                qualities: getEditLinksData('movieQaContainer'),
                audios: getEditLinksData('movieAuContainer'),
                subtitles: getEditLinksData('movieSubContainer')
            };

            movieRef.update(updatedData).then(() => {
                status.innerText = "Movie Updated Successfully! Redirecting..."; status.style.color = "#22c55e";
                setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1000);
            }).catch(err => { status.innerText = "Error: " + err.message; status.style.color = "#ff4d4d"; });
        });

        const deleteMovieBtn = document.getElementById('deleteMovieBtn');
        if(deleteMovieBtn) {
            deleteMovieBtn.addEventListener('click', () => {
                if(confirm("Are you sure you want to delete this Movie?")) {
                    movieRef.remove().then(() => {
                        alert("Movie Deleted Successfully!");
                        window.location.href = 'admin-dashboard.html';
                    }).catch(err => alert("Error: " + err.message));
                }
            });
        }
    }
});
