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

// DOM-elementen
const loginView = document.getElementById("loginView");
const shellView = document.getElementById("shellView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const globalToast = document.getElementById("globalToast");

const headerTitle = document.getElementById("headerTitle");
const loginBrandTitle = document.getElementById("loginBrandTitle");
const headerSub = document.getElementById("headerSub");
const headerRoleBadge = document.getElementById("headerRoleBadge");
const clockBadge = document.getElementById("clockBadge");
const welcomeHeading = document.getElementById("welcomeHeading");
const systemBannerText = document.getElementById("systemBannerText");

const kpi24h = document.getElementById("kpi24h");
const kpi48h = document.getElementById("kpi48h");
const permFluidStatus = document.getElementById("permFluidStatus");
const permReportsRow = document.getElementById("permReportsRow");

const navDashboardBtn = document.getElementById("navDashboardBtn");
const navFluidBtn = document.getElementById("navFluidBtn");
const navAdminBtn = document.getElementById("navAdminBtn");
const railLogoutBtn = document.getElementById("railLogoutBtn");

const tabDashboard = document.getElementById("tabDashboard");
const tabFluid = document.getElementById("tabFluid");
const tabAdmin = document.getElementById("tabAdmin");

const label24h = document.getElementById("label24h");
const bar24h = document.getElementById("bar24h");
const label48h = document.getElementById("label48h");
const bar48h = document.getElementById("bar48h");

const quickTilesGrid = document.getElementById("quickTilesGrid");
const quickTileForm = document.getElementById("quickTileForm");
const tileProductInput = document.getElementById("tileProductInput");
const tileMlInput = document.getElementById("tileMlInput");

const fluidForm = document.getElementById("fluidForm");
const fluidMlInput = document.getElementById("fluidMlInput");
const fluidNoteInput = document.getElementById("fluidNoteInput");
const fluidHistoryList = document.getElementById("fluidHistoryList");

const settingsForm = document.getElementById("settingsForm");
const systemTitleInput = document.getElementById("systemTitleInput");
const goal24hInput = document.getElementById("goal24hInput");
const goal48hInput = document.getElementById("goal48hInput");
const maintenanceInput = document.getElementById("maintenanceInput");
const usersList = document.getElementById("usersList");
const dbCollectionSelect = document.getElementById("dbCollectionSelect");
const dbExplorerList = document.getElementById("dbExplorerList");

let currentGoal24h = 1000;
let currentGoal48h = 2000;
let latestFluidDocs = [];
let activeUser = null;
let activeIsAdmin = false;
let activeTab = "dashboard";

let unsubUserProfile = null;
let unsubSettings = null;
let unsubFluid = null;
let unsubQuickTiles = null;
let unsubAllUsers = null;
let unsubExplorer = null;

function cleanupListeners() {
  for (const fn of [
    unsubUserProfile,
    unsubSettings,
    unsubFluid,
    unsubQuickTiles,
    unsubAllUsers,
    unsubExplorer
  ]) {
    if (typeof fn === "function") fn();
  }
  unsubUserProfile = null;
  unsubSettings = null;
  unsubFluid = null;
  unsubQuickTiles = null;
  unsubAllUsers = null;
  unsubExplorer = null;
}

function showToast(msg) {
  globalToast.textContent = msg || "";
}

function showLoginToast(msg) {
  loginStatus.textContent = msg || "";
}

function updateClock() {
  const now = new Date();
  clockBadge.textContent = now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
updateClock();
setInterval(updateClock, 30000);

function switchTab(tabName) {
  if (tabName === "admin" && !activeIsAdmin) return;
  activeTab = tabName;

  tabDashboard.classList.toggle("hidden", tabName !== "dashboard");
  tabFluid.classList.toggle("hidden", tabName !== "fluid");
  tabAdmin.classList.toggle("hidden", tabName !== "admin");

  navDashboardBtn.classList.toggle("active", tabName === "dashboard");
  navFluidBtn.classList.toggle("active", tabName === "fluid");
  navAdminBtn.classList.toggle("active", tabName === "admin");
}

navDashboardBtn.addEventListener("click", () => switchTab("dashboard"));
navFluidBtn.addEventListener("click", () => switchTab("fluid"));
navAdminBtn.addEventListener("click", () => switchTab("admin"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.error("Service Worker fout:", err);
    }
  });
}

function getBarColor(pct) {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#22c55e";
}

