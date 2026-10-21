/* ============================================================
   ANIME MAX ZONE — ADMIN PANEL
   File: admin.js
   Firebase Authentication + Realtime Database
   Admin UID verification
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

// ============================================================
// FIREBASE CONFIG
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

const auth = getAuth(app);
const db = getDatabase(app);

// ============================================================
// HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const isLoginPage =
  /\/index\.html$|\/$/.test(window.location.pathname);

let authorizedAdminUid = null;
let authInitialized = false;
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

    return url.protocol === "https:" ||
      url.protocol === "http:";
  } catch {
    return false;
  }
}

function requireAuthorizedAdmin() {
  if (!auth.currentUser || !authorizedAdminUid) {
    throw new Error(
      "Admin authorization required. Please log in again."
    );
  }

  if (auth.currentUser.uid !== authorizedAdminUid) {
    throw new Error("Unauthorized account.");
  }
}

function showError(element, error, fallback = "Operation failed.") {
  console.error(fallback, error);

  const message = error?.code === "PERMISSION_DENIED"
    ? "Permission denied. Check your Realtime Database Rules."
    : error?.message || fallback;

  setMessage(element, message, "error");
}

function getAnimeTitle(anime) {
  return safeText(anime?.title, "Untitled Anime");
}

// ============================================================
// ADMIN VERIFICATION
//
// Realtime Database:
//
// admins/
//   FIREBASE_AUTH_UID: true
// ============================================================

async function verifyAdmin(user) {
  if (!user) return false;

  try {
    const snapshot = await get(
      ref(db, `admins/${user.uid}`)
    );

    return snapshot.exists() && snapshot.val() === true;
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async (user) => {
  if (authCheckInProgress) return;

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

    if (!isAdmin) {
      await signOut(auth);

      authInitialized = true;

      if (!isLoginPage) {
        window.location.replace("index.html?error=unauthorized");
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
    showError(
      $("loginError") || $("animeMsg") || $("episodeMsg"),
      error,
      "Unable to initialize the admin panel."
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
      "Login failed. Check your credentials."
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
    throw new Error("Invalid video URL.");
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (parsed.hostname.toLowerCase() !== "drive.google.com") {
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

  if (!fileId) return url;

  return (
    "https://drive.google.com/uc?export=download&id=" +
    encodeURIComponent(fileId)
  );
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
    item.selected =
      option.value === String(selectedValue);

    select.appendChild(item);
  });

  const removeButton = document.createElement("button");

  removeButton.type = "button";
  removeButton.className = "btn-remove-row";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "Remove row");

  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(input, select, removeButton);
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
// COLLECT MEDIA DATA
// ============================================================

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

      if (!rawUrl) return;

      if (!isValidHttpUrl(rawUrl)) {
        throw new Error(`Invalid ${type} URL.`);
      }

      const src = type === "subtitle"
        ? rawUrl
        : formatVideoUrl(rawUrl);

      if (type === "quality") {
        result.push({
          src,
          quality: selected
        });
      } else {
        result.push({
          src,
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

// ============================================================
// ANIME DATA PATH
//
// /anime/{animeId}
// ============================================================

// ============================================================
// ADD ANIME — anime.html
// ============================================================

$("animeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("animeMsg");

  try {
    requireAuthorizedAdmin();

    const title = getValue("animeTitle");
    const poster = getValue("animePoster");

    if (!title) {
      throw new Error("Anime title is required.");
    }

    if (poster && !isValidHttpUrl(poster)) {
      throw new Error("Enter a valid poster image URL.");
    }

    const genres = getValue("animeGenres")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const animeRef = push(ref(db, "anime"));

    const animeData = {
      title,
      type: getValue("animeType"),
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

    setTimeout(() => {
      window.location.href = "anime-list.html";
    }, 800);
  } catch (error) {
    showError(message, error, "Anime save failed.");
  }
});

// ============================================================
// LOAD ANIME LIST
// ============================================================

async function loadAnimeList() {
  requireAuthorizedAdmin();

  const container = $("adminAnimeList");

  if (!container) return;

  container.textContent = "Loading anime...";

  try {
    const snapshot = await get(ref(db, "anime"));

    container.replaceChildren();

    if (!snapshot.exists()) {
      const p = document.createElement("p");

      p.className = "empty-state";
      p.textContent = "No anime found in the database.";

      container.appendChild(p);
      return;
    }

    const animeItems = [];

    snapshot.forEach((child) => {
      animeItems.push({
        id: child.key,
        ...child.val()
      });
    });

    animeItems.sort(
      (a, b) =>
        (Number(b.createdAt) || 0) -
        (Number(a.createdAt) || 0)
    );

    animeItems.forEach((anime) => {
      const card = document.createElement("div");
      card.className = "admin-card";

      const image = document.createElement("img");

      const poster = safeText(
        anime.coverImageUrl || anime.posterUrl
      );

      image.src = isValidHttpUrl(poster)
        ? poster
        : "https://placehold.co/70x100?text=Anime";

      image.alt = getAnimeTitle(anime);
      image.loading = "lazy";

      const info = document.createElement("div");
      info.className = "admin-info";

      const heading = document.createElement("h3");
      heading.textContent = getAnimeTitle(anime);

      const details = document.createElement("p");

      const genres = Array.isArray(anime.genres)
        ? anime.genres.join(", ")
        : safeText(anime.genres);

      details.textContent = [
        safeText(anime.type, "Anime"),
        `${Number(anime.totalSeasons) || 1} Seasons`,
        genres
      ].filter(Boolean).join(" • ");

      info.append(heading, details);

      const actions = document.createElement("div");
      actions.className = "admin-actions";

      const addEpisode = document.createElement("a");

      addEpisode.href =
        `upload.html?id=${encodeURIComponent(anime.id)}`;

      addEpisode.className = "btn-action btn-add";
      addEpisode.textContent = "+ Add Ep";

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "btn-action btn-delete";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        window.deleteAnime(anime.id);
      });

      actions.append(addEpisode, deleteButton);
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

// ============================================================
// DELETE ANIME AND ITS NESTED EPISODES
// ============================================================

window.deleteAnime = async (animeId) => {
  if (!animeId) return;

  try {
    requireAuthorizedAdmin();

    if (
      !confirm(
        "Delete this anime and all its episodes? This cannot be undone."
      )
    ) {
      return;
    }

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
    const snapshot = await get(ref(db, "anime"));

    select.replaceChildren();

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Select an Anime";

    select.appendChild(placeholder);

    const preSelectedId =
      new URLSearchParams(location.search).get("id");

    const animeItems = [];

    snapshot.forEach((child) => {
      animeItems.push({
        id: child.key,
        ...child.val()
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
      option.selected = anime.id === preSelectedId;

      select.appendChild(option);
    });

    select.disabled = false;

    if (selectId === "editSelectAnime" && preSelectedId) {
      await loadEpisodesForEdit();
    }
  } catch (error) {
    showError(
      null,
      error,
      "Unable to load anime dropdown."
    );

    select.replaceChildren();

    const option = document.createElement("option");

    option.value = "";
    option.textContent = "Unable to load anime";

    select.appendChild(option);
  }
}

// ============================================================
// UPLOAD EPISODE
//
// /anime/{animeId}/episodes/{episodeId}
//
// This nested structure is used to match the existing player.
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

    const animeId = select.value;

    const selectedOption =
      select.options[select.selectedIndex];

    const selectedTitle =
      selectedOption?.dataset.title ||
      selectedOption?.textContent ||
      "";

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error("Add at least one video URL.");
    }

    const episodeRef = push(
      ref(db, `anime/${animeId}/episodes`)
    );

    const qualities = {};

    media.videoQualities.forEach((item) => {
      qualities[item.quality] = item.src;
    });

    const subtitles = {};

    media.subtitles.forEach((item) => {
      subtitles[item.language] = item.src;
    });

    const episodeData = {
      animeId,
      animeTitle: selectedTitle.trim(),
      season: getNumber("epSeason", 1),
      episode: getNumber("epNumber", 1),

      // Fields used by the current admin UI.
      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitlesList: media.subtitles,

      // Fields for the existing video-player.js.
      qualities,
      subtitles,

      // The primary video URL and default audio URL.
      videoUrl: media.videoQualities[0].src,
      url: media.videoQualities[0].src,
      audioUrl: media.audioTracks[0]?.src || "",
      streamUrl: media.videoQualities[0].src,

      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(episodeRef, episodeData);

    setMessage(
      message,
      "Episode uploaded successfully!",
      "success"
    );

    $("episodeForm").reset();

    // Preserve the selected anime after reset.
    select.value = animeId;

    resetMediaRows();
  } catch (error) {
    showError(message, error, "Episode upload failed.");
  }
});

// ============================================================
// LOAD EPISODES FOR EDIT
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
  placeholder.textContent = animeId
    ? "Loading episodes..."
    : "Choose Anime First";

  episodeSelect.appendChild(placeholder);

  if (!animeId) return;

  try {
    const snapshot = await get(
      ref(db, `anime/${animeId}/episodes`)
    );

    const episodes = [];

    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        episodes.push({
          id: child.key,
          ...child.val()
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

    const first = document.createElement("option");

    first.value = "";
    first.textContent = episodes.length
      ? "Select Episode"
      : "No episodes found";

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
      null,
      error,
      "Unable to load episodes."
    );

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

  let videoQualities = Array.isArray(episode.videoQualities)
    ? episode.videoQualities
    : [];

  // Support the qualities map used by video-player.js.
  if (!videoQualities.length && episode.qualities) {
    videoQualities = Object.entries(episode.qualities).map(
      ([quality, src]) => ({
        quality,
        src
      })
    );
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
      episode.videoUrl || episode.url || episode.streamUrl || "",
      "1080"
    );
  }

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

  let subtitleItems = Array.isArray(episode.subtitlesList)
    ? episode.subtitlesList
    : [];

  if (!subtitleItems.length && episode.subtitles) {
    subtitleItems = Object.entries(episode.subtitles).map(
      ([language, src]) => ({
        language,
        src
      })
    );
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
}

// ============================================================
// UPDATE EPISODE
// ============================================================

$("editEpisodeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("editEpMsg");
  const episodeId = getValue("editEpId");
  const animeId = getValue("editSelectAnime");

  try {
    requireAuthorizedAdmin();

    if (!animeId || !episodeId) {
      throw new Error("Select an anime and episode first.");
    }

    setMessage(message, "Updating episode...", "info");

    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error("At least one video URL is required.");
    }

    const qualities = {};

    media.videoQualities.forEach((item) => {
      qualities[item.quality] = item.src;
    });

    const subtitles = {};

    media.subtitles.forEach((item) => {
      subtitles[item.language] = item.src;
    });

    const episodeRef = ref(
      db,
      `anime/${animeId}/episodes/${episodeId}`
    );

    await update(episodeRef, {
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

      updatedAt: Date.now()
    });

    setMessage(
      message,
      "Episode updated successfully!",
      "success"
    );
  } catch (error) {
    showError(message, error, "Episode update failed.");
  }
});

// ============================================================
// DELETE EPISODE
// Optional: call window.deleteEpisode(episodeId)
// from an existing button if needed.
// ============================================================

window.deleteEpisode = async (episodeId) => {
  const animeId = getValue("editSelectAnime");

  try {
    requireAuthorizedAdmin();

    if (!animeId || !episodeId) {
      throw new Error("Select an anime and episode.");
    }

    if (!confirm("Delete this episode permanently?")) {
      return;
    }

    await remove(
      ref(db, `anime/${animeId}/episodes/${episodeId}`)
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

// ============================================================
// INITIAL MEDIA ROWS
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
