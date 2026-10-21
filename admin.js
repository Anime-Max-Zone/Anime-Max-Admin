/* ============================================================
   ANIME MAX ZONE — ADMIN PANEL
   File: admin.js

   Firebase Authentication
   Realtime Database
   Admin UID Verification
   Anime Management
   Episode Upload / Edit / Delete
   Video Qualities / Audio Tracks / Subtitles

   DATABASE STRUCTURE:
   admins/{uid}: true
   anime/{animeId}
   anime/{animeId}/episodes/{episodeId}
   ============================================================ */

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ============================================================
   1. FIREBASE CONFIGURATION
   ============================================================ */

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

const auth = getAuth(app);
const db = getDatabase(app);

/* ============================================================
   2. HELPERS
   ============================================================ */

const $ = (id) => document.getElementById(id);

let authorizedAdminUid = null;
let authInitialized = false;
let authCheckInProgress = false;
let authCheckVersion = 0;

const currentPath = window.location.pathname;

const isLoginPage =
  /\/index\.html$|\/$/.test(currentPath);

function setMessage(element, message, type = "info") {
  if (!element) return;

  element.textContent = message;

  const colors = {
    success: "var(--success, #22c55e)",
    error: "var(--danger, #ff647c)",
    info: "var(--text-muted, #a1a1b5)"
  };

  element.style.color = colors[type] || colors.info;
}

function getValue(id) {
  return $(id)?.value?.trim() || "";
}

function safeText(value, fallback = "") {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value).trim() || fallback;
  }

  return fallback;
}