function updateProgressBar(labelEl, barEl, currentMl, goalMl) {
  const safeGoal = Math.max(1, Number(goalMl) || 1000);
  const pct = Math.round((currentMl / safeGoal) * 100);
  const visualWidth = Math.min(100, Math.max(0, pct));

  labelEl.textContent = `${currentMl} / ${safeGoal} ml (${pct}%)`;
  barEl.style.width = `${visualWidth}%`;
  barEl.style.backgroundColor = getBarColor(pct);
}

// Schrijf vochtinname weg naar Firestore voor de ingelogde gebruiker
async function logFluidAmount(amountMl, note = "") {
  if (!activeUser) return;
  const ml = Number(amountMl);
  if (!ml || ml <= 0) return;

  try {
    await addDoc(collection(db, "fluidIntake"), {
      userId: activeUser.uid,
      email: activeUser.email || "",
      amountMl: ml,
      note: (note || "").trim(),
      createdAt: Timestamp.now()
    });
    showToast(`${ml} ml${note ? ` (${note})` : ""} opgeslagen in jouw account.`);
  } catch (err) {
    showToast("Opslaan mislukt: " + err.message);
  }
}

// Live eigen snelkeuze tegels laden uit users/{uid}/quickTiles
function subscribeQuickTiles(userId) {
  if (typeof unsubQuickTiles === "function") unsubQuickTiles();

  const tilesCol = collection(db, "users", userId, "quickTiles");
  unsubQuickTiles = onSnapshot(tilesCol, (snap) => {
    const tiles = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    quickTilesGrid.innerHTML = "";
    if (tiles.length === 0) {
      quickTilesGrid.innerHTML = `<div class="item-sub">Nog geen eigen tegels. Maak er hieronder één aan!</div>`;
      return;
    }

    for (const tile of tiles) {
      const card = document.createElement("div");
      card.className = "quick-tile";
      card.innerHTML = `
        <button type="button" class="quick-tile-add">
          <span class="quick-tile-product">${tile.product || "Vocht"}</span>
          <span class="quick-tile-ml">${tile.amountMl} ml</span>
        </button>
        <button type="button" class="quick-tile-del">Verwijder</button>
      `;

      card.querySelector(".quick-tile-add").addEventListener("click", async () => {
        await logFluidAmount(tile.amountMl, tile.product || "");
      });

      card.querySelector(".quick-tile-del").addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "users", userId, "quickTiles", tile.id));
          showToast(`Tegel "${tile.product}" verwijderd.`);
        } catch (err) {
          showToast("Verwijderen mislukt: " + err.message);
        }
      });

      quickTilesGrid.appendChild(card);
    }
  });
}

// Nieuwe snelkeuze tegel opslaan onder users/{uid}/quickTiles
quickTileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeUser) return;

  const product = tileProductInput.value.trim();
  const amountMl = Number(tileMlInput.value);
  if (!product || !amountMl || amountMl <= 0) return;

  try {
    const tileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await setDoc(doc(db, "users", activeUser.uid, "quickTiles", tileId), {
      product,
      amountMl,
      createdAt: Date.now()
    });
    tileProductInput.value = "";
    tileMlInput.value = "";
    showToast(`Tegel "${product}" (${amountMl} ml) opgeslagen.`);
  } catch (err) {
    showToast("Tegel opslaan mislukt: " + err.message);
  }
});

function renderFluidCalculations() {
  const nowMs = Date.now();
  const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
  const cutoff48h = nowMs - 48 * 60 * 60 * 1000;

  const sortedDocs = [...latestFluidDocs].sort((a, b) => {
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });

  let sum24h = 0;
  let sum48h = 0;
  const recent48hItems = [];

  for (const item of sortedDocs) {
    const createdMs = item.createdAt?.toMillis ? item.createdAt.toMillis() : nowMs;
    const ml = Number(item.amountMl) || 0;

    if (createdMs >= cutoff48h) {
      sum48h += ml;
      recent48hItems.push({ ...item, createdMs });
    }
    if (createdMs >= cutoff24h) {
      sum24h += ml;
    }
  }

  kpi24h.textContent = `${sum24h} ml`;
  kpi48h.textContent = `${sum48h} ml`;

  updateProgressBar(label24h, bar24h, sum24h, currentGoal24h);
  updateProgressBar(label48h, bar48h, sum48h, currentGoal48h);

  if (recent48hItems.length === 0) {
    fluidHistoryList.innerHTML = `<div class="item-sub">Geen vochtinvoer in de afgelopen 48 uur.</div>`;
    return;
  }

  fluidHistoryList.innerHTML = "";
  for (const entry of recent48hItems) {
    const dt = new Date(entry.createdMs).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div>
        <strong>${entry.amountMl} ml</strong>${entry.note ? ` — ${entry.note}` : ""}
        <div class="item-sub">${dt}</div>
      </div>
      <button type="button" class="btn-danger">Verwijder</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "fluidIntake", entry.id));
        showToast("Vochtrecord verwijderd.");
      } catch (err) {
        showToast("Verwijderen mislukt: " + err.message);
      }
    });

    fluidHistoryList.appendChild(row);
  }
}

