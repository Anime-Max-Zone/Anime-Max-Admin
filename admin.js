/* ============================================================
   ANIME MAX ZONE — ADMIN PANEL LOGIC
   File: admin.js
   Full Replace Version
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

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCpfrluxsBhnz48ve9RykIy1IxzbBfk7dA",
  authDomain: "sm-studio-7.firebaseapp.com",
  projectId: "sm-studio-7",
  storageBucket: "sm-studio-7.firebasestorage.app",
  messagingSenderId: "126291501472",
  appId: "1:126291501472:web:47386660af8ec3a57204c5"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================
// HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

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
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const result = String(value).trim();
    return result || fallback;
  }

  return fallback;
}

function getNumber(id, fallback = 1) {
  const value = Number.parseInt(getValue(id), 10);

  return Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
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

  if (
    parsed.hostname !== "drive.google.com" &&
    parsed.hostname !== "www.drive.google.com"
  ) {
    return url;
  }

  let fileId = "";

  // https://drive.google.com/file/d/FILE_ID/view
  const filePathMatch = parsed.pathname.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (filePathMatch) {
    fileId = filePathMatch[1];
  }

  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
  if (!fileId) {
    fileId = parsed.searchParams.get("id") || "";
  }

  if (!fileId) {
    return url;
  }

  // This URL format does not guarantee browser playback.
  // The file must be accessible and Google Drive must
  // permit the requested download/stream.
  return (
    "https://drive.google.com/uc" +
    "?export=download&id=" +
    encodeURIComponent(fileId)
  );
}

// ============================================================
// AUTHENTICATION & ROUTING
// ============================================================

const isLoginPage =
  window.location.pathname.endsWith("/") ||
  window.location.pathname.endsWith("/index.html");

let authInitialized = false;
let initializedUserId = null;

onAuthStateChanged(auth, async (user) => {
  authInitialized = true;

  if (!user) {
    initializedUserId = null;

    if (!isLoginPage) {
      window.location.replace("index.html");
    }

    return;
  }

  if (isLoginPage) {
    window.location.replace("anime-list.html");
    return;
  }

  // Avoid duplicate initialization if auth state
  // changes without changing the signed-in account.
  if (initializedUserId === user.uid) {
    return;
  }

  initializedUserId = user.uid;

  try {
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
    console.error(
      "Admin page initialization failed:",
      error
    );
  }
});

// ============================================================
// LOGIN
// ============================================================

const loginForm = $("loginForm");

loginForm?.addEventListener("submit", async (event) => {
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
    button.textContent = "Logging in...";
  }

  setMessage(errorElement, "");

  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // The authentication observer handles routing.
  } catch (error) {
    console.error("Login failed:", error);

    setMessage(
      errorElement,
      "Login failed. Check your credentials and try again.",
      "error"
    );

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
  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Unable to log out. Please try again.");
  }
});

// ============================================================
// DYNAMIC ROW BUILDERS
// ============================================================

function createDynamicRow({
  containerId,
  inputClass,
  inputPlaceholder,
  inputValue,
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
    const element = document.createElement("option");

    element.value = option.value;
    element.textContent = option.label;
    element.selected =
      option.value === String(selectedValue);

    select.appendChild(element);
  });

  const removeButton = document.createElement("button");

  removeButton.type = "button";
  removeButton.className = "btn-remove-row";
  removeButton.textContent = "×";
  removeButton.setAttribute(
    "aria-label",
    "Remove row"
  );

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
    inputPlaceholder: "Audio/Video URL",
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

// ============================================================
// COLLECT VIDEO / AUDIO / SUBTITLE ROWS
// ============================================================

function collectRows(containerId, inputSelector, selectSelector, key) {
  const result = [];

  document
    .querySelectorAll(`#${containerId} .dynamic-row`)
    .forEach((row) => {
      const rawUrl =
        row.querySelector(inputSelector)?.value?.trim() || "";

      const selectedValue =
        row.querySelector(selectSelector)?.value || "";

      if (!rawUrl) return;

      if (!isValidHttpUrl(rawUrl)) {
        throw new Error(
          `Invalid URL in ${key}: ${rawUrl}`
        );
      }

      const formattedUrl =
        key === "subtitle"
          ? rawUrl
          : formatVideoUrl(rawUrl);

      if (key === "quality") {
        result.push({
          src: formattedUrl,
          quality: selectedValue
        });
      } else if (key === "audio") {
        result.push({
          src: formattedUrl,
          language: selectedValue
        });
      } else {
        result.push({
          src: formattedUrl,
          language: selectedValue
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
  const qualityContainer = $("qualityContainer");
  const audioContainer = $("audioContainer");
  const subtitleContainer = $("subtitleContainer");

  if (qualityContainer) qualityContainer.replaceChildren();
  if (audioContainer) audioContainer.replaceChildren();
  if (subtitleContainer) subtitleContainer.replaceChildren();

  window.addQualityRow();
  window.addAudioRow();
  window.addSubtitleRow();
}

// ============================================================
// ADD ANIME
// Page: anime.html
// ============================================================

const animeForm = $("animeForm");

animeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("animeMsg");

  setMessage(message, "Saving anime...", "info");

  const title = getValue("animeTitle");
  const poster = getValue("animePoster");

  if (!title) {
    setMessage(
      message,
      "Anime title is required.",
      "error"
    );
    return;
  }

  if (poster && !isValidHttpUrl(poster)) {
    setMessage(
      message,
      "Enter a valid poster image URL.",
      "error"
    );
    return;
  }

  const genres = getValue("animeGenres")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);

  const newAnime = {
    title,
    type: getValue("animeType"),
    coverImageUrl: poster,
    genres,
    totalSeasons: getNumber("animeSeasons", 1),
    description: getValue("animeDesc"),
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(
      collection(db, "anime"),
      newAnime
    );

    setMessage(
      message,
      "Anime saved successfully!",
      "success"
    );

    setTimeout(() => {
      window.location.href = "anime-list.html";
    }, 800);

  } catch (error) {
    console.error("Anime save failed:", error);

    setMessage(
      message,
      `Error: ${error.message}`,
      "error"
    );
  }
});

// ============================================================
// LOAD ANIME LIST
// Page: anime-list.html
// ============================================================

async function loadAnimeList() {
  const container = $("adminAnimeList");

  if (!container) return;

  container.textContent = "Loading anime...";

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "anime"),
        orderBy("createdAt", "desc")
      )
    );

    container.replaceChildren();

    if (snapshot.empty) {
      const message = document.createElement("p");

      message.className = "empty-state";
      message.textContent =
        "No anime found in the database.";

      container.appendChild(message);
      return;
    }

    snapshot.forEach((documentSnapshot) => {
      const anime = documentSnapshot.data();
      const id = documentSnapshot.id;

      const card = document.createElement("div");
      card.className = "admin-card";

      const image = document.createElement("img");

      image.src = isValidHttpUrl(
        safeText(anime.coverImageUrl)
      )
        ? anime.coverImageUrl
        : "https://placehold.co/70x100?text=Anime";

      image.alt = safeText(anime.title, "Anime poster");
      image.loading = "lazy";

      const info = document.createElement("div");
      info.className = "admin-info";

      const heading = document.createElement("h3");
      heading.textContent = safeText(
        anime.title,
        "Untitled Anime"
      );

      const details = document.createElement("p");

      const genres = Array.isArray(anime.genres)
        ? anime.genres.join(", ")
        : "";

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
        `upload.html?id=${encodeURIComponent(id)}`;

      addEpisode.className = "btn-action btn-add";
      addEpisode.textContent = "+ Add Ep";

      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className =
        "btn-action btn-delete";

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
      "Error loading anime. Check your connection and Firestore rules.";
  }
}

// ============================================================
// DELETE ANIME
// ============================================================

window.deleteAnime = async (id) => {
  if (!id) return;

  const confirmed = confirm(
    "Delete this anime? This does not automatically delete its episodes."
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "anime", id));
    await loadAnimeList();

  } catch (error) {
    console.error("Anime deletion failed:", error);

    alert(
      "Unable to delete anime. Check your Firestore permissions."
    );
  }
};

// ============================================================
// LOAD ANIME DROPDOWN
// ============================================================

async function loadAnimeForDropdown(selectId) {
  const select = $(selectId);

  if (!select) return;

  select.disabled = true;
  select.replaceChildren();

  const loadingOption = document.createElement("option");

  loadingOption.value = "";
  loadingOption.textContent = "Loading anime...";

  select.appendChild(loadingOption);

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "anime"),
        orderBy("createdAt", "desc")
      )
    );

    select.replaceChildren();

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Select an Anime";

    select.appendChild(placeholder);

    const preSelectedId =
      new URLSearchParams(
        window.location.search
      ).get("id");

    snapshot.forEach((documentSnapshot) => {
      const anime = documentSnapshot.data();

      const option = document.createElement("option");

      option.value = documentSnapshot.id;
      option.textContent = safeText(
        anime.title,
        "Untitled Anime"
      );

      option.dataset.title = safeText(anime.title);

      option.selected =
        documentSnapshot.id === preSelectedId;

      select.appendChild(option);
    });

    select.disabled = false;

    if (
      selectId === "editSelectAnime" &&
      preSelectedId
    ) {
      await loadEpisodesForEdit();
    }

  } catch (error) {
    console.error(
      "Anime dropdown load failed:",
      error
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
// Page: upload.html
// ============================================================

const episodeForm = $("episodeForm");

episodeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("episodeMsg");
  const select = $("selectAnimeForEp");

  if (!select?.value) {
    setMessage(
      message,
      "Please select an anime!",
      "error"
    );
    return;
  }

  const selectedOption =
    select.options[select.selectedIndex];

  const selectedTitle =
    selectedOption?.dataset.title ||
    selectedOption?.textContent ||
    "";

  setMessage(message, "Uploading episode...", "info");

  try {
    const media = collectMediaData();

    if (!media.videoQualities.length) {
      throw new Error(
        "Add at least one video URL before uploading."
      );
    }

    const newEpisode = {
      animeId: select.value,
      animeTitle: selectedTitle.trim(),
      season: getNumber("epSeason", 1),
      episode: getNumber("epNumber", 1),

      videoQualities: media.videoQualities,
      audioTracks: media.audioTracks,
      subtitles: media.subtitles,

      createdAt: new Date().toISOString()
    };

    await addDoc(
      collection(db, "episodes"),
      newEpisode
    );

    setMessage(
      message,
      "Episode uploaded successfully!",
      "success"
    );

    episodeForm.reset();

    if (select) {
      select.value = newEpisode.animeId;
    }

    resetMediaRows();

  } catch (error) {
    console.error("Episode upload failed:", error);

    setMessage(
      message,
      `Error: ${error.message}`,
      "error"
    );
  }
});

// ============================================================
// EDIT EPISODE — LOAD EPISODES
// Page: edit.html
// ============================================================

async function loadEpisodesForEdit() {
  const animeSelect = $("editSelectAnime");
  const episodeSelect = $("editSelectEpisode");
  const form = $("editEpisodeForm");

  if (!animeSelect || !episodeSelect || !form) {
    return;
  }

  const selectedAnimeId = animeSelect.value;

  form.style.display = "none";
  episodeSelect.disabled = true;
  episodeSelect.replaceChildren();

  const loadingOption = document.createElement("option");

  loadingOption.value = "";
  loadingOption.textContent = selectedAnimeId
    ? "Loading episodes..."
    : "Choose Anime First";

  episodeSelect.appendChild(loadingOption);

  if (!selectedAnimeId) {
    return;
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "episodes"),
        where("animeId", "==", selectedAnimeId)
      )
    );

    const episodeDocuments = snapshot.docs.map(
      (documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })
    );

    episodeDocuments.sort(
      (a, b) =>
        (Number(a.season) || 1) -
          (Number(b.season) || 1) ||
        (Number(a.episode) || 1) -
          (Number(b.episode) || 1)
    );

    episodeSelect.replaceChildren();

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = episodeDocuments.length
      ? "Select Episode"
      : "No episodes found";

    episodeSelect.appendChild(placeholder);

    episodeDocuments.forEach((episode) => {
      const option = document.createElement("option");

      option.value = episode.id;

      option.textContent =
        `S${episode.season || 1} Ep${episode.episode || 1}`;

      episodeSelect.appendChild(option);
    });

    episodeSelect.disabled =
      episodeDocuments.length === 0;

    episodeSelect.onchange = () => {
      loadEditFormData(
        episodeSelect.value,
        episodeDocuments
      );
    };

  } catch (error) {
    console.error(
      "Loading episodes for edit failed:",
      error
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

function loadEditFormData(episodeId, episodeDocuments) {
  const form = $("editEpisodeForm");

  if (!form) return;

  if (!episodeId) {
    form.style.display = "none";
    return;
  }

  const episode = episodeDocuments.find(
    (item) => item.id === episodeId
  );

  if (!episode) {
    form.style.display = "none";
    return;
  }

  form.style.display = "block";

  $("editEpId").value = episode.id;
  $("editEpSeason").value = episode.season || 1;
  $("editEpNumber").value = episode.episode || 1;

  const qualityContainer = $("qualityContainer");
  const audioContainer = $("audioContainer");
  const subtitleContainer = $("subtitleContainer");

  if (qualityContainer) qualityContainer.replaceChildren();
  if (audioContainer) audioContainer.replaceChildren();
  if (subtitleContainer) subtitleContainer.replaceChildren();

  if (
    Array.isArray(episode.videoQualities) &&
    episode.videoQualities.length
  ) {
    episode.videoQualities.forEach((quality) => {
      window.addQualityRow(
        quality.src || "",
        String(quality.quality || "1080")
      );
    });
  } else {
    window.addQualityRow();
  }

  if (
    Array.isArray(episode.audioTracks) &&
    episode.audioTracks.length
  ) {
    episode.audioTracks.forEach((audio) => {
      window.addAudioRow(
        audio.src || "",
        audio.language || "Japanese"
      );
    });
  } else {
    window.addAudioRow();
  }

  if (
    Array.isArray(episode.subtitles) &&
    episode.subtitles.length
  ) {
    episode.subtitles.forEach((subtitle) => {
      window.addSubtitleRow(
        subtitle.src || "",
        subtitle.language || "en"
      );
    });
  } else {
    window.addSubtitleRow();
  }
}

// ============================================================
// UPDATE EPISODE
// ============================================================

const editEpisodeForm = $("editEpisodeForm");

editEpisodeForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const episodeId = getValue("editEpId");
    const message = $("editEpMsg");

    if (!episodeId) {
      setMessage(
        message,
        "Select an episode to edit.",
        "error"
      );
      return;
    }

    setMessage(
      message,
      "Updating episode...",
      "info"
    );

    try {
      const media = collectMediaData();

      if (!media.videoQualities.length) {
        throw new Error(
          "At least one video URL is required."
        );
      }

      await updateDoc(
        doc(db, "episodes", episodeId),
        {
          season: getNumber("editEpSeason", 1),
          episode: getNumber("editEpNumber", 1),

          videoQualities: media.videoQualities,
          audioTracks: media.audioTracks,
          subtitles: media.subtitles,

          updatedAt: new Date().toISOString()
        }
      );

      setMessage(
        message,
        "Episode updated successfully!",
        "success"
      );

      setTimeout(() => {
        if (message) message.textContent = "";
      }, 3000);

    } catch (error) {
      console.error(
        "Episode update failed:",
        error
      );

      setMessage(
        message,
        `Error: ${error.message}`,
        "error"
      );
    }
  }
);

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
