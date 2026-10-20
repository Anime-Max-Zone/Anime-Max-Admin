/* ============================================================
   ANIME MAX ZONE — Admin Logic
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

// DOM Elements
const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");

// --- 1. AUTHENTICATION LOGIC ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = "none";
        dashboard.style.display = "flex";
        loadAnimeList(); // Dashboard open hote hi list load karo
    } else {
        loginScreen.style.display = "flex";
        dashboard.style.display = "none";
    }
});

loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    
    try {
        loginBtn.textContent = "Logging in...";
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = "Invalid email or password!";
        loginBtn.textContent = "Login";
    }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// --- 2. TAB SWITCHING ---
window.showTab = (tabId) => {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    
    document.getElementById(tabId).classList.add("active");
    event.target.classList.add("active");
    
    if (tabId === 'manageAnimeTab') loadAnimeList();
};

// --- 3. ADD ANIME FORM ---
document.getElementById("animeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("animeMsg");
    
    const genresInput = document.getElementById("animeGenres").value;
    const genresArray = genresInput.split(",").map(g => g.trim());

    const newAnime = {
        title: document.getElementById("animeTitle").value,
        description: document.getElementById("animeDesc").value,
        coverImageUrl: document.getElementById("animePoster").value,
        genres: genresArray,
        type: document.getElementById("animeType").value,
        totalSeasons: parseInt(document.getElementById("animeSeasons").value),
        createdAt: new Date().toISOString()
    };

    try {
        msg.textContent = "Saving...";
        await addDoc(collection(db, "anime"), newAnime);
        msg.textContent = "Anime added successfully!";
        document.getElementById("animeForm").reset();
        loadAnimeList();
    } catch (error) {
        msg.textContent = "Error: " + error.message;
        msg.style.color = "#ff6b6b";
    }
});

// --- 4. ADD EPISODE FORM ---
const selectAnimeForEp = document.getElementById("selectAnimeForEp");
let loadedAnime = [];

async function populateAnimeSelect() {
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        selectAnimeForEp.innerHTML = `<option value="">Select an Anime</option>`;
        loadedAnime = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        loadedAnime.forEach(anime => {
            selectAnimeForEp.innerHTML += `<option value="${anime.id}">${anime.title}</option>`;
        });
    } catch (err) { console.log(err); }
}

document.getElementById("episodeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("episodeMsg");
    const animeId = selectAnimeForEp.value;
    const selectedAnime = loadedAnime.find(a => a.id === animeId);

    if (!selectedAnime) return;

    const newEpisode = {
        animeId: animeId,
        animeTitle: selectedAnime.title,
        season: parseInt(document.getElementById("epSeason").value),
        episode: parseInt(document.getElementById("epNumber").value),
        videoUrl: document.getElementById("epVideoUrl").value,
        subtitleUrl: document.getElementById("epSubUrl").value,
        createdAt: new Date().toISOString()
    };

    try {
        msg.textContent = "Saving...";
        await addDoc(collection(db, "episodes"), newEpisode);
        msg.textContent = "Episode added successfully!";
        document.getElementById("episodeForm").reset();
    } catch (error) {
        msg.textContent = "Error: " + error.message;
        msg.style.color = "#ff6b6b";
    }
});

// --- 5. MANAGE ANIME (List & Delete) ---
async function loadAnimeList() {
    const listContainer = document.getElementById("adminAnimeList");
    listContainer.innerHTML = "<p>Loading anime list...</p>";
    
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        listContainer.innerHTML = "";
        
        if(snap.empty) {
            listContainer.innerHTML = "<p>No anime found in database.</p>";
            return;
        }

        snap.docs.forEach(docSnap => {
            const anime = docSnap.data();
            const id = docSnap.id;

            const card = document.createElement("div");
            card.className = "admin-card";
            card.innerHTML = `
                <img src="${anime.coverImageUrl || 'https://via.placeholder.com/60x85'}" alt="${anime.title}">
                <div class="admin-info">
                    <h3>${anime.title}</h3>
                    <p>${anime.type} • ${anime.totalSeasons} Seasons • ${anime.genres.join(", ")}</p>
                </div>
                <button class="btn-delete" onclick="deleteAnime('${id}')">Delete</button>
            `;
            listContainer.appendChild(card);
        });

        // Populate select box for episodes tab as well
        populateAnimeSelect();

    } catch (error) {
        listContainer.innerHTML = "<p>Error loading data.</p>";
    }
}

window.deleteAnime = async (id) => {
    if (confirm("Are you sure you want to delete this anime?")) {
        try {
            await deleteDoc(doc(db, "anime", id));
            loadAnimeList(); // Refresh list
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    }
};
