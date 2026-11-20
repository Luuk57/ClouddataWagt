import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAO-0eNDaOxWhW9WfaZ2kaDyFyFQQdeRYo",
  authDomain: "cloudsysteem-wagt-2026.firebaseapp.com",
  projectId: "cloudsysteem-wagt-2026",
  storageBucket: "cloudsysteem-wagt-2026.firebasestorage.app",
  messagingSenderId: "454261505433",
  appId: "1:454261505433:web:931038fadf03daee236708"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Grote POS-iconenbibliotheek (32 items over 4 categorieën)
const FLUID_ICON_LIBRARY = [
  { id: "water_glass", name: "Glas water", glyph: "🥛", ml: 150, cat: "dranken" },
  { id: "water_bottle", name: "Flesje water", glyph: "🍾", ml: 250, cat: "dranken" },
  { id: "coffee_cup", name: "Kop koffie", glyph: "☕", ml: 125, cat: "dranken" },
  { id: "espresso", name: "Espresso", glyph: "🫘", ml: 40, cat: "dranken" },
  { id: "tea_cup", name: "Kop thee", glyph: "🍵", ml: 150, cat: "dranken" },
  { id: "green_tea", name: "Groene thee", glyph: "🍃", ml: 175, cat: "dranken" },
  { id: "orange_juice", name: "Sinaasappelsap", glyph: "🍊", ml: 150, cat: "dranken" },
  { id: "apple_juice", name: "Appelsap", glyph: "🍎", ml: 150, cat: "dranken" },
  { id: "lemon_water", name: "Citroenwater", glyph: "🍋", ml: 150, cat: "dranken" },
  { id: "cola_can", name: "Frisdrank", glyph: "🥤", ml: 200, cat: "dranken" },
  { id: "sparkling_water", name: "Spa rood", glyph: "🫧", ml: 200, cat: "dranken" },
  { id: "tonic", name: "Tonic / bitter", glyph: "🧊", ml: 150, cat: "dranken" },

  { id: "milk_glass", name: "Glas melk", glyph: "🥛", ml: 150, cat: "zuivel" },
  { id: "choco_milk", name: "Chocolademelk", glyph: "🍫", ml: 180, cat: "zuivel" },
  { id: "buttermilk", name: "Karnemelk", glyph: "🫙", ml: 150, cat: "zuivel" },
  { id: "yoghurt_bowl", name: "Schaaltje yoghurt", glyph: "🥣", ml: 150, cat: "zuivel" },
  { id: "protein_shake", name: "Shake / drinkvoeding", glyph: "🥤", ml: 200, cat: "zuivel" },
  { id: "custard", name: "Vla / pudding", glyph: "🍮", ml: 125, cat: "zuivel" },

  { id: "soup_bowl", name: "Kom soep", glyph: "🍲", ml: 200, cat: "voeding" },
  { id: "bouillon", name: "Bouillon", glyph: "🍜", ml: 150, cat: "voeding" },
  { id: "watermelon", name: "Watermeloen", glyph: "🍉", ml: 100, cat: "voeding" },
  { id: "grapes", name: "Druiven / fruit", glyph: "🍇", ml: 75, cat: "voeding" },
  { id: "ice_cream", name: "Waterijs / ijs", glyph: "🍨", ml: 80, cat: "voeding" },
  { id: "ice_cube", name: "IJsblokjes", glyph: "🧊", ml: 30, cat: "voeding" },
  { id: "porridge", name: "Pap / havermout", glyph: "🌾", ml: 180, cat: "voeding" },
  { id: "applesauce", name: "Appelmoes / compote", glyph: "🍏", ml: 100, cat: "voeding" },

  { id: "med_cup_30", name: "Medicijncupje 30ml", glyph: "💊", ml: 30, cat: "medisch" },
  { id: "med_cup_50", name: "Maatbeker 50ml", glyph: "🧪", ml: 50, cat: "medisch" },
  { id: "syringe_10", name: "Spuitje 10ml", glyph: "💉", ml: 10, cat: "medisch" },
  { id: "beaker_100", name: "Maatbeker 100ml", glyph: "📏", ml: 100, cat: "medisch" },
  { id: "ors_drink", name: "Electrolyten / ORS", glyph: "⚕️", ml: 150, cat: "medisch" },
  { id: "flush_20", name: "Spoeling 20ml", glyph: "💧", ml: 20, cat: "medisch" }
];

