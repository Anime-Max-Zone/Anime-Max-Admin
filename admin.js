/* ============================================================
   ANIME MAX ZONE — ADMIN PANEL
   File: admin.js
   Firebase Authentication + Firestore
   Admin UID verification
   ============================================================ */

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCpfrluxsBhnz48ve9RykIy1IxzbBfk7dA",
  authDomain: "sm-studio-7.firebaseapp.com",
  databaseURL:
    "https://sm-studio-7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sm-studio-7",
  storageBucket: "sm-studio-7.firebasestorage.app",
  messagingSenderId: "126291501472",
  appId: "1:126291501472:web:47386660af8ec3a57204c5",
  measurementId: "G-4X9Q0761SB"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// ============================================================
// HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const isLoginPage =
  /\/index\.html$|\/$/.test(window.location.pathname);

let authorizedAdminUid = null;
let authCheckInProgress = false;

function setMessage(element, message, type = "success") {
  if (!element) return;

  element.textContent = message;

  const colors = {
    success: "var(--success, #22c55e)",
    error: "var(--danger, #ef4444)",
    info: "var(--text-muted, #9ca3af)"
  };

  element.style.color = colors[type] || colors.info;
}

function getValue(id) {
  return $(id)?.value?.trim() || "";
}

function safeText(value, fallback = "") {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || fallback;
  }

  return fallback;
}

function getNumber(id, fallback = 1) {
  const value = Number.parseInt(getValue(id), 10);

  return Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function requireAuthorizedAdmin() {
  if (!auth.currentUser || !authorizedAdminUid) {
    throw new Error("Admin authorization required. Please log in again.");
  }

  if (auth.currentUser.uid !== authorizedAdminUid) {
    throw new Error("Unauthorized account.");
  }
}

// ============================================================
// ADMIN UID VERIFICATION
//
// Realtime Database must contain:
// admins
//   YOUR_FIREBASE_AUTH_UID: true
//
// This only checks authorization. Firestore rules must also
// independently enforce admin-only access.
// ============================================================

async function verifyAdmin(user) {
  if (!user) return false;

  try {
    const adminRef = ref(rtdb, `admins/${user.uid}`);
    const snapshot = await get(adminRef);

    return snapshot.exists() && snapshot.val() === true;
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

// ============================================================
// AUTH STATE / PAGE ACCESS
// ============================================================

onAuthStateChanged(auth, async (user) => {
  if (authCheckInProgress) return;

  authCheckInProgress = true;
  authorizedAdminUid = null;

  try {
    if (!user) {
      if (!isLoginPage) {
        window.location.replace("index.html");
      }
      return;
    }

    const isAdmin = await verifyAdmin(user);

    if (!isAdmin) {
      await signOut(auth);

      if (!isLoginPage) {
        window.location.replace("index.html?error=unauthorized");
      } else {
        setMessage(
          $("loginError"),
          "This account is not authorized as an admin.",
          "error"
        );
      }

      return;
    }

    authorizedAdminUid = user.uid;

    if (isLoginPage) {
      window.location.replace("anime-list.html");
      return;
    }

    if ($("adminAnimeList")) {
      await loadAnimeList();
    }

    if ($("selectAnimeForEp")) {
      await loadAnimeForDropdown("selectAnimeForEp");
    }

    if ($("editSelectAnime")) {
      await loadAnimeForDropdown("editSelectAnime");

      $("editSelectAnime").addEventListener(
        "change",
        loadEpisodesForEdit
      );
    }
  } catch (error) {
    console.error("Admin initialization failed:", error);
    setMessage(
      $("loginError") || $("animeMsg") || $("episodeMsg"),
      "Unable to verify admin access. Check Firebase configuration and rules.",
      "error"
    );
  } finally {
    authCheckInProgress = false;
  }
});

// ============================================================
// LOGIN
// ============================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = getValue("adminEmail");
  const password = $("adminPassword")?.value || "";
  const button = $("loginBtn");
  const errorElement = $("loginError");

  if (!email || !password) {
    setMessage(errorElement, "Enter your email and password.", "error");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Checking Admin...";
  }

  setMessage(errorElement, "");

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const isAdmin = await verifyAdmin(credential.user);

    if (!isAdmin) {
      await signOut(auth);

      setMessage(
        errorElement,
        "Access denied. This account is not an authorized admin.",
        "error"
      );

      return;
    }

    authorizedAdminUid = credential.user.uid;
    window.location.replace("anime-list.html");
  } catch (error) {
    console.error("Login failed:", error);

    setMessage(
      errorElement,
      "Login failed. Check your credentials and Firebase settings.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
});

// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn")?.addEventListener("click", async () => {
  authorizedAdminUid = null;

  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Unable to log out. Please try again.");
  }
});