function getNumber(id, fallback = 1) {
  const raw = getValue(id);

  if (!raw) return fallback;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0
    ? value
    : fallback;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function requireAuthorizedAdmin() {
  const user = auth.currentUser;

  if (
    !user ||
    !authorizedAdminUid ||
    user.uid !== authorizedAdminUid
  ) {
    throw new Error(
      "Admin authorization required. Please log in again."
    );
  }

  return user;
}

function showError(element, error, fallback = "Operation failed.") {
  console.error(fallback, error);

  let message = error?.message || fallback;

  if (
    error?.code === "PERMISSION_DENIED" ||
    error?.code === "database/permission-denied"
  ) {
    message =
      "Database permission denied. Check Firebase Realtime Database Rules.";
  } else if (
    error?.code === "auth/invalid-credential" ||
    error?.code === "auth/wrong-password" ||
    error?.code === "auth/user-not-found" ||
    error?.code === "auth/invalid-email"
  ) {
    message = "Invalid email or password.";
  } else if (
    error?.code === "auth/too-many-requests"
  ) {
    message = "Too many attempts. Please try again later.";
  }

  setMessage(element, message, "error");
}

function getAnimeTitle(anime) {
  return safeText(anime?.title, "Untitled Anime");
}

function getAnimePoster(anime) {
  const url = safeText(
    anime?.coverImageUrl || anime?.posterUrl
  );

  return isValidHttpUrl(url) ? url : "";
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

/* ============================================================
   3. ADMIN UID VERIFICATION

   RTDB:
   admins/
     FIREBASE_AUTH_UID: true

   Value must be boolean true.
   ============================================================ */

async function verifyAdmin(user) {
  if (!user) return false;

  try {
    const snapshot = await get(
      ref(db, `admins/${user.uid}`)
    );

    return (
      snapshot.exists() &&
      snapshot.val() === true
    );
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

/* ============================================================
   4. AUTH STATE MANAGEMENT
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  const version = ++authCheckVersion;

  authCheckInProgress = true;
  authorizedAdminUid = null;

  try {
    if (!user) {
      authInitialized = true;

      if (!isLoginPage) {
        window.location.replace("index.html");
      }

      return;
    }

    const isAdmin = await verifyAdmin(user);

    if (version !== authCheckVersion) return;

    if (!isAdmin) {
      await signOut(auth);

      authInitialized = true;

      if (!isLoginPage) {
        window.location.replace(
          "index.html?error=unauthorized"
        );
      } else {
        setMessage(
          $("loginError"),
          "Access denied. This account is not an authorized admin.",
          "error"
        );
      }

      return;
    }

    authorizedAdminUid = user.uid;
    authInitialized = true;

    if (isLoginPage) {
      window.location.replace("anime-list.html");
      return;
    }

    await initializeAdminPage();
  } catch (error) {
    if (version !== authCheckVersion) return;

    showError(
      $("loginError") ||
      $("animeMsg") ||
      $("episodeMsg") ||
      $("editEpMsg"),
      error,
      "Unable to initialize the admin panel."
    );
  } finally {
    if (version === authCheckVersion) {
      authCheckInProgress = false;
    }
  }
});

/* ============================================================
   5. INITIALIZE CURRENT PAGE
   ============================================================ */

async function initializeAdminPage() {
  requireAuthorizedAdmin();

  if ($("adminAnimeList")) {
    await loadAnimeList();
  }

  if ($("selectAnimeForEp")) {
    await loadAnimeForDropdown("selectAnimeForEp");
  }

  if ($("editSelectAnime")) {
    const select = $("editSelectAnime");

    select.addEventListener(
      "change",
      loadEpisodesForEdit
    );

    await loadAnimeForDropdown("editSelectAnime");
  }

  if ($("episodeForm")) {
    resetMediaRows();
  }

  if ($("editEpisodeForm")) {
    $("editEpisodeForm").style.display = "none";
  }

  // Support upload.html?id=ANIME_ID.
  const requestedAnimeId =
    new URLSearchParams(window.location.search).get("id");

  if (requestedAnimeId && $("selectAnimeForEp")) {
    $("selectAnimeForEp").value = requestedAnimeId;
  }
}

/* ============================================================
   6. LOGIN
   ============================================================ */

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = getValue("adminEmail");
  const password = $("adminPassword")?.value || "";
  const button = $("loginBtn");
  const errorElement = $("loginError");

  if (!email || !password) {
    setMessage(
      errorElement,
      "Enter your email and password.",
      "error"
    );
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
      authorizedAdminUid = null;

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
    showError(
      errorElement,
      error,
      "Login failed."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
});

/* ============================================================
   7. LOGOUT
   ============================================================ */

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

/* ============================================================
   8. VIDEO URL FORMATTER

   Converts common Google Drive share URLs into:
   https://drive.google.com/uc?export=download&id=FILE_ID

   NOTE:
   This URL format does not guarantee HTML5 video streaming.
   The Drive file must be publicly accessible and compatible.
   ============================================================ */

function formatVideoUrl(value) {
  const url = safeText(value);

  if (!url) return "";

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid video URL.");
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const host = parsed.hostname.toLowerCase();

  if (
    host !== "drive.google.com" &&
    host !== "www.drive.google.com"
  ) {
    return url;
  }

  let fileId = "";

  const match = parsed.pathname.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (match) {
    fileId = match[1];
  }

  if (!fileId) {
    fileId = parsed.searchParams.get("id") || "";
  }

  if (!fileId) {
    throw new Error(
      "Could not find a Google Drive file ID in this URL."
    );
  }

  return (
    "https://drive.google.com/uc?export=download&id=" +
    encodeURIComponent(fileId)
  );
}

/* ============================================================
   9. DYNAMIC MEDIA ROWS
   ============================================================ */

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

  const row = createElement("div", "dynamic-row");

  const input = document.createElement("input");

  input.type = "url";
  input.className = inputClass;
  input.placeholder = inputPlaceholder;
  input.value = inputValue;
  input.autocomplete = "url";
  input.spellcheck = false;

  const select = document.createElement("select");

  select.className = selectClass;

  options.forEach((option) => {
    const item = document.createElement("option");

    item.value = option.value;
    item.textContent = option.label;

    select.appendChild(item);
  });

  const wantedValue = String(selectedValue ?? "");

  if (
    wantedValue &&
    options.some((option) => option.value === wantedValue)
  ) {
    select.value = wantedValue;
  }

  const removeButton = document.createElement("button");

  removeButton.type = "button";
  removeButton.className = "btn-remove-row";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "Remove row");
  removeButton.title = "Remove row";

  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(input, select, removeButton);
  container.appendChild(row);
}

window.addQualityRow = (
  url = "",
  quality = "1080"
) => {
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

window.addAudioRow = (
  url = "",
  lang = "Japanese"
) => {
  createDynamicRow({
    containerId: "audioContainer",
    inputClass: "a-url",
    inputPlaceholder: "Audio/video URL",
    inputValue: url,
    selectClass: "a-lang",
    options: AUDIO_OPTIONS,
    selectedValue: lang
  });
};

window.addSubtitleRow = (
  url = "",
  lang = "en"
) => {
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

/* ============================================================
   10. COLLECT MEDIA DATA
   ============================================================ */

function collectRows(
  containerId,
  inputSelector,
  selectSelector,
  type
) {
  const result = [];

  document
    .querySelectorAll(`#${containerId} .dynamic-row`)
    .forEach((row) => {
      const rawUrl =
        row.querySelector(inputSelector)?.value?.trim() || "";

      const selected =
        row.querySelector(selectSelector)?.value || "";

      // Empty optional rows are ignored.
      if (!rawUrl) return;

      if (!isValidHttpUrl(rawUrl)) {
        throw new Error(`Invalid ${type} URL.`);
      }

      if (type === "subtitle") {
        result.push({
          src: rawUrl,
          language: selected
        });

        return;
      }

      const formattedUrl = formatVideoUrl(rawUrl);

      if (type === "quality") {
        result.push({
          src: formattedUrl,
          quality: selected
        });
      } else {
        result.push({
          src: formattedUrl,
          language: selected
        });
      }
    });

  return result;
}

function collectMediaData() {
  return {
    videoQualities: collectRows(
      "qualityContainer",
      ".v-url",
      ".v-quality",
      "quality"
    ),

    audioTracks: collectRows(
      "audioContainer",
      ".a-url",
      ".a-lang",
      "audio"
    ),

    subtitles: collectRows(
      "subtitleContainer",
      ".s-url",
      ".s-lang",
      "subtitle"
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

/* ============================================================
   11. ADD ANIME
   ============================================================ */

$("animeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("animeMsg");
  const button = $("animeForm")?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (button) button.disabled = true;

  try {
    requireAuthorizedAdmin();

    const title = getValue("animeTitle");
    const poster = getValue("animePoster");
    const type = getValue("animeType");
    const genres = getValue("animeGenres")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!title) {
      throw new Error("Anime title is required.");
    }

    if (poster && !isValidHttpUrl(poster)) {
      throw new Error("Enter a valid poster image URL.");
    }

    const animeRef = push(ref(db, "anime"));

    const animeData = {
      title,
      type,
      coverImageUrl: poster,
      posterUrl: poster,
      genres,
      totalSeasons: getNumber("animeSeasons", 1),
      description: getValue("animeDesc"),
      createdAt: Date.now(),
      episodes: {}
    };

    setMessage(message, "Saving anime...", "info");

    await set(animeRef, animeData);

    setMessage(
      message,
      "Anime saved successfully!",
      "success"
    );

    $("animeForm").reset();

    setTimeout(() => {
      window.location.href = "anime-list.html";
    }, 700);
  } catch (error) {
    showError(message, error, "Anime save failed.");
  } finally {
    if (button) button.disabled = false;
  }
});

/* ============================================================
   12. LOAD ANIME LIST
   ============================================================ */

async function loadAnimeList() {
  requireAuthorizedAdmin();

  const container = $("adminAnimeList");

  if (!container) return;

  container.replaceChildren();

  container.appendChild(
    createElement("p", "loading", "Loading anime...")
  );

  try {
    const snapshot = await get(ref(db, "anime"));

    requireAuthorizedAdmin();

    container.replaceChildren();

    if (!snapshot.exists()) {
      container.appendChild(
        createElement(
          "p",
          "empty-state",
          "No anime found. Add your first anime."
        )
      );

      return;
    }

    const animeItems = [];

    snapshot.forEach((child) => {
      const value = child.val();

      if (!value || typeof value !== "object") return;

      animeItems.push({
        id: child.key,
        ...value
      });
    });

    animeItems.sort(
      (a, b) =>
        (Number(b.createdAt) || 0) -
        (Number(a.createdAt) || 0)
    );

    animeItems.forEach((anime) => {
      const card = createElement("div", "admin-card");

      const image = document.createElement("img");

      const poster = getAnimePoster(anime);

      image.src = poster ||
        "https://placehold.co/100x140/151522/ffffff?text=Anime";

      image.alt = getAnimeTitle(anime);
      image.loading = "lazy";

      image.addEventListener("error", () => {
        image.src =
          "https://placehold.co/100x140/151522/ffffff?text=Anime";
      }, { once: true });

      const info = createElement("div", "admin-info");

      const heading = createElement(
        "h3",
        "",
        getAnimeTitle(anime)
      );

      const details = createElement("p");

      const genres = Array.isArray(anime.genres)
        ? anime.genres.join(", ")
        : safeText(anime.genres);

      details.textContent = [
        safeText(anime.type, "Anime"),
        `${Number(anime.totalSeasons) || 1} Season(s)`,
        genres
      ].filter(Boolean).join(" • ");

      const description = safeText(anime.description);

      info.append(heading, details);

      if (description) {
        const shortDescription = createElement(
          "p",
          "",
          description.length > 110
            ? `${description.slice(0, 110)}…`
            : description
        );

        info.appendChild(shortDescription);
      }

      const actions = createElement("div", "admin-actions");

      const addEpisode = document.createElement("a");

      addEpisode.href =
        `upload.html?id=${encodeURIComponent(anime.id)}`;

      addEpisode.className = "btn-action btn-add";
      addEpisode.textContent = "+ Add Ep";

      const editAnime = document.createElement("a");

      editAnime.href =
        `edit.html?id=${encodeURIComponent(anime.id)}`;

      editAnime.className = "btn-action btn-edit";
      editAnime.textContent = "Edit Ep";

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "btn-action btn-delete";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        window.deleteAnime(anime.id);
      });

      actions.append(addEpisode, editAnime, deleteButton);
      card.append(image, info, actions);

      container.appendChild(card);
    });
  } catch (error) {
    showError(
      container,
      error,
      "Unable to load anime. Check database rules."
    );
  }
}

/* ============================================================
   13. DELETE ANIME AND ITS NESTED EPISODES
   ============================================================ */

window.deleteAnime = async (animeId) => {
  if (!animeId) return;

  try {
    requireAuthorizedAdmin();

    const confirmed = confirm(
      "Delete this anime and all its nested episodes? This cannot be undone."
    );

    if (!confirmed) return;

    await remove(ref(db, `anime/${animeId}`));

    await loadAnimeList();
  } catch (error) {
    console.error("Anime deletion failed:", error);

    alert(
      error?.message ||
      "Unable to delete anime. Check database rules."
    );
  }
};

/* ============================================================
   14. ANIME DROPDOWN
   ============================================================ */

async function loadAnimeForDropdown(selectId) {
  requireAuthorizedAdmin();

  const select = $(selectId);

  if (!select) return;

  select.disabled = true;
  select.replaceChildren();

  const loading = createElement(
    "option",
    "",
    "Loading anime..."
  );

  loading.value = "";
  select.appendChild(loading);

  try {
    const snapshot = await get(ref(db, "anime"));

    requireAuthorizedAdmin();

    select.replaceChildren();

    const placeholder = createElement(
      "option",
      "",
      "Select an Anime"
    );

    placeholder.value = "";
    select.appendChild(placeholder);

    const requestedAnimeId =
      new URLSearchParams(location.search).get("id");

    const animeItems = [];

    snapshot.forEach((child) => {
      const value = child.val();

      if (!value || typeof value !== "object") return;

      animeItems.push({
        id: child.key,
        ...value
      });
    });

    animeItems.sort(
      (a, b) =>
        getAnimeTitle(a).localeCompare(getAnimeTitle(b))
    );

    animeItems.forEach((anime) => {
      const option = document.createElement("option");

      option.value = anime.id;
      option.textContent = getAnimeTitle(anime);
      option.dataset.title = getAnimeTitle(anime);

      select.appendChild(option);
    });

    select.disabled = animeItems.length === 0;

    if (
      requestedAnimeId &&
      animeItems.some((item) => item.id === requestedAnimeId)
    ) {
      select.value = requestedAnimeId;
    }

    if (
      selectId === "editSelectAnime" &&
      select.value
    ) {
      await loadEpisodesForEdit();
    }
  } catch (error) {
    showError(
      null,
      error,
      "Unable to load anime dropdown."
    );

    select.replaceChildren();

    const option = createElement(
      "option",
      "",
      "Unable to load anime"
    );

    option.value = "";

    select.appendChild(option);
  }
}

/* ============================================================
   15. UPLOAD EPISODE
   Path:
   anime/{animeId}/episodes/{episodeId}
   ============================================================ */

$("episodeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("episodeMsg");
  const form = $("episodeForm");
  const button = form?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (button) button.disabled = true;

  try {
    requireAuthorizedAdmin();

    const animeSelect = $("selectAnimeForEp");
    const animeId = animeSelect?.value || "";

    if (!animeId) {
      throw new Error("Please select an anime.");
    }

    const selectedOption =
      animeSelect.options[animeSelect.selectedIndex];

    const animeTitle =
      selectedOption?.dataset.title ||
      selectedOption?.textContent?.trim() ||
      "";

    const season = getNumber("epSeason", 1);
    const episodeNumber = getNumber("epNumber", 1);

    if (!animeTitle) {
      throw new Error("Anime title is missing.");
    }

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error("Add at least one video URL.");
    }

    const qualities = {};

    media.videoQualities.forEach((item) => {
      qualities[item.quality] = item.src;
    });

    const subtitles = {};

    media.subtitles.forEach((item) => {
      subtitles[item.language] = item.src;
    });

    const episodeRef = push(
      ref(db, `anime/${animeId}/episodes`)
    );

    const now = Date.now();

    const episodeData = {
      animeId,
      animeTitle,
      season,
      episode: episodeNumber,

      // Admin editing format.
      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitlesList: media.subtitles,

      // Player-compatible format.
      qualities,
      subtitles,

      // Default playback URLs.
      videoUrl: media.videoQualities[0].src,
      url: media.videoQualities[0].src,
      audioUrl: media.audioTracks[0]?.src || "",
      streamUrl: media.videoQualities[0].src,

      createdAt: now,
      updatedAt: now
    };

    setMessage(message, "Saving episode...", "info");

    await set(episodeRef, episodeData);

    setMessage(
      message,
      "Episode uploaded successfully!",
      "success"
    );

    // Reset media fields while keeping selected anime.
    const selectedAnimeId = animeId;

    form.reset();

    if (animeSelect) {
      animeSelect.value = selectedAnimeId;
    }

    resetMediaRows();
  } catch (error) {
    showError(
      message,
      error,
      "Episode upload failed."
    );
  } finally {
    if (button) button.disabled = false;
  }
});

/* ============================================================
   16. LOAD EPISODES FOR EDITING
   ============================================================ */

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

  const placeholder = createElement(
    "option",
    "",
    animeId ? "Loading episodes..." : "Choose Anime First"
  );

  placeholder.value = "";

  episodeSelect.appendChild(placeholder);

  if (!animeId) return;

  try {
    const snapshot = await get(
      ref(db, `anime/${animeId}/episodes`)
    );

    requireAuthorizedAdmin();

    // Do not populate a stale result if the user changed anime.
    if (animeSelect.value !== animeId) return;

    const episodes = [];

    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const value = child.val();

        if (!value || typeof value !== "object") return;

        episodes.push({
          id: child.key,
          ...value
        });
      });
    }

    episodes.sort(
      (a, b) =>
        (Number(a.season) || 1) -
          (Number(b.season) || 1) ||
        (Number(a.episode) || 1) -
          (Number(b.episode) || 1)
    );

    episodeSelect.replaceChildren();

    const first = createElement(
      "option",
      "",
      episodes.length
        ? "Select Episode"
        : "No episodes found"
    );

    first.value = "";

    episodeSelect.appendChild(first);

    episodes.forEach((episode) => {
      const option = document.createElement("option");

      option.value = episode.id;

      option.textContent =
        `S${episode.season || 1} Ep${episode.episode || 1}`;

      episodeSelect.appendChild(option);
    });

    episodeSelect.disabled = episodes.length === 0;

    episodeSelect.onchange = () => {
      loadEditFormData(
        episodeSelect.value,
        episodes
      );
    };
  } catch (error) {
    showError(
      $("editEpMsg"),
      error,
      "Unable to load episodes."
    );

    episodeSelect.replaceChildren();

    const option = createElement(
      "option",
      "",
      "Unable to load episodes"
    );

    option.value = "";

    episodeSelect.appendChild(option);
  }
}