const PIN_STORAGE_KEY = "wagt_2026_pin_locked";
const DEFAULT_PIN = "1234";

// Pincode & Fullscreen DOM
const pinLockOverlay = document.getElementById("pinLockOverlay");
const pinDisplayInput = document.getElementById("pinDisplayInput");
const pinClearBtn = document.getElementById("pinClearBtn");
const pinUnlockBtn = document.getElementById("pinUnlockBtn");
const pinStatusMsg = document.getElementById("pinStatusMsg");
const lockScreenBtn = document.getElementById("lockScreenBtn");

const fullscreenTopBtn = document.getElementById("fullscreenTopBtn");
const fullscreenTaskBtn = document.getElementById("fullscreenTaskBtn");

// Schil & Beheer DOM
const topTitleText = document.getElementById("topTitleText");
const topConnStatus = document.getElementById("topConnStatus");
const loginSection = document.getElementById("loginSection");
const loginForm = document.getElementById("loginForm");
const loginStatusMsg = document.getElementById("loginStatusMsg");

const gateSection = document.getElementById("gateSection");
const gateTitle = document.getElementById("gateTitle");
const gateBadge = document.getElementById("gateBadge");
const gateMessage = document.getElementById("gateMessage");
const gateLogoutBtn = document.getElementById("gateLogoutBtn");

const shellSection = document.getElementById("shellSection");
const panelPosFluid = document.getElementById("panelPosFluid");
const panelAdmin = document.getElementById("panelAdmin");
const welcomeTitle = document.getElementById("welcomeTitle");
const roleBadge = document.getElementById("roleBadge");
const appBanner = document.getElementById("appBanner");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");

// POS Vochtintake & Regels DOM
const ruleAlertBox = document.getElementById("ruleAlertBox");
const label24h = document.getElementById("label24h");
const bar24h = document.getElementById("bar24h");
const label48h = document.getElementById("label48h");
const bar48h = document.getElementById("bar48h");

const iconCategorySelect = document.getElementById("iconCategorySelect");
const iconSearchInput = document.getElementById("iconSearchInput");
const iconLibraryGrid = document.getElementById("iconLibraryGrid");

const posFluidForm = document.getElementById("posFluidForm");
const posItemNameInput = document.getElementById("posItemNameInput");
const posMlInput = document.getElementById("posMlInput");
const fluidHistoryList = document.getElementById("fluidHistoryList");

const fluidRulesForm = document.getElementById("fluidRulesForm");
const ruleLimit24Input = document.getElementById("ruleLimit24Input");
const ruleLimit48Input = document.getElementById("ruleLimit48Input");
const ruleWarnPctInput = document.getElementById("ruleWarnPctInput");
const ruleMaxSingleInput = document.getElementById("ruleMaxSingleInput");
const ruleBlockOverInput = document.getElementById("ruleBlockOverInput");

// Admin DOM
const pendingUsersList = document.getElementById("pendingUsersList");
const allUsersList = document.getElementById("allUsersList");
const settingsForm = document.getElementById("settingsForm");
const systemTitleInput = document.getElementById("systemTitleInput");
const unlockPinInput = document.getElementById("unlockPinInput");
const maintenanceInput = document.getElementById("maintenanceInput");

// Taakbalk DOM
const taskPosBtn = document.getElementById("taskPosBtn");
const taskAdminBtn = document.getElementById("taskAdminBtn");
const taskClock = document.getElementById("taskClock");

let activeUser = null;
let activeIsAdmin = false;
let activeView = "pos";
let selectedIconId = FLUID_ICON_LIBRARY[0].id;
let configuredUnlockPin = DEFAULT_PIN;
let isPinLocked = localStorage.getItem(PIN_STORAGE_KEY) !== "false";

let latestFluidDocs = [];
let rulesConfig = {
  limit24hMl: 1000,
  limit48hMl: 2000,
  warnPct: 80,
  maxSingleMl: 500,
  blockOver48h: false
};

let unsubMe = null;
let unsubSettings = null;
let unsubFluidRules = null;
let unsubFluidIntake = null;
let unsubUsers = null;

function setStatus(text, isError = false) {
  statusMsg.textContent = text || "";
  statusMsg.classList.toggle("error-text", Boolean(isError));
}

function setLoginStatus(text) {
  loginStatusMsg.textContent = text || "";
}