// ============================================================
// GOOGLE DRIVE URL FORMATTER
// ============================================================

function formatVideoUrl(value) {
  const url = safeText(value);
  if (!url) return "";

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname.toLowerCase();

  if (host !== "drive.google.com") {
    return url;
  }

  let fileId = "";

  const match = parsed.pathname.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (match) fileId = match[1];

  if (!fileId) {
    fileId = parsed.searchParams.get("id") || "";
  }

  if (!fileId) return url;

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

// ============================================================
// DYNAMIC MEDIA ROWS
// ============================================================

function createDynamicRow({
  containerId,
  inputClass,
  inputPlaceholder,
  inputValue = "",
  selectClass,
  options,
  selectedValue
}) {
  const container = $(containerId);
  if (!container) return;

  const row = document.createElement("div");
  row.className = "dynamic-row";

  const input = document.createElement("input");
  input.type = "url";
  input.className = inputClass;
  input.placeholder = inputPlaceholder;
  input.value = inputValue;
  input.autocomplete = "url";

  const select = document.createElement("select");
  select.className = selectClass;

  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.selected = option.value === String(selectedValue);
    select.appendChild(item);
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn-remove-row";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "Remove row");
  remove.addEventListener("click", () => row.remove());

  row.append(input, select, remove);
  container.appendChild(row);
}

const QUALITY_OPTIONS = [
  { value: "1080", label: "1080p HD" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" }
];

const AUDIO_OPTIONS = [
  { value: "Japanese", label: "Japanese Audio" },
  { value: "English", label: "English Dub" },
  { value: "Hindi", label: "Hindi Dub" }
];

const SUBTITLE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ur", label: "Urdu" }
];

window.addQualityRow = (url = "", quality = "1080") => {
  createDynamicRow({
    containerId: "qualityContainer",
    inputClass: "v-url",
    inputPlaceholder: "Video URL (MP4 or Google Drive)",
    inputValue: url,
    selectClass: "v-quality",
    options: QUALITY_OPTIONS,
    selectedValue: String(quality)
  });
};

window.addAudioRow = (url = "", lang = "Japanese") => {
  createDynamicRow({
    containerId: "audioContainer",
    inputClass: "a-url",
    inputPlaceholder: "Audio/Video URL",
    inputValue: url,
    selectClass: "a-lang",
    options: AUDIO_OPTIONS,
    selectedValue: lang
  });
};

window.addSubtitleRow = (url = "", lang = "en") => {
  createDynamicRow({
    containerId: "subtitleContainer",
    inputClass: "s-url",
    inputPlaceholder: "Subtitle URL (.vtt)",
    inputValue: url,
    selectClass: "s-lang",
    options: SUBTITLE_OPTIONS,
    selectedValue: lang
  });
};

window.removeRow = (button) => {
  button?.closest(".dynamic-row")?.remove();
};

// ============================================================
// COLLECT MEDIA ROWS
// ============================================================

function collectRows(containerId, inputSelector, selectSelector, type) {
  const result = [];

  document.querySelectorAll(`#${containerId} .dynamic-row`).forEach((row) => {
    const rawUrl = row.querySelector(inputSelector)?.value?.trim() || "";
    const selected = row.querySelector(selectSelector)?.value || "";

    if (!rawUrl) return;

    if (!isValidHttpUrl(rawUrl)) {
      throw new Error(`Invalid ${type} URL.`);
    }

    const src = type === "subtitle"
      ? rawUrl
      : formatVideoUrl(rawUrl);

    if (type === "quality") {
      result.push({ src, quality: selected });
    } else {
      result.push({ src, language: selected });
    }
  });

  return result;
}

function collectMediaData() {
  return {
    videoQualities: collectRows(
      "qualityContainer", ".v-url", ".v-quality", "quality"
    ),
    audioTracks: collectRows(
      "audioContainer", ".a-url", ".a-lang", "audio"
    ),
    subtitles: collectRows(
      "subtitleContainer", ".s-url", ".s-lang", "subtitle"
    )
  };
}

function resetMediaRows() {
  $("qualityContainer")?.replaceChildren();
  $("audioContainer")?.replaceChildren();
  $("subtitleContainer")?.replaceChildren();

  window.addQualityRow();
  window.addAudioRow();
  window.addSubtitleRow();
}

// ============================================================
// ADD ANIME — anime.html
// ============================================================

$("animeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("animeMsg");
  setMessage(message, "Saving anime...", "info");

  try {
    requireAuthorizedAdmin();

    const title = getValue("animeTitle");
    const poster = getValue("animePoster");

    if (!title) throw new Error("Anime title is required.");

    if (poster && !isValidHttpUrl(poster)) {
      throw new Error("Enter a valid poster image URL.");
    }

    const genres = getValue("animeGenres")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    await addDoc(collection(db, "anime"), {
      title,
      type: getValue("animeType"),
      coverImageUrl: poster,
      genres,
      totalSeasons: getNumber("animeSeasons", 1),
      description: getValue("animeDesc"),
      createdAt: serverTimestamp()
    });

    setMessage(message, "Anime saved successfully!", "success");

    setTimeout(() => {
      window.location.href = "anime-list.html";
    }, 800);
  } catch (error) {
    console.error("Anime save failed:", error);
    setMessage(message, `Error: ${error.message}`, "error");
  }
});

