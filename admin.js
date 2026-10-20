/* ============================================================
   ANIME MAX ZONE — Admin Panel Logic
   ============================================================ */

// ---------- 1. Firebase Imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---------- 2. Firebase Config ----------
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

// ---------- 3. DOM Elements ----------
const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");

// ---------- 4. Authentication Logic ----------
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in
        loginScreen.style.display = "none";
        dashboard.style.display = "flex";
        loadAnimeList(); // Load data for dropdown and manage tab
    } else {
        // User is logged out
        loginScreen.style.display = "flex";
        dashboard.style.display = "none";
    }
});

// Login Button
loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    
    if(!email || !password) {
        loginError.textContent = "Please enter both email and password.";
        return;
    }

    try {
        loginBtn.textContent = "Logging in...";
        loginBtn.disabled = true;
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = "Invalid email or password!";
        loginBtn.textContent = "Login";
        loginBtn.disabled = false;
    }
});

// Logout Button
logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

// ---------- 5. Tab Switching Logic ----------
window.showTab = (tabId) => {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    
    // Show selected tab
    document.getElementById(tabId).classList.add("active");
    event.target.classList.add("active");
    
    // If manage tab is opened, refresh list
    if (tabId === 'manageAnimeTab') {
        loadAnimeList();
    }
};

// ---------- 6. Add Anime Logic ----------
document.getElementById("animeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("animeMsg");
    msg.textContent = "Saving...";
    msg.style.color = "var(--text-muted)";

    // Genres ko array me convert karein
    const genresInput = document.getElementById("animeGenres").value;
    const genresArray = genresInput.split(",").map(g => g.trim()).filter(g => g !== "");

    const newAnime = {
        title: document.getElementById("animeTitle").value.trim(),
        description: document.getElementById("animeDesc").value.trim(),
        coverImageUrl: document.getElementById("animePoster").value.trim(),
        genres: genresArray,
        type: document.getElementById("animeType").value,
        totalSeasons: parseInt(document.getElementById("animeSeasons").value) || 1,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "anime"), newAnime);
        msg.textContent = "Anime added successfully!";
        msg.style.color = "var(--success)";
        document.getElementById("animeForm").reset();
        loadAnimeList(); // Refresh list
    } catch (error) {
        msg.textContent = "Error: " + error.message;
        msg.style.color = "var(--danger)";
    }
});

// ---------- 7. Add Episode Logic ----------
const selectAnimeForEp = document.getElementById("selectAnimeForEp");
let loadedAnime = []; // Store anime for dropdown

async function loadAnimeForDropdown() {
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        selectAnimeForEp.innerHTML = `<option value="">Select an Anime</option>`;
        
        loadedAnime = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        loadedAnime.forEach(anime => {
            selectAnimeForEp.innerHTML += `<option value="${anime.id}">${anime.title}</option>`;
        });
    } catch (err) {
        console.error("Error loading dropdown:", err);
    }
}

document.getElementById("episodeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("episodeMsg");
    msg.textContent = "Saving...";
    msg.style.color = "var(--text-muted)";

    const animeId = selectAnimeForEp.value;
    const selectedAnime = loadedAnime.find(a => a.id === animeId);

    if (!selectedAnime) {
        msg.textContent = "Please select an anime!";
        msg.style.color = "var(--danger)";
        return;
    }

    const newEpisode = {
        animeId: animeId,
        animeTitle: selectedAnime.title,
        season: parseInt(document.getElementById("epSeason").value) || 1,
        episode: parseInt(document.getElementById("epNumber").value) || 1,
        videoUrl: document.getElementById("epVideoUrl").value.trim(),
        subtitleUrl: document.getElementById("epSubUrl").value.trim(),
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "episodes"), newEpisode);
        msg.textContent = "Episode added successfully!";
        msg.style.color = "var(--success)";
        document.getElementById("episodeForm").reset();
    } catch (error) {
        msg.textContent = "Error: " + error.message;
        msg.style.color = "var(--danger)";
    }
});

// ---------- 8. Manage Anime (List & Delete) ----------
async function loadAnimeList() {
    const listContainer = document.getElementById("adminAnimeList");
    
    // Dono jagah load karein (Manage tab aur Add Episode dropdown)
    loadAnimeForDropdown(); 
    
    // Agar Manage tab active nahi hai toh list render mat karo (optional optimization)
    if (!listContainer) return;
    
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

            // HTML escaping for safety (optional for admin, but good practice)
            const safeTitle = anime.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            const card = document.createElement("div");
            card.className = "admin-card";
            card.innerHTML = `
                <img src="${anime.coverImageUrl || 'https://via.placeholder.com/70x100'}" alt="${safeTitle}">
                <div class="admin-info">
                    <h3>${safeTitle}</h3>
                    <p>${anime.type || 'series'} • ${anime.totalSeasons || 1} Seasons • ${Array.isArray(anime.genres) ? anime.genres.join(", ") : ''}</p>
                </div>
                <button class="btn-delete" onclick="window.deleteAnime('${id}')">Delete</button>
            `;
            listContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = "<p style='color:red;'>Error loading anime data.</p>";
    }
}

// Delete Function (Global scope me rakha hai taaki onclick kaam kare)
window.deleteAnime = async (id) => {
    if (confirm("Are you sure you want to delete this anime? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "anime", id));
            alert("Anime deleted successfully!");
            loadAnimeList(); // Refresh list
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    }
};