// Volledig beeld
function syncFullscreenButtons() {
  const isFs = Boolean(document.fullscreenElement);
  const label = isFs ? "Sluit volledig beeld" : "Volledig beeld";
  fullscreenTopBtn.textContent = label;
  fullscreenTaskBtn.textContent = label;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    setStatus("Volledig beeld niet ondersteund: " + err.message, true);
  } finally {
    syncFullscreenButtons();
  }
}

fullscreenTopBtn.addEventListener("click", toggleFullscreen);
fullscreenTaskBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButtons);
syncFullscreenButtons();

// Volledig scherm pincode-vergrendeling
function applyPinLockState(locked) {
  isPinLocked = Boolean(locked);
  localStorage.setItem(PIN_STORAGE_KEY, isPinLocked ? "true" : "false");
  pinLockOverlay.classList.toggle("hidden", !isPinLocked);
  if (isPinLocked) {
    pinDisplayInput.value = "";
    pinStatusMsg.textContent = "";
    pinStatusMsg.classList.remove("error-text");
    setTimeout(() => pinDisplayInput.focus(), 50);
  }
}

applyPinLockState(isPinLocked);

window.addEventListener("beforeunload", (event) => {
  if (isPinLocked) {
    event.preventDefault();
    event.returnValue = "";
  }
});

document.querySelectorAll(".key-btn[data-digit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const digit = btn.getAttribute("data-digit") || "";
    if (pinDisplayInput.value.length < 10) {
      pinDisplayInput.value += digit;
    }
  });
});

pinClearBtn.addEventListener("click", () => {
  pinDisplayInput.value = "";
  pinStatusMsg.textContent = "";
});

function attemptPinUnlock() {
  const entered = pinDisplayInput.value.trim();
  const expected = configuredUnlockPin || DEFAULT_PIN;
  if (entered === expected) {
    applyPinLockState(false);
  } else {
    pinDisplayInput.value = "";
    pinStatusMsg.textContent = "Onjuiste pincode.";
    pinStatusMsg.classList.add("error-text");
  }
}

pinUnlockBtn.addEventListener("click", attemptPinUnlock);
pinDisplayInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    attemptPinUnlock();
  }
});

lockScreenBtn.addEventListener("click", () => applyPinLockState(true));

function cleanupListeners() {
  for (const fn of [
    unsubMe,
    unsubSettings,
    unsubFluidRules,
    unsubFluidIntake,
    unsubUsers
  ]) {
    if (typeof fn === "function") fn();
  }
  unsubMe = null;
  unsubSettings = null;
  unsubFluidRules = null;
  unsubFluidIntake = null;
  unsubUsers = null;
}

function updateClock() {
  const now = new Date();
  taskClock.textContent = now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
updateClock();
setInterval(updateClock, 30000);

function switchView(viewName) {
  if (viewName === "admin" && !activeIsAdmin) return;
  activeView = viewName;
  panelPosFluid.classList.toggle("hidden", viewName !== "pos");
  panelAdmin.classList.toggle("hidden", viewName !== "admin");
  taskPosBtn.classList.toggle("active", viewName === "pos");
  taskAdminBtn.classList.toggle("active", viewName === "admin");
}

taskPosBtn.addEventListener("click", () => switchView("pos"));
taskAdminBtn.addEventListener("click", () => switchView("admin"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.error("Service Worker fout:", err);
    }
  });
}