// ============================================================
// LOAD ANIME LIST — anime-list.html
// ============================================================

async function loadAnimeList() {
  requireAuthorizedAdmin();

  const container = $("adminAnimeList");
  if (!container) return;

  container.textContent = "Loading anime...";

  try {
    const snapshot = await getDocs(
      query(collection(db, "anime"), orderBy("createdAt", "desc"))
    );

    container.replaceChildren();

    if (snapshot.empty) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No anime found in the database.";
      container.appendChild(p);
      return;
    }

    snapshot.forEach((item) => {
      const anime = item.data();
      const id = item.id;

      const card = document.createElement("div");
      card.className = "admin-card";

      const image = document.createElement("img");
      image.src = isValidHttpUrl(safeText(anime.coverImageUrl))
        ? anime.coverImageUrl
        : "https://placehold.co/70x100?text=Anime";
      image.alt = safeText(anime.title, "Anime poster");
      image.loading = "lazy";

      const info = document.createElement("div");
      info.className = "admin-info";

      const heading = document.createElement("h3");
      heading.textContent = safeText(anime.title, "Untitled Anime");

      const details = document.createElement("p");
      details.textContent = [
        safeText(anime.type, "Anime"),
        `${Number(anime.totalSeasons) || 1} Seasons`,
        Array.isArray(anime.genres) ? anime.genres.join(", ") : ""
      ].filter(Boolean).join(" • ");

      info.append(heading, details);

      const actions = document.createElement("div");
      actions.className = "admin-actions";

      const addEpisode = document.createElement("a");
      addEpisode.href = `upload.html?id=${encodeURIComponent(id)}`;
      addEpisode.className = "btn-action btn-add";
      addEpisode.textContent = "+ Add Ep";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn-action btn-delete";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        window.deleteAnime(id);
      });

      actions.append(addEpisode, deleteButton);
      card.append(image, info, actions);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Anime list load failed:", error);
    container.textContent =
      "Error loading anime. Check Firestore rules and admin access.";
  }
}

// ============================================================
// DELETE ANIME
// ============================================================

window.deleteAnime = async (id) => {
  if (!id) return;

  requireAuthorizedAdmin();

  if (!confirm("Delete this anime? Its episodes will not be deleted automatically.")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "anime", id));
    await loadAnimeList();
  } catch (error) {
    console.error("Anime deletion failed:", error);
    alert("Unable to delete anime. Check Firestore rules.");
  }
};

// ============================================================
// ANIME DROPDOWN
// ============================================================

async function loadAnimeForDropdown(selectId) {
  requireAuthorizedAdmin();

  const select = $(selectId);
  if (!select) return;

  select.disabled = true;
  select.replaceChildren();

  const loading = document.createElement("option");
  loading.value = "";
  loading.textContent = "Loading anime...";
  select.appendChild(loading);

  try {
    const snapshot = await getDocs(
      query(collection(db, "anime"), orderBy("createdAt", "desc"))
    );

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an Anime";
    select.appendChild(placeholder);

    const preSelectedId = new URLSearchParams(location.search).get("id");

    snapshot.forEach((item) => {
      const anime = item.data();
      const option = document.createElement("option");

      option.value = item.id;
      option.textContent = safeText(anime.title, "Untitled Anime");
      option.dataset.title = safeText(anime.title);
      option.selected = item.id === preSelectedId;

      select.appendChild(option);
    });

    select.disabled = false;

    if (selectId === "editSelectAnime" && preSelectedId) {
      await loadEpisodesForEdit();
    }
  } catch (error) {
    console.error("Anime dropdown failed:", error);
    select.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unable to load anime";
    select.appendChild(option);
  }
}

// ============================================================
// UPLOAD EPISODE — upload.html
// ============================================================