function subscribeFluidIntake(userId) {
  if (typeof unsubFluid === "function") unsubFluid();

  const q = query(collection(db, "fluidIntake"), where("userId", "==", userId));
  unsubFluid = onSnapshot(q, (snap) => {
    latestFluidDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFluidCalculations();
  });
}

fluidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amountMl = Number(fluidMlInput.value);
  const note = fluidNoteInput.value.trim();
  if (!amountMl || amountMl <= 0) return;

  await logFluidAmount(amountMl, note);
  fluidMlInput.value = "";
  fluidNoteInput.value = "";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoginToast("Bezig met aanmelden...");
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showLoginToast("");
  } catch (err) {
    showLoginToast("Aanmelden mislukt: " + err.message);
  }
});

railLogoutBtn.addEventListener("click", async () => {
  cleanupListeners();
  await signOut(auth);
  showLoginToast("Uitgelogd.");
});

function subscribeAppSettings() {
  if (typeof unsubSettings === "function") unsubSettings();

  unsubSettings = onSnapshot(doc(db, "settings", "app"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const title = data.systemTitle || "Cloudsysteem Wagt 2026";
    const maint = Boolean(data.maintenanceMode);
    currentGoal24h = Number(data.goal24hMl) || 1000;
    currentGoal48h = Number(data.goal48hMl) || 2000;

    headerTitle.textContent = title;
    loginBrandTitle.textContent = title;
    systemBannerText.textContent = maint
      ? `${title} — Onderhoudsmodus is actief.`
      : `${title} — Privé gesynct met Cloud Firestore.`;

    systemTitleInput.value = title;
    goal24hInput.value = currentGoal24h;
    goal48hInput.value = currentGoal48h;
    maintenanceInput.checked = maint;

    renderFluidCalculations();
  });
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await setDoc(
      doc(db, "settings", "app"),
      {
        systemTitle: systemTitleInput.value.trim(),
        goal24hMl: Number(goal24hInput.value) || 1000,
        goal48hMl: Number(goal48hInput.value) || 2000,
        maintenanceMode: maintenanceInput.checked
      },
      { merge: true }
    );
    showToast("Instellingen opgeslagen.");
  } catch (err) {
    showToast("Opslaan mislukt: " + err.message);
  }
});

function subscribeUsersForAdmin() {
  if (typeof unsubAllUsers === "function") unsubAllUsers();

  unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
    usersList.innerHTML = "";

    snap.forEach((userDoc) => {
      const u = userDoc.data();
      const uid = userDoc.id;
      const perms = u.permissions || {};

      const card = document.createElement("div");
      card.className = "user-card";
      card.innerHTML = `
        <div class="user-head">
          <strong>${u.email || uid}</strong>
          <span class="role-pill">${(u.role || "user").toUpperCase()}</span>
        </div>
        <label>Rol</label>
        <select data-field="role">
          <option value="user" ${u.role !== "admin" ? "selected" : ""}>user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
        <div class="checkbox-row">
          <input type="checkbox" id="perm_data_${uid}" data-perm="canViewData" ${perms.canViewData !== false ? "checked" : ""} />
          <label for="perm_data_${uid}">Recht: Vocht intake (24u / 48u)</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="perm_rep_${uid}" data-perm="canViewReports" ${perms.canViewReports ? "checked" : ""} />
          <label for="perm_rep_${uid}">Recht: Overzichten</label>
        </div>
        <button type="button" style="width: 100%;">Rechten opslaan</button>
      `;

      card.querySelector("button").addEventListener("click", async () => {
        const selectedRole = card.querySelector('select[data-field="role"]').value;
        const canViewData = card.querySelector('input[data-perm="canViewData"]').checked;
        const canViewReports = card.querySelector('input[data-perm="canViewReports"]').checked;

        try {
          await updateDoc(doc(db, "users", uid), {
            role: selectedRole,
            permissions: { canViewData, canViewReports }
          });
          showToast(`Rechten bijgewerkt voor ${u.email || uid}.`);
        } catch (err) {
          showToast("Rechten opslaan mislukt: " + err.message);
        }
      });

      usersList.appendChild(card);
    });
  });
}