// Iconenbibliotheek renderen
function renderIconLibrary() {
  const selectedCat = iconCategorySelect.value;
  const searchTerm = (iconSearchInput.value || "").trim().toLowerCase();

  const filtered = FLUID_ICON_LIBRARY.filter((item) => {
    const matchesCat = selectedCat === "all" || item.cat === selectedCat;
    const matchesSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm) ||
      String(item.ml).includes(searchTerm);
    return matchesCat && matchesSearch;
  });

  iconLibraryGrid.innerHTML = "";
  if (filtered.length === 0) {
    iconLibraryGrid.innerHTML = `<div class="muted" style="grid-column: 1 / -1;">Geen iconen gevonden.</div>`;
    return;
  }

  for (const item of filtered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pos-icon-btn ${item.id === selectedIconId ? "selected" : ""}`;
    btn.innerHTML = `
      <span class="pos-glyph">${item.glyph}</span>
      <span class="pos-name">${item.name}</span>
      <span class="pos-default-ml">${item.ml} ml</span>
    `;
    btn.addEventListener("click", () => {
      selectedIconId = item.id;
      posItemNameInput.value = `${item.glyph} ${item.name}`;
      posMlInput.value = item.ml;
      renderIconLibrary();
    });
    iconLibraryGrid.appendChild(btn);
  }
}

iconCategorySelect.addEventListener("change", renderIconLibrary);
iconSearchInput.addEventListener("input", renderIconLibrary);
renderIconLibrary();

// +ml snelknoppen op de POS-bon
document.querySelectorAll("button[data-quick-ml]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const addMl = Number(btn.getAttribute("data-quick-ml")) || 0;
    const currentVal = Number(posMlInput.value) || 0;
    posMlInput.value = currentVal + addMl;
  });
});

function getBarColor(pct, warnPct) {
  if (pct > 100) return "#ef4444";
  if (pct >= warnPct) return "#f59e0b";
  return "#22c55e";
}

function updateProgressBar(labelEl, barEl, currentMl, goalMl, warnPct) {
  const safeGoal = Math.max(1, Number(goalMl) || 1000);
  const pct = Math.round((currentMl / safeGoal) * 100);
  const visualWidth = Math.min(100, Math.max(0, pct));

  labelEl.textContent = `${currentMl} / ${safeGoal} ml (${pct}%)`;
  barEl.style.width = `${visualWidth}%`;
  barEl.style.backgroundColor = getBarColor(pct, warnPct);
}

function computeTotals() {
  const nowMs = Date.now();
  const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
  const cutoff48h = nowMs - 48 * 60 * 60 * 1000;

  let sum24h = 0;
  let sum48h = 0;
  const recent48h = [];

  const sorted = [...latestFluidDocs].sort((a, b) => {
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });

  for (const item of sorted) {
    const createdMs = item.createdAt?.toMillis ? item.createdAt.toMillis() : nowMs;
    const ml = Number(item.amountMl) || 0;
    if (createdMs >= cutoff48h) {
      sum48h += ml;
      recent48h.push({ ...item, createdMs });
    }
    if (createdMs >= cutoff24h) {
      sum24h += ml;
    }
  }

  return { sum24h, sum48h, recent48h };
}

function renderFluidDashboard() {
  const { sum24h, sum48h, recent48h } = computeTotals();
  const warnPct = Number(rulesConfig.warnPct) || 80;
  const lim24 = Number(rulesConfig.limit24hMl) || 1000;
  const lim48 = Number(rulesConfig.limit48hMl) || 2000;

  updateProgressBar(label24h, bar24h, sum24h, lim24, warnPct);
  updateProgressBar(label48h, bar48h, sum48h, lim48, warnPct);

  const pct24 = Math.round((sum24h / Math.max(1, lim24)) * 100);
  const pct48 = Math.round((sum48h / Math.max(1, lim48)) * 100);

  ruleAlertBox.classList.remove("warn", "over");
  if (sum24h > lim24 || sum48h > lim48) {
    ruleAlertBox.classList.add("over");
    ruleAlertBox.textContent = `Regel overschreden: 24u ${sum24h}/${lim24} ml (${pct24}%) • 48u ${sum48h}/${lim48} ml (${pct48}%).`;
  } else if (pct24 >= warnPct || pct48 >= warnPct) {
    ruleAlertBox.classList.add("warn");
    ruleAlertBox.textContent = `Waarschuwingsgrens (${warnPct}%) bereikt: 24u ${pct24}% • 48u ${pct48}% (max per boeking: ${rulesConfig.maxSingleMl} ml).`;
  } else {
    ruleAlertBox.textContent = `Binnen vochtregels: 24u ${sum24h}/${lim24} ml (${pct24}%) • 48u ${sum48h}/${lim48} ml (${pct48}%) • Max boeking: ${rulesConfig.maxSingleMl} ml.`;
  }

  if (recent48h.length === 0) {
    fluidHistoryList.innerHTML = `<div class="muted">Nog geen POS-boekingen in de afgelopen 48 uur.</div>`;
    return;
  }

  fluidHistoryList.innerHTML = "";
  for (const entry of recent48h) {
    const dt = new Date(entry.createdMs).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    const row = document.createElement("div");
    row.className = "log-item";
    row.innerHTML = `
      <div>
        <strong>${entry.itemName || "Vocht"} — ${entry.amountMl} ml</strong>
        <div class="muted">${dt}</div>
      </div>
      <button type="button" class="danger small-inline">Wis</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "fluidIntake", entry.id));
        setStatus("POS-boeking verwijderd.");
      } catch (err) {
        setStatus("Verwijderen mislukt: " + err.message, true);
      }
    });

    fluidHistoryList.appendChild(row);
  }
}