/* ============================================================
   17. POPULATE EDIT FORM
   ============================================================ */

function loadEditFormData(episodeId, episodes) {
  const form = $("editEpisodeForm");

  if (!form) return;

  if (!episodeId) {
    form.style.display = "none";
    return;
  }

  const episode = episodes.find(
    (item) => item.id === episodeId
  );

  if (!episode) {
    form.style.display = "none";
    return;
  }

  form.style.display = "block";

  if ($("editEpId")) {
    $("editEpId").value = episode.id;
  }

  if ($("editEpSeason")) {
    $("editEpSeason").value = episode.season || 1;
  }

  if ($("editEpNumber")) {
    $("editEpNumber").value = episode.episode || 1;
  }

  $("qualityContainer")?.replaceChildren();
  $("audioContainer")?.replaceChildren();
  $("subtitleContainer")?.replaceChildren();

  // Video qualities: array first, legacy map second.
  let videoQualities = Array.isArray(episode.videoQualities)
    ? episode.videoQualities
    : [];

  if (
    !videoQualities.length &&
    episode.qualities &&
    typeof episode.qualities === "object"
  ) {
    videoQualities = Object.entries(
      episode.qualities
    ).map(([quality, src]) => ({
      quality,
      src
    }));
  }

  if (videoQualities.length) {
    videoQualities.forEach((item) => {
      window.addQualityRow(
        item.src || "",
        String(item.quality || "1080")
      );
    });
  } else {
    window.addQualityRow(
      episode.videoUrl ||
      episode.url ||
      episode.streamUrl ||
      "",
      "1080"
    );
  }

  // Audio tracks.
  const audioTracks = Array.isArray(episode.audioTracks)
    ? episode.audioTracks
    : [];

  if (audioTracks.length) {
    audioTracks.forEach((item) => {
      window.addAudioRow(
        item.src || "",
        item.language || "Japanese"
      );
    });
  } else if (episode.audioUrl) {
    window.addAudioRow(
      episode.audioUrl,
      "Japanese"
    );
  } else {
    window.addAudioRow();
  }

  // Subtitles: current list first, legacy map second.
  let subtitleItems = Array.isArray(episode.subtitlesList)
    ? episode.subtitlesList
    : [];

  if (
    !subtitleItems.length &&
    episode.subtitles &&
    typeof episode.subtitles === "object"
  ) {
    subtitleItems = Object.entries(
      episode.subtitles
    ).map(([language, src]) => ({
      language,
      src
    }));
  }

  if (subtitleItems.length) {
    subtitleItems.forEach((item) => {
      window.addSubtitleRow(
        item.src || "",
        item.language || "en"
      );
    });
  } else {
    window.addSubtitleRow();
  }

  setMessage($("editEpMsg"), "");
}

