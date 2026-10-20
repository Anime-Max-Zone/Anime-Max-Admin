/* ============================================================
   ANIME MAX ZONE — Admin Panel Logic
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where 
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

// Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("adminEmail").value;
        const pass = document.getElementById("adminPassword").value;
        const btn = document.getElementById("loginBtn");
        
        try {
            btn.textContent = "Logging in...";
            btn.disabled = true;
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            document.getElementById("loginError").textContent = "Invalid credentials!";
            btn.textContent = "Login";
            btn.disabled = false;
        }
    });
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));

// ============================================================
// 2. DYNAMIC ROW BUILDERS (Quality, Audio, Subtitle)
// ============================================================
window.addQualityRow = (url = "", quality = "1080") => {
    const container = document.getElementById("qualityContainer");
    if(!container) return;
    const row = document.createElement("div");
    row.className = "dynamic-row";
    row.innerHTML = `
        <input type="url" placeholder="Video URL (MP4 or GDrive)" class="v-url" value="${url}">
        <select class="v-quality">
            <option value="1080" ${quality === "1080" ? "selected" : ""}>1080p HD</option>
            <option value="720" ${quality === "720" ? "selected" : ""}>720p</option>
            <option value="480" ${quality === "480" ? "selected" : ""}>480p</option>
        </select>
        <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
    `;
    container.appendChild(row);
};

window.addAudioRow = (url = "", lang = "Japanese") => {
    const container = document.getElementById("audioContainer");
    if(!container) return;
    const row = document.createElement("div");
    row.className = "dynamic-row";
    row.innerHTML = `
        <input type="url" placeholder="Audio/Video URL (MP4)" class="a-url" value="${url}">
        <select class="a-lang">
            <option value="Japanese" ${lang === "Japanese" ? "selected" : ""}>Japanese Audio</option>
            <option value="English" ${lang === "English" ? "selected" : ""}>English Dub</option>
            <option value="Hindi" ${lang === "Hindi" ? "selected" : ""}>Hindi Dub</option>
        </select>
        <button type="button" class="btn-remove-row" onclick="removeRow(this)">×</button>
    `;
    container.appendChild(row);
};

window.addSubtitleRow = (url = "", lang = "en") => {
    const container = document.getElementById("subtitleContainer");
    if(!container) return;
    const row = document.createElement("div");
    row.className = "dynamic-row";
    row.innerHTML = `
        <input type="url" placeholder="Subtitle URL (.vtt) - Optional" class="s-url" value="${url}">
        <select class="s-lang">
            <option value="en" ${lang === "en" ? "selected" : ""}>English</option>
            <option value="hi" ${lang === "hi" ? "selected" : ""}>Hindi</option>
            <option value="ur" ${lang === "ur" ? "selected" : ""}>Urdu</option>
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
        container.innerHTML = "<p style='color:var(--danger); text-align:center;'>Error loading data.</p>"; 
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
        
        // Auto-select if coming from "Add Ep" button in list
        const preSelectedId = new URLSearchParams(window.location.search).get('id');

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

        // Gather Qualities
        let videoQualities = [];
        document.querySelectorAll("#qualityContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".v-url").value.trim();
            if (url) videoQualities.push({ src: url, quality: row.querySelector(".v-quality").value });
        });

        // Gather Audio
        let audioTracks = [];
        document.querySelectorAll("#audioContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".a-url").value.trim();
            if (url) audioTracks.push({ src: url, language: row.querySelector(".a-lang").value });
        });

        // Gather Subtitles
        let subtitles = [];
        document.querySelectorAll("#subtitleContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".s-url").value.trim();
            if (url) subtitles.push({ src: url, language: row.querySelector(".s-lang").value });
        });

        const newEp = {
            animeId: select.value,
            animeTitle: selectedTitle,
            season: parseInt(document.getElementById("epSeason").value) || 1,
            episode: parseInt(document.getElementById("epNumber").value) || 1,
            videoQualities: videoQualities,
            audioTracks: audioTracks,
            subtitles: subtitles,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "episodes"), newEp);
            msg.textContent = "Episode Uploaded Successfully!";
            episodeForm.reset();
            
            // Reset dynamic rows to 1 default row each
            document.getElementById("qualityContainer").innerHTML = "";
            document.getElementById("audioContainer").innerHTML = "";
            document.getElementById("subtitleContainer").innerHTML = "";
            addQualityRow(); 
            addAudioRow(); 
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
    document.getElementById("qualityContainer").innerHTML = "";
    if (data.videoQualities && data.videoQualities.length > 0) {
        data.videoQualities.forEach(q => addQualityRow(q.src, q.quality));
    } else { addQualityRow(); }

    // Populate Audio
    document.getElementById("audioContainer").innerHTML = "";
    if (data.audioTracks && data.audioTracks.length > 0) {
        data.audioTracks.forEach(a => addAudioRow(a.src, a.language));
    } else { addAudioRow(); }

    // Populate Subtitles
    document.getElementById("subtitleContainer").innerHTML = "";
    if (data.subtitles && data.subtitles.length > 0) {
        data.subtitles.forEach(s => addSubtitleRow(s.src, s.language));
    } else { addSubtitleRow(); }
}

const editEpisodeForm = document.getElementById("editEpisodeForm");
if (editEpisodeForm) {
    editEpisodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("editEpId").value;
        const msg = document.getElementById("editEpMsg");
        msg.textContent = "Updating...";
        msg.style.color = "var(--success)";

        let videoQualities = [];
        document.querySelectorAll("#qualityContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".v-url").value.trim();
            if (url) videoQualities.push({ src: url, quality: row.querySelector(".v-quality").value });
        });

        let audioTracks = [];
        document.querySelectorAll("#audioContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".a-url").value.trim();
            if (url) audioTracks.push({ src: url, language: row.querySelector(".a-lang").value });
        });

        let subtitles = [];
        document.querySelectorAll("#subtitleContainer .dynamic-row").forEach(row => {
            const url = row.querySelector(".s-url").value.trim();
            if (url) subtitles.push({ src: url, language: row.querySelector(".s-lang").value });
        });

        try {
            await updateDoc(doc(db, "episodes", id), {
                season: parseInt(document.getElementById("editEpSeason").value) || 1,
                episode: parseInt(document.getElementById("editEpNumber").value) || 1,
                videoQualities: videoQualities,
                audioTracks: audioTracks,
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