// POS-boeking opslaan met regelcontrole
posFluidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeUser) return;

  const itemName = posItemNameInput.value.trim() || "Vocht";
  const amountMl = Number(posMlInput.value);
  const maxSingle = Number(rulesConfig.maxSingleMl) || 500;
  const lim48 = Number(rulesConfig.limit48hMl) || 2000;

  if (!amountMl || amountMl <= 0) {
    setStatus("Vul een geldige hoeveelheid in ml in.", true);
    return;
  }

  if (amountMl > maxSingle) {
    setStatus(`Regel: maximaal ${maxSingle} ml per enkele POS-boeking toegestaan.`, true);
    return;
  }

  const { sum48h } = computeTotals();
  if (rulesConfig.blockOver48h && sum48h + amountMl > lim48) {
    setStatus(`Regel actief: boeking geblokkeerd omdat 48u-limiet (${lim48} ml) overschreden zou worden.`, true);
    return;
  }

  try {
    await addDoc(collection(db, "fluidIntake"), {
      userId: activeUser.uid,
      email: activeUser.email || "",
      itemName,
      amountMl,
      createdAt: Timestamp.now()
    });
    posMlInput.value = "";
    setStatus(`Geboekt: ${itemName} (${amountMl} ml).`);
  } catch (err) {
    setStatus("Boeken mislukt: " + err.message, true);
  }
});

// Vochtregels opslaan onder users/{uid}/fluidRules/main
fluidRulesForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeUser) return;

  const nextRules = {
    limit24hMl: Math.max(50, Number(ruleLimit24Input.value) || 1000),
    limit48hMl: Math.max(50, Number(ruleLimit48Input.value) || 2000),
    warnPct: Math.min(100, Math.max(10, Number(ruleWarnPctInput.value) || 80)),
    maxSingleMl: Math.max(10, Number(ruleMaxSingleInput.value) || 500),
    blockOver48h: Boolean(ruleBlockOverInput.checked)
  };

  try {
    await setDoc(doc(db, "users", activeUser.uid, "fluidRules", "main"), nextRules, {
      merge: true
    });
    rulesConfig = nextRules;
    renderFluidDashboard();
    setStatus("Vochtregels opgeslagen.");
  } catch (err) {
    setStatus("Vochtregels opslaan mislukt: " + err.message, true);
  }
});

function syncRulesFormValues() {
  ruleLimit24Input.value = rulesConfig.limit24hMl;
  ruleLimit48Input.value = rulesConfig.limit48hMl;
  ruleWarnPctInput.value = rulesConfig.warnPct;
  ruleMaxSingleInput.value = rulesConfig.maxSingleMl;
  ruleBlockOverInput.checked = Boolean(rulesConfig.blockOver48h);
}

function subscribeFluidData(userId) {
  if (typeof unsubFluidRules === "function") unsubFluidRules();
  if (typeof unsubFluidIntake === "function") unsubFluidIntake();

  const ruleDocRef = doc(db, "users", userId, "fluidRules", "main");
  unsubFluidRules = onSnapshot(ruleDocRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      rulesConfig = {
        limit24hMl: Number(d.limit24hMl) || 1000,
        limit48hMl: Number(d.limit48hMl) || 2000,
        warnPct: Number(d.warnPct) || 80,
        maxSingleMl: Number(d.maxSingleMl) || 500,
        blockOver48h: Boolean(d.blockOver48h)
      };
    } else {
      syncRulesFormValues();
    }
    syncRulesFormValues();
    renderFluidDashboard();
  });

  const q = query(collection(db, "fluidIntake"), where("userId", "==", userId));
  unsubFluidIntake = onSnapshot(q, (snap) => {
    latestFluidDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFluidDashboard();
  });
}