$("episodeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("episodeMsg");
  const select = $("selectAnimeForEp");

  try {
    requireAuthorizedAdmin();

    if (!select?.value) {
      throw new Error("Please select an anime.");
    }

    setMessage(message, "Saving episode...", "info");

    const selectedOption = select.options[select.selectedIndex];
    const selectedTitle =
      selectedOption?.dataset.title || selectedOption?.textContent || "";

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error("Add at least one video URL.");
    }

    await addDoc(collection(db, "episodes"), {
      animeId: select.value,
      animeTitle: selectedTitle.trim(),
      season: getNumber("epSeason", 1),
      episode: getNumber("epNumber", 1),
      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitles: media.subtitles,
      createdAt: serverTimestamp()
    });

    setMessage(message, "Episode uploaded successfully!", "success");

    $("episodeForm").reset();
    select.value = select.value;
    resetMediaRows();
  } catch (error) {
    console.error("Episode upload failed:", error);
    setMessage(message, `Error: ${error.message}`, "error");
  }
});

// ============================================================
// EDIT EPISODE — edit.html
// ============================================================

async function loadEpisodesForEdit() {
  requireAuthorizedAdmin();

  const animeSelect = $("editSelectAnime");
  const episodeSelect = $("editSelectEpisode");
  const form = $("editEpisodeForm");

  if (!animeSelect || !episodeSelect || !form) return;

  const animeId = animeSelect.value;

  form.style.display = "none";
  episodeSelect.disabled = true;
  episodeSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = animeId ? "Loading episodes..." : "Choose Anime First";
  episodeSelect.appendChild(placeholder);

  if (!animeId) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, "episodes"), where("animeId", "==", animeId))
    );

    const episodes = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    episodes.sort((a, b) =>
      (Number(a.season) || 1) - (Number(b.season) || 1) ||
      (Number(a.episode) || 1) - (Number(b.episode) || 1)
    );

    episodeSelect.replaceChildren();

    const first = document.createElement("option");
    first.value = "";
    first.textContent = episodes.length ? "Select Episode" : "No episodes found";
    episodeSelect.appendChild(first);

    episodes.forEach((episode) => {
      const option = document.createElement("option");
      option.value = episode.id;
      option.textContent = `S${episode.season || 1} Ep${episode.episode || 1}`;
      episodeSelect.appendChild(option);
    });

    episodeSelect.disabled = episodes.length === 0;

    episodeSelect.onchange = () => {
      loadEditFormData(episodeSelect.value, episodes);
    };
  } catch (error) {
    console.error("Episode loading failed:", error);
    episodeSelect.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unable to load episodes";
    episodeSelect.appendChild(option);
  }
}

// ============================================================
// POPULATE EDIT FORM
// ============================================================

function loadEditFormData(episodeId, episodes) {
  const form = $("editEpisodeForm");
  if (!form) return;

  if (!episodeId) {
    form.style.display = "none";
    return;
  }

  const episode = episodes.find((item) => item.id === episodeId);
  if (!episode) {
    form.style.display = "none";
    return;
  }

  form.style.display = "block";

  $("editEpId").value = episode.id;
  $("editEpSeason").value = episode.season || 1;
  $("editEpNumber").value = episode.episode || 1;

  $("qualityContainer")?.replaceChildren();
  $("audioContainer")?.replaceChildren();
  $("subtitleContainer")?.replaceChildren();

  if (Array.isArray(episode.videoQualities) && episode.videoQualities.length) {
    episode.videoQualities.forEach((item) => {
      window.addQualityRow(item.src || "", String(item.quality || "1080"));
    });
  } else {
    window.addQualityRow();
  }

  if (Array.isArray(episode.audioTracks) && episode.audioTracks.length) {
    episode.audioTracks.forEach((item) => {
      window.addAudioRow(item.src || "", item.language || "Japanese");
    });
  } else {
    window.addAudioRow();
  }

  if (Array.isArray(episode.subtitles) && episode.subtitles.length) {
    episode.subtitles.forEach((item) => {
      window.addSubtitleRow(item.src || "", item.language || "en");
    });
  } else {
    window.addSubtitleRow();
  }
}

// ============================================================
// UPDATE EPISODE
// ============================================================

$("editEpisodeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("editEpMsg");
  const episodeId = getValue("editEpId");

  try {
    requireAuthorizedAdmin();

    if (!episodeId) {
      throw new Error("Select an episode to edit.");
    }

    setMessage(message, "Updating episode...", "info");

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error("At least one video URL is required.");
    }

    await updateDoc(doc(db, "episodes", episodeId), {
      season: getNumber("editEpSeason", 1),
      episode: getNumber("editEpNumber", 1),
      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitles: media.subtitles,
      updatedAt: serverTimestamp()
    });

    setMessage(message, "Episode updated successfully!", "success");
  } catch (error) {
    console.error("Episode update failed:", error);
    setMessage(message, `Error: ${error.message}`, "error");
  }
});

// ============================================================
// INITIAL ROWS
// ============================================================

if ($("qualityContainer")?.children.length === 0) {
  window.addQualityRow();
}

if ($("audioContainer")?.children.length === 0) {
  window.addAudioRow();
}

if ($("subtitleContainer")?.children.length === 0) {
  window.addSubtitleRow();
}