/* ============================================================
   18. UPDATE EPISODE
   ============================================================ */

$("editEpisodeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("editEpMsg");
  const form = $("editEpisodeForm");
  const button = form?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (button) button.disabled = true;

  try {
    requireAuthorizedAdmin();

    const episodeId = getValue("editEpId");
    const animeId = getValue("editSelectAnime");

    if (!animeId || !episodeId) {
      throw new Error(
        "Select an anime and episode first."
      );
    }

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error(
        "At least one video URL is required."
      );
    }

    const qualities = {};

    media.videoQualities.forEach((item) => {
      qualities[item.quality] = item.src;
    });

    const subtitles = {};

    media.subtitles.forEach((item) => {
      subtitles[item.language] = item.src;
    });

    const selectedAnime =
      $("editSelectAnime")?.selectedOptions?.[0];

    const animeTitle =
      selectedAnime?.dataset.title ||
      selectedAnime?.textContent?.trim() ||
      "";

    const episodeRef = ref(
      db,
      `anime/${animeId}/episodes/${episodeId}`
    );

    const currentSnapshot = await get(episodeRef);

    requireAuthorizedAdmin();

    if (!currentSnapshot.exists()) {
      throw new Error(
        "This episode no longer exists. Reload the episode list."
      );
    }

    const currentEpisode = currentSnapshot.val() || {};

    await update(episodeRef, {
      animeId,
      animeTitle,
      season: getNumber("editEpSeason", 1),
      episode: getNumber("editEpNumber", 1),

      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitlesList: media.subtitles,

      qualities,
      subtitles,

      videoUrl: media.videoQualities[0].src,
      url: media.videoQualities[0].src,
      audioUrl: media.audioTracks[0]?.src || "",
      streamUrl: media.videoQualities[0].src,

      createdAt: currentEpisode.createdAt || Date.now(),
      updatedAt: Date.now()
    });

    setMessage(
      message,
      "Episode updated successfully!",
      "success"
    );
  } catch (error) {
    showError(
      message,
      error,
      "Episode update failed."
    );
  } finally {
    if (button) button.disabled = false;
  }
});

/* ============================================================
   19. DELETE EPISODE
   ============================================================ */

window.deleteEpisode = async (episodeId) => {
  const animeId = getValue("editSelectAnime");

  try {
    requireAuthorizedAdmin();

    if (!animeId || !episodeId) {
      throw new Error(
        "Select an anime and episode first."
      );
    }

    if (!confirm("Delete this episode permanently?")) {
      return;
    }

    await remove(
      ref(
        db,
        `anime/${animeId}/episodes/${episodeId}`
      )
    );

    setMessage(
      $("editEpMsg"),
      "Episode deleted successfully.",
      "success"
    );

    await loadEpisodesForEdit();
  } catch (error) {
    showError(
      $("editEpMsg"),
      error,
      "Episode deletion failed."
    );
  }
};

/* ============================================================
   20. INITIAL MEDIA ROWS
   ============================================================ */

if ($("qualityContainer")?.children.length === 0) {
  window.addQualityRow();
}

if ($("audioContainer")?.children.length === 0) {
  window.addAudioRow();
}

if ($("subtitleContainer")?.children.length === 0) {
  window.addSubtitleRow();
}

/* ============================================================
   END OF admin.js
   ============================================================ */