// Beheerapp (accepteren, rol, rechten, blokkeren)
function createUserCard(userDoc, isPendingSection) {
  const uid = userDoc.id;
  const u = userDoc.data() || {};
  const role = u.role === "admin" ? "admin" : "user";
  const status = u.status || "active";
  const perms = u.permissions || {};

  const card = document.createElement("div");
  card.className = "user-card";
  card.innerHTML = `
    <div class="user-top">
      <div>
        <strong>${u.email || uid}</strong>
        <div class="muted" style="font-size:0.78rem;">UID: ${uid}</div>
      </div>
      <div class="user-badges">
        <span class="badge">${role.toUpperCase()}</span>
        <span class="badge ${status}">${status.toUpperCase()}</span>
      </div>
    </div>

    ${
      isPendingSection
        ? `<div class="row" style="margin-bottom:10px;">
             <button type="button" class="success" data-action="accept">Accepteren (User)</button>
             <button type="button" class="danger" data-action="block">Blokkeren</button>
           </div>`
        : ""
    }

    <div class="row">
      <div>
        <label>Rol</label>
        <select data-field="role">
          <option value="user" ${role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </div>
      <div>
        <label>Accountstatus</label>
        <select data-field="status">
          <option value="active" ${status === "active" ? "selected" : ""}>active (toegelaten)</option>
          <option value="pending" ${status === "pending" ? "selected" : ""}>pending (wacht)</option>
          <option value="blocked" ${status === "blocked" ? "selected" : ""}>blocked (geblokkeerd)</option>
        </select>
      </div>
    </div>

    <div class="checkbox-row">
      <input type="checkbox" id="perm_data_${uid}" data-perm="canViewData" ${perms.canViewData !== false ? "checked" : ""} />
      <label for="perm_data_${uid}">Recht: POS Vochtintake gebruiken</label>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="perm_rep_${uid}" data-perm="canViewReports" ${perms.canViewReports ? "checked" : ""} />
      <label for="perm_rep_${uid}">Recht: Overzichten bekijken</label>
    </div>

    <div class="row">
      <button type="button" data-action="save">Opslaan</button>
      ${
        status === "blocked"
          ? `<button type="button" class="success" data-action="unblock">Deblokkeren</button>`
          : `<button type="button" class="warning" data-action="block">Blokkeren</button>`
      }
    </div>
  `;

  const acceptBtn = card.querySelector('[data-action="accept"]');
  if (acceptBtn) {
    acceptBtn.addEventListener("click", async () => {
      await updateDoc(doc(db, "users", uid), { status: "active", role: "user" });
      setStatus(`Gebruiker ${u.email || uid} is geaccepteerd.`);
    });
  }

  card.querySelectorAll('[data-action="block"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "users", uid), { status: "blocked" });
      setStatus(`Gebruiker ${u.email || uid} is geblokkeerd.`);
    });
  });

  const unblockBtn = card.querySelector('[data-action="unblock"]');
  if (unblockBtn) {
    unblockBtn.addEventListener("click", async () => {
      await updateDoc(doc(db, "users", uid), { status: "active" });
      setStatus(`Gebruiker ${u.email || uid} is gedeblokkeerd.`);
    });
  }

  card.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const selectedRole = card.querySelector('select[data-field="role"]').value;
    const selectedStatus = card.querySelector('select[data-field="status"]').value;
    const canViewData = card.querySelector('input[data-perm="canViewData"]').checked;
    const canViewReports = card.querySelector('input[data-perm="canViewReports"]').checked;

    await updateDoc(doc(db, "users", uid), {
      role: selectedRole,
      status: selectedStatus,
      permissions: { canViewData, canViewReports }
    });
    setStatus(`Instellingen opgeslagen voor ${u.email || uid}.`);
  });

  return card;
}

function subscribeUsersAdmin() {
  if (typeof unsubUsers === "function") unsubUsers();

  unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
    pendingUsersList.innerHTML = "";
    allUsersList.innerHTML = "";
    let pendingCount = 0;

    snap.forEach((userDoc) => {
      const u = userDoc.data() || {};
      const status = u.status || "active";
      if (status === "pending") {
        pendingCount += 1;
        pendingUsersList.appendChild(createUserCard(userDoc, true));
      }
      allUsersList.appendChild(createUserCard(userDoc, false));
    });

    if (pendingCount === 0) {
      pendingUsersList.innerHTML = `<p class="muted">Geen openstaande aanvragen om te accepteren.</p>`;
    }
  });
}

