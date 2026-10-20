import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, getDoc, updateDoc 
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

// --- 1. AUTH CHECK (Redirect Logic) ---
const isLoginPage = window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/");

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logged In
        if (isLoginPage) window.location.href = "anime-list.html";
        
        // If on list page, load data
        if (document.getElementById("adminAnimeList")) loadAnimeList();
        
        // If on upload page, load dropdown
        if (document.getElementById("selectAnimeForEp")) loadAnimeForDropdown();
        
        // If on edit page, load existing data
        if (document.getElementById("editAnimeForm")) loadEditData();

    } else {
        // Logged Out
        if (!isLoginPage) window.location.href = "index.html";
    }
});

// --- 2. LOGIN / LOGOUT ---
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("adminEmail").value;
        const pass = document.getElementById("adminPassword").value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            document.getElementById("loginError").textContent = "Invalid credentials!";
        }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
}

// --- 3. ADD ANIME (anime.html) ---
const animeForm = document.getElementById("animeForm");
if (animeForm) {
    animeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("animeMsg");
        msg.textContent = "Saving...";
        
        const newAnime = {
            title: document.getElementById("animeTitle").value,
            type: document.getElementById("animeType").value,
            coverImageUrl: document.getElementById("animePoster").value,
            genres: document.getElementById("animeGenres").value.split(",").map(g => g.trim()),
            totalSeasons: parseInt(document.getElementById("animeSeasons").value) || 1,
            description: document.getElementById("animeDesc").value,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "anime"), newAnime);
            msg.textContent = "Anime saved successfully!";
            setTimeout(() => window.location.href = "anime-list.html", 1000);
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "red";
        }
    });
}

// --- 4. MANAGE LIST (anime-list.html) ---
async function loadAnimeList() {
    const container = document.getElementById("adminAnimeList");
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        container.innerHTML = "";
        snap.forEach(d => {
            const a = d.data();
            container.innerHTML += `
                <div class="admin-card">
                    <img src="${a.coverImageUrl}" alt="${a.title}">
                    <div class="admin-info">
                        <h3>${a.title}</h3>
                        <p>${a.type} • ${a.totalSeasons} Seasons</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <a href="edit.html?id=${d.id}" class="btn-primary" style="padding: 0.5rem 1rem; width:auto; text-decoration:none;">Edit</a>
                        <button class="btn-delete" onclick="deleteAnime('${d.id}')">Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

window.deleteAnime = async (id) => {
    if(confirm("Are you sure?")) {
        await deleteDoc(doc(db, "anime", id));
        loadAnimeList();
    }
};

// --- 5. UPLOAD EPISODE (upload.html) ---
async function loadAnimeForDropdown() {
    const select = document.getElementById("selectAnimeForEp");
    try {
        const snap = await getDocs(query(collection(db, "anime"), orderBy("createdAt", "desc")));
        select.innerHTML = `<option value="">Select an Anime</option>`;
        snap.forEach(d => {
            select.innerHTML += `<option value="${d.id}" data-title="${d.data().title}">${d.data().title}</option>`;
        });
    } catch (e) { console.error(e); }
}

const episodeForm = document.getElementById("episodeForm");
if(episodeForm) {
    episodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("episodeMsg");
        const select = document.getElementById("selectAnimeForEp");
        const selectedTitle = select.options[select.selectedIndex].getAttribute("data-title");
        
        msg.textContent = "Uploading...";

        const newEp = {
            animeId: select.value,
            animeTitle: selectedTitle,
            season: parseInt(document.getElementById("epSeason").value),
            episode: parseInt(document.getElementById("epNumber").value),
            videoUrl: document.getElementById("epVideoUrl").value,
            subtitleUrl: document.getElementById("epSubUrl").value,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "episodes"), newEp);
            msg.textContent = "Episode Uploaded Successfully!";
            episodeForm.reset();
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "red";
        }
    });
}

// --- 6. EDIT ANIME (edit.html) ---
async function loadEditData() {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id');
    if (!animeId) { window.location.href = "anime-list.html"; return; }

    try {
        const docRef = doc(db, "anime", animeId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById("editAnimeId").value = animeId;
            document.getElementById("editTitle").value = data.title;
            document.getElementById("editType").value = data.type;
            document.getElementById("editPoster").value = data.coverImageUrl;
            document.getElementById("editGenres").value = data.genres.join(", ");
            document.getElementById("editSeasons").value = data.totalSeasons;
            document.getElementById("editDesc").value = data.description;
        }
    } catch (e) { console.error(e); }
}

const editForm = document.getElementById("editAnimeForm");
if (editForm) {
    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("editAnimeId").value;
        const msg = document.getElementById("editMsg");
        msg.textContent = "Updating...";

        try {
            await updateDoc(doc(db, "anime", id), {
                title: document.getElementById("editTitle").value,
                type: document.getElementById("editType").value,
                coverImageUrl: document.getElementById("editPoster").value,
                genres: document.getElementById("editGenres").value.split(",").map(g => g.trim()),
                totalSeasons: parseInt(document.getElementById("editSeasons").value),
                description: document.getElementById("editDesc").value
            });
            msg.textContent = "Updated successfully!";
            setTimeout(() => window.location.href = "anime-list.html", 1000);
        } catch (err) {
            msg.textContent = "Error: " + err.message;
            msg.style.color = "red";
        }
    });
}
