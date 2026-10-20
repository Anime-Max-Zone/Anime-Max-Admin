/* ============================================================
   ANIME MAX ZONE — Admin Panel Logic
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, getDoc, updateDoc, where 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpfrluxsBhnz48ve9RykIy1IxzbBfk7dA",
    authDomain: "sm-studio-7.firebaseapp.com",
    projectId: "sm-studio-7",
    storageBucket: "sm-studio-7.firebasestorage.app",
    messagingSenderId: "126291501472",
    appId: "1:126291501472:web:47386660af8ec3a57204c5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================
// 1. AUTHENTICATION & ROUTING
// ============================================================
const isLoginPage = window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/");

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logged In
        if (isLoginPage) window.location.href = "anime-list.html";
        
        // Page specific initialization
        if (document.getElementById("adminAnimeList")) loadAnimeList();
        if (document.getElementById("selectAnimeForEp")) loadAnimeForDropdown("selectAnimeForEp");
        
        if (document.getElementById("editSelectAnime")) {
            loadAnimeForDropdown("editSelectAnime");
            document.getElementById("editSelectAnime").addEventListener("change", loadEpisodesForEdit);
        }
    } else {
        // Logged Out
        if (!isLoginPage) window.location.href = "index.html";
    }
});

// Login / Logout
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Form reload rokne ke liye
        const email = document.getElementById("adminEmail").value;
        const pass = document.getElementById("adminPassword").value;
        
        try {
            loginBtn.textContent = "Logging in...";
            loginBtn.disabled = true;
            loginError.textContent = "";
            
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            loginError.textContent = "Invalid credentials!";
            loginBtn.textContent = "Login";
            loginBtn.disabled = false;
        }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
}

// ============================================================
// 2. DYNAMIC INPUT ROWS (For Upload & Edit Pages)
// ============================================================
window.addQualityRow = () => {
    const container = document.getElementById("qualityContainer");
    if(!container) return;
    const row = document.createElement("div");
    row.className = "dynamic-row";
    row.innerHTML = `
        <input type="url" placeholder="Video URL (MP4 or GDrive)" class="q-url" required>
        <select class="q-quality">
            <option value="1080">1080p HD</option>
            <option value="720">720p</option>
            <option value="480">480p</option>
        </select>
        <select class="q-audio">
            <option value="Japanese">Japanese Audio</option>
            <option value="English">English Dub</option>
            <option value="Hindi">Hindi Dub</option>
        </select>
        <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
    `;
    container.appendChild(row);
};

window.addSubtitleRow = () => {
    const container = document.getElementById("subtitleContainer");
    if(!container) return;
    const row = document.createElement("div");
    row.className = "dynamic-row";
    row.innerHTML = `
        <input type="url" placeholder="Subtitle URL (.vtt) - Optional" class="s-url">
        <select class="s-lang">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ur">Urdu</option>
        </select>
        <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
    `;
    container.appendChild(row);
};

window.removeRow = (btn) => {
    btn.parentElement.remove();
};

// ============================================================
// 3. ADD ANIME (anime.html)
// ============================================================
const animeForm = document.getElementById("animeForm");
if (animeForm) {
    animeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("animeMsg");
        msg.textContent = "Saving...";
        msg.style.color = "var(--success)";
        
        const newAnime = {
            title: document.getElementById("animeTitle").value.trim(),
            type: document.getElementById("animeType").value,
            coverImageUrl: document.getElementById("animePoster").value.trim(),
            genres: document.getElementById("animeGenres").value.split(",").map(g => g.trim()),
            totalSeasons: parseInt(document.getElementById("animeSeasons").value) || 1,
            description: document.getElementById("animeDesc").value.trim(),
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "anime"), newAnime);
            msg.textContent = "Anime saved successfully!";
            setTimeout(() => window.location.href = "anime-list.html", 1000);
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "var(--danger)";
        }
    });
}

// ============================================================
// 4. MANAGE LIST (anime-list.html)
// ============================================================
async function loadAnimeList() {
    const container = document.getElementById("adminAnimeList");
    if(!container) return;
    
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        container.innerHTML = "";
        
        if(snap.empty) {
            container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>No anime found in database.</p>";
            return;
        }

        snap.forEach(d => {
            const a = d.data();
            container.innerHTML += `
                <div class="admin-card">
                    <img src="${a.coverImageUrl || 'https://via.placeholder.com/70x100'}" alt="${a.title}">
                    <div class="admin-info">
                        <h3>${a.title}</h3>
                        <p>${a.type} • ${a.totalSeasons} Seasons • ${Array.isArray(a.genres) ? a.genres.join(", ") : ''}</p>
                    </div>
                    <div class="admin-actions">
                        <a href="upload.html?id=${d.id}" class="btn-action btn-add">+ Add Ep</a>
                        <button class="btn-action btn-delete" onclick="deleteAnime('${d.id}')">Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (e) { 
        console.error(e); 
        container.innerHTML = "<p style='color:var(--danger);'>Error loading data.</p>";
    }
}

window.deleteAnime = async (id) => {
    if(confirm("Are you sure you want to delete this anime?")) {
        try {
            await deleteDoc(doc(db, "anime", id));
            loadAnimeList();
        } catch(e) { console.error(e); }
    }
};

// ============================================================
// 5. UPLOAD EPISODE (upload.html)
// ============================================================
async function loadAnimeForDropdown(selectId) {
    const select = document.getElementById(selectId);
    if(!select) return;
    
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        select.innerHTML = `<option value="">Select an Anime</option>`;
        
        // Check if URL has ?id= (for auto-selecting anime from list page)
        const urlParams = new URLSearchParams(window.location.search);
        const preSelectedId = urlParams.get('id');

        snap.forEach(d => {
            const isSelected = (d.id === preSelectedId) ? "selected" : "";
            select.innerHTML += `<option value="${d.id}" data-title="${d.data().title}" ${isSelected}>${d.data().title}</option>`;
        });
    } catch (e) { console.error(e); }
}

const episodeForm = document.getElementById("episodeForm");
if(episodeForm) {
    episodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("episodeMsg");
        const select = document.getElementById("selectAnimeForEp");
        
        if(!select.value) {
            msg.textContent = "Please select an anime!";
            msg.style.color = "var(--danger)";
            return;
        }

        const selectedTitle = select.options[select.selectedIndex].getAttribute("data-title");
        
        msg.textContent = "Uploading...";
        msg.style.color = "var(--success)";

        // Gather Multiple Video Sources
        let videoSources = [];
        document.querySelectorAll("#qualityContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".q-url").value.trim();
            if (url) {
                videoSources.push({
                    src: url,
                    type: "video/mp4",
                    size: parseInt(row.querySelector(".q-quality").value),
                    label: row.querySelector(".q-quality").value + "p",
                    audio: row.querySelector(".q-audio").value
                });
            }
        });

        // Gather Multiple Subtitles
        let subtitles = [];
        document.querySelectorAll("#subtitleContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".s-url").value.trim();
            if (url) {
                subtitles.push({
                    src: url,
                    label: row.querySelector(".s-lang").options[row.querySelector(".s-lang").selectedIndex].text,
                    srclang: row.querySelector(".s-lang").value
                });
            }
        });

        const newEp = {
            animeId: select.value,
            animeTitle: selectedTitle,
            season: parseInt(document.getElementById("epSeason").value) || 1,
            episode: parseInt(document.getElementById("epNumber").value) || 1,
            videoSources: videoSources,
            subtitles: subtitles,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "episodes"), newEp);
            msg.textContent = "Episode Uploaded Successfully!";
            episodeForm.reset();
            
            // Reset dynamic rows back to 1
            document.getElementById("qualityContainer").innerHTML = "";
            document.getElementById("subtitleContainer").innerHTML = "";
            addQualityRow();
            addSubtitleRow();
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "var(--danger)";
        }
    });
}

// ============================================================
// 6. EDIT EPISODE (edit.html)
// ============================================================
async function loadEpisodesForEdit() {
    const animeId = document.getElementById("editSelectAnime").value;
    const epSelect = document.getElementById("editSelectEpisode");
    const form = document.getElementById("editEpisodeForm");
    
    form.style.display = "none";
    epSelect.innerHTML = `<option value="">Loading...</option>`;
    
    if (!animeId) {
        epSelect.innerHTML = `<option value="">Choose Anime First</option>`;
        epSelect.disabled = true;
        return;
    }

    try {
        const q = query(collection(db, "episodes"), where("animeId", "==", animeId));
        const snap = await getDocs(q);
        epSelect.innerHTML = `<option value="">Select Episode</option>`;
        
        if(snap.empty) {
            epSelect.innerHTML = `<option value="">No episodes found</option>`;
            return;
        }

        // Sort episodes by season then episode
        const episodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

        episodes.forEach(ep => {
            epSelect.innerHTML += `<option value="${ep.id}">S${ep.season} Ep${ep.episode}</option>`;
        });
        
        epSelect.disabled = false;
        epSelect.onchange = () => loadEditFormData(epSelect.value, episodes);
        
    } catch (err) { console.error(err); }
}

function loadEditFormData(epId, episodes) {
    const form = document.getElementById("editEpisodeForm");
    if(!epId) { form.style.display = "none"; return; }
    
    const data = episodes.find(e => e.id === epId);
    if(!data) return;
    
    form.style.display = "block";
    document.getElementById("editEpId").value = epId;
    document.getElementById("editEpSeason").value = data.season;
    document.getElementById("editEpNumber").value = data.episode;

    // Populate Qualities
    const qContainer = document.getElementById("qualityContainer");
    qContainer.innerHTML = "";
    if (data.videoSources && data.videoSources.length > 0) {
        data.videoSources.forEach(src => {
            const row = document.createElement("div");
            row.className = "dynamic-row";
            row.innerHTML = `
                <input type="url" class="q-url" value="${src.src}" required>
                <select class="q-quality">
                    <option value="1080" ${src.size === 1080 ? 'selected' : ''}>1080p</option>
                    <option value="720" ${src.size === 720 ? 'selected' : ''}>720p</option>
                    <option value="480" ${src.size === 480 ? 'selected' : ''}>480p</option>
                </select>
                <select class="q-audio">
                    <option value="Japanese" ${src.audio === 'Japanese' ? 'selected' : ''}>Japanese</option>
                    <option value="English" ${src.audio === 'English' ? 'selected' : ''}>English Dub</option>
                    <option value="Hindi" ${src.audio === 'Hindi' ? 'selected' : ''}>Hindi Dub</option>
                </select>
                <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
            `;
            qContainer.appendChild(row);
        });
    } else {
        addQualityRow(); // Fallback if old episode format
    }

    // Populate Subtitles
    const sContainer = document.getElementById("subtitleContainer");
    sContainer.innerHTML = "";
    if (data.subtitles && data.subtitles.length > 0) {
        data.subtitles.forEach(sub => {
            const row = document.createElement("div");
            row.className = "dynamic-row";
            row.innerHTML = `
                <input type="url" class="s-url" value="${sub.src}">
                <select class="s-lang">
                    <option value="en" ${sub.srclang === 'en' ? 'selected' : ''}>English</option>
                    <option value="hi" ${sub.srclang === 'hi' ? 'selected' : ''}>Hindi</option>
                    <option value="ur" ${sub.srclang === 'ur' ? 'selected' : ''}>Urdu</option>
                </select>
                <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
            `;
            sContainer.appendChild(row);
        });
    } else {
        addSubtitleRow(); // Fallback
    }
}

const editEpisodeForm = document.getElementById("editEpisodeForm");
if (editEpisodeForm) {
    editEpisodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("editEpId").value;
        const msg = document.getElementById("editEpMsg");
        msg.textContent = "Updating...";
        msg.style.color = "var(--success)";

        // Gather Qualities
        let videoSources = [];
        document.querySelectorAll("#qualityContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".q-url").value.trim();
            if (url) {
                videoSources.push({
                    src: url,
                    type: "video/mp4",
                    size: parseInt(row.querySelector(".q-quality").value),
                    label: row.querySelector(".q-quality").value + "p",
                    audio: row.querySelector(".q-audio").value
                });
            }
        });

        // Gather Subtitles
        let subtitles = [];
        document.querySelectorAll("#subtitleContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".s-url").value.trim();
            if (url) {
                subtitles.push({
                    src: url,
                    label: row.querySelector(".s-lang").options[row.querySelector(".s-lang").selectedIndex].text,
                    srclang: row.querySelector(".s-lang").value
                });
            }
        });

        try {
            await updateDoc(doc(db, "episodes", id), {
                season: parseInt(document.getElementById("editEpSeason").value) || 1,
                episode: parseInt(document.getElementById("editEpNumber").value) || 1,
                videoSources: videoSources,
                subtitles: subtitles
            });
            msg.textContent = "Episode Updated Successfully!";
            setTimeout(() => msg.textContent = "", 3000);
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "var(--danger)";
        }
    });
}