function subscribeSettings() {
  if (typeof unsubSettings === "function") unsubSettings();

  unsubSettings = onSnapshot(doc(db, "settings", "app"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const title = data.systemTitle || "Cloudsysteem Wagt 2026";
    const maint = Boolean(data.maintenanceMode);
    configuredUnlockPin = data.unlockPin ? String(data.unlockPin) : DEFAULT_PIN;

    topTitleText.textContent = title;
    appBanner.textContent = maint
      ? `${title} — Onderhoudsmodus actief.`
      : `${title} — Online verbonden met Cloud Firestore.`;

    systemTitleInput.value = title;
    unlockPinInput.value = configuredUnlockPin;
    maintenanceInput.checked = maint;
  });
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPin = unlockPinInput.value.trim();
  if (!/^\d{4,10}$/.test(newPin)) {
    setStatus("Pincode moet uit 4 tot 10 cijfers bestaan.", true);
    return;
  }

  await setDoc(
    doc(db, "settings", "app"),
    {
      systemTitle: systemTitleInput.value.trim(),
      unlockPin: newPin,
      maintenanceMode: maintenanceInput.checked
    },
    { merge: true }
  );
  configuredUnlockPin = newPin;
  setStatus("Systeem- en pincode-instellingen opgeslagen.");
});

function showGate(mode, email) {
  shellSection.classList.add("hidden");
  loginSection.classList.add("hidden");
  gateSection.classList.remove("hidden");
  taskAdminBtn.classList.add("hidden");

  if (mode === "blocked") {
    gateTitle.textContent = "Account geblokkeerd";
    gateBadge.textContent = "GEBLOKKEERD";
    gateBadge.className = "badge blocked";
    gateMessage.textContent = `Het account ${email || ""} is geblokkeerd door een beheerder.`;
    topConnStatus.textContent = "Geblokkeerd";
  } else {
    gateTitle.textContent = "Wacht op acceptatie";
    gateBadge.textContent = "PENDING";
    gateBadge.className = "badge pending";
    gateMessage.textContent = `Het account ${email || ""} wacht nog op acceptatie door een beheerder.`;
    topConnStatus.textContent = "Wacht op goedkeuring";
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginStatus("Bezig met inloggen...");
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setLoginStatus("");
  } catch (err) {
    setLoginStatus("Inloggen mislukt: " + err.message);
  }
});

async function handleLogout() {
  cleanupListeners();
  await signOut(auth);
  setLoginStatus("Uitgelogd.");
}

logoutBtn.addEventListener("click", handleLogout);
gateLogoutBtn.addEventListener("click", handleLogout);

onAuthStateChanged(auth, (user) => {
  cleanupListeners();

  if (!user) {
    activeUser = null;
    activeIsAdmin = false;
    latestFluidDocs = [];
    topConnStatus.textContent = "Afgesloten";
    taskAdminBtn.classList.add("hidden");
    shellSection.classList.add("hidden");
    gateSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    return;
  }

  activeUser = user;
  subscribeSettings();
  subscribeFluidData(user.uid);

  const userRef = doc(db, "users", user.uid);
  unsubMe = onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email || "",
        role: "user",
        status: "pending",
        permissions: { canViewData: true, canViewReports: false }
      });
      return;
    }

    const profile = snap.data() || {};
    const status = profile.status || "active";
    const role = profile.role === "admin" ? "admin" : "user";
    const permissions = profile.permissions || {};

    if (status === "blocked") {
      activeIsAdmin = false;
      showGate("blocked", profile.email || user.email);
      return;
    }

    if (status === "pending") {
      activeIsAdmin = false;
      showGate("pending", profile.email || user.email);
      return;
    }

    activeIsAdmin = role === "admin";
    gateSection.classList.add("hidden");
    loginSection.classList.add("hidden");
    shellSection.classList.remove("hidden");

    welcomeTitle.textContent = `Sessie: ${profile.email || user.email || "gebruiker"}`;
    roleBadge.textContent = activeIsAdmin ? "ADMIN" : "USER";
    topConnStatus.textContent = `Aangemeld (${role})`;

    const canFluid = permissions.canViewData !== false || activeIsAdmin;
    taskPosBtn.classList.toggle("hidden", !canFluid);
    if (!canFluid) {
      panelPosFluid.classList.add("hidden");
    }

    if (activeIsAdmin) {
      taskAdminBtn.classList.remove("hidden");
      subscribeUsersAdmin();
    } else {
      taskAdminBtn.classList.add("hidden");
      panelAdmin.classList.add("hidden");
      if (activeView === "admin") switchView("pos");
    }

    switchView(canFluid ? activeView : "admin");
  });
});