function subscribeDbExplorer(colName, userId) {
  if (typeof unsubExplorer === "function") unsubExplorer();
  dbExplorerList.innerHTML = `<div class="item-sub">Records laden uit ${colName}...</div>`;

  const targetRef =
    colName === "fluidIntake"
      ? query(collection(db, "fluidIntake"), where("userId", "==", userId))
      : colName === "users"
      ? query(collection(db, "users"), where("__name__", "==", userId))
      : collection(db, colName);

  unsubExplorer = onSnapshot(targetRef, (snap) => {
    dbExplorerList.innerHTML = "";
    if (snap.empty) {
      dbExplorerList.innerHTML = `<div class="item-sub">Geen eigen documenten in "${colName}".</div>`;
      return;
    }

    snap.forEach((docSnap) => {
      const docId = docSnap.id;
      const raw = docSnap.data();
      const clean = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [
          k,
          v && typeof v.toDate === "function" ? v.toDate().toLocaleString("nl-NL") : v
        ])
      );

      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <div style="flex: 1; min-width: 220px;">
          <strong>ID: ${docId}</strong>
          <pre class="db-json">${JSON.stringify(clean, null, 2)}</pre>
        </div>
        ${colName === "fluidIntake" ? `<button type="button" class="btn-danger">Verwijder</button>` : ""}
      `;

      const delBtn = row.querySelector("button.btn-danger");
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          try {
            await deleteDoc(doc(db, "fluidIntake", docId));
            showToast(`Document ${docId} verwijderd.`);
          } catch (err) {
            showToast("Verwijderen mislukt: " + err.message);
          }
        });
      }

      dbExplorerList.appendChild(row);
    });
  });
}

dbCollectionSelect.addEventListener("change", () => {
  if (activeIsAdmin && activeUser) {
    subscribeDbExplorer(dbCollectionSelect.value, activeUser.uid);
  }
});

function subscribeUserShell(user) {
  activeUser = user;
  const userRef = doc(db, "users", user.uid);
  subscribeAppSettings();

  if (typeof unsubUserProfile === "function") unsubUserProfile();
  unsubUserProfile = onSnapshot(userRef, async (userSnap) => {
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email || "",
        role: "user",
        permissions: { canViewData: true, canViewReports: false }
      });
      return;
    }

    const profile = userSnap.data() || {};
    const role = profile.role || "user";
    const permissions = profile.permissions || {};
    activeIsAdmin = role === "admin";

    welcomeHeading.textContent = `Welkom, ${profile.email || user.email || "gebruiker"}`;
    headerRoleBadge.textContent = activeIsAdmin ? "ADMIN" : "GEBRUIKER";
    headerSub.textContent = `Privé sessie • ${profile.email || ""}`;

    const canFluid = permissions.canViewData !== false || activeIsAdmin;
    const canReports = Boolean(permissions.canViewReports) || activeIsAdmin;

    navFluidBtn.classList.toggle("hidden", !canFluid);
    permFluidStatus.textContent = canFluid ? "Actief" : "Geen recht";
    permReportsRow.classList.toggle("hidden", !canReports);

    if (canFluid) {
      subscribeFluidIntake(user.uid);
      subscribeQuickTiles(user.uid);
    } else {
      if (typeof unsubFluid === "function") unsubFluid();
      if (typeof unsubQuickTiles === "function") unsubQuickTiles();
      unsubFluid = null;
      unsubQuickTiles = null;
    }

    if (activeIsAdmin) {
      navAdminBtn.classList.remove("hidden");
      subscribeUsersForAdmin();
      subscribeDbExplorer(dbCollectionSelect.value, user.uid);
    } else {
      navAdminBtn.classList.add("hidden");
      if (activeTab === "admin") switchTab("dashboard");
      if (typeof unsubAllUsers === "function") unsubAllUsers();
      if (typeof unsubExplorer === "function") unsubExplorer();
    }

    loginView.classList.add("hidden");
    shellView.classList.remove("hidden");
    switchTab(activeTab);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cleanupListeners();
    activeUser = null;
    activeIsAdmin = false;
    latestFluidDocs = [];
    shellView.classList.add("hidden");
    loginView.classList.remove("hidden");
    return;
  }
  subscribeUserShell(user);
});
