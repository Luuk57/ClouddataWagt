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
const serverTitleText = document.getElementById("serverTitleText");
const liveDbBadge = document.getElementById("liveDbBadge");
const dbStatsText = document.getElementById("dbStatsText");
const serverConnStatus = document.getElementById("serverConnStatus");
const loginStatusMsg = document.getElementById("loginStatusMsg");
const statusMsg = document.getElementById("statusMsg");
const loginSection = document.getElementById("loginSection");
const shellSection = document.getElementById("shellSection");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeTitle = document.getElementById("welcomeTitle");
const roleBadge = document.getElementById("roleBadge");
const appBanner = document.getElementById("appBanner");

const moduleFluid = document.getElementById("moduleFluid");
const moduleReports = document.getElementById("moduleReports");
const noModulesMsg = document.getElementById("noModulesMsg");

const label24h = document.getElementById("label24h");
const bar24h = document.getElementById("bar24h");
const label48h = document.getElementById("label48h");
const bar48h = document.getElementById("bar48h");
const fluidForm = document.getElementById("fluidForm");
const fluidMlInput = document.getElementById("fluidMlInput");
const fluidNoteInput = document.getElementById("fluidNoteInput");
const fluidHistoryList = document.getElementById("fluidHistoryList");

const adminSection = document.getElementById("adminSection");
const settingsForm = document.getElementById("settingsForm");
const systemTitleInput = document.getElementById("systemTitleInput");
const goal24hInput = document.getElementById("goal24hInput");
const goal48hInput = document.getElementById("goal48hInput");
const maintenanceInput = document.getElementById("maintenanceInput");
const usersList = document.getElementById("usersList");

const dbCollectionSelect = document.getElementById("dbCollectionSelect");
const dbExplorerList = document.getElementById("dbExplorerList");

const focusTopBtn = document.getElementById("focusTopBtn");
const focusFluidBtn = document.getElementById("focusFluidBtn");
const focusAdminBtn = document.getElementById("focusAdminBtn");
const taskbarClock = document.getElementById("taskbarClock");

let currentGoal24h = 1000;
let currentGoal48h = 2000;
let latestFluidDocs = [];
let activeUser = null;
let activeIsAdmin = false;

// Actieve realtime Firestore-listeners opslaan om bij uitloggen netjes op te ruimen
let unsubUserProfile = null;
let unsubSettings = null;
let unsubFluid = null;
let unsubAllUsers = null;
let unsubExplorer = null;

function cleanupListeners() {
  for (const fn of [
    unsubUserProfile,
    unsubSettings,
    unsubFluid,
    unsubAllUsers,
    unsubExplorer
  ]) {
    if (typeof fn === "function") fn();
  }
  unsubUserProfile = null;
  unsubSettings = null;
  unsubFluid = null;
  unsubAllUsers = null;
  unsubExplorer = null;
}

function setStatus(text) {
  statusMsg.textContent = text || "";
}

function setLoginStatus(text) {
  loginStatusMsg.textContent = text || "";
}

function updateClock() {
  const now = new Date();
  taskbarClock.textContent = now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
updateClock();
setInterval(updateClock, 30000);

focusTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
focusFluidBtn.addEventListener("click", () => {
  moduleFluid.scrollIntoView({ behavior: "smooth", block: "start" });
});
focusAdminBtn.addEventListener("click", () => {
  adminSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

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

// Bereken 24u en 48u totalen + lijst op basis van actuele records en doelen
function renderFluidCalculations(userId) {
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

  updateProgressBar(label24h, bar24h, sum24h, currentGoal24h);
  updateProgressBar(label48h, bar48h, sum48h, currentGoal48h);
  dbStatsText.textContent = `24u: ${sum24h} ml | 48u: ${sum48h} ml`;

  if (recent48hItems.length === 0) {
    fluidHistoryList.innerHTML = `<p class="muted">Geen vochtrecords in de afgelopen 48 uur.</p>`;
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
    row.className = "log-item";
    row.innerHTML = `
      <div>
        <strong>${entry.amountMl} ml</strong>${entry.note ? ` — ${entry.note}` : ""}
        <div class="muted">${dt}</div>
      </div>
      <button type="button" class="danger">Verwijder</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "fluidIntake", entry.id));
        setStatus("Record verwijderd uit database.");
      } catch (err) {
        setStatus("Verwijderen mislukt: " + err.message);
      }
    });

    fluidHistoryList.appendChild(row);
  }
}

// Live luisteren naar vochtrecords van de ingelogde gebruiker
function subscribeFluidIntake(userId) {
  if (typeof unsubFluid === "function") unsubFluid();

  const q = query(collection(db, "fluidIntake"), where("userId", "==", userId));
  unsubFluid = onSnapshot(
    q,
    (snap) => {
      latestFluidDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderFluidCalculations(userId);
    },
    (err) => {
      setStatus("Live vocht-listener fout: " + err.message);
    }
  );
}

// Nieuw vochtrecord wegschrijven naar Firestore
fluidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeUser) return;

  const amountMl = Number(fluidMlInput.value);
  const note = fluidNoteInput.value.trim();

  if (!amountMl || amountMl <= 0) {
    setStatus("Vul een geldige hoeveelheid in ml in.");
    return;
  }

  setStatus("Record wegschrijven naar database...");
  try {
    await addDoc(collection(db, "fluidIntake"), {
      userId: activeUser.uid,
      email: activeUser.email || "",
      amountMl,
      note,
      createdAt: Timestamp.now()
    });
    fluidMlInput.value = "";
    fluidNoteInput.value = "";
    setStatus("Record opgeslagen in Firestore.");
  } catch (err) {
    setStatus("Opslaan mislukt: " + err.message);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginStatus("Bezig met aanmelden...");

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setLoginStatus("");
  } catch (err) {
    setLoginStatus("Aanmelden mislukt: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  cleanupListeners();
  await signOut(auth);
  setLoginStatus("Afgemeld.");
});

// Live luisteren naar settings/app
function subscribeAppSettings() {
  if (typeof unsubSettings === "function") unsubSettings();

  unsubSettings = onSnapshot(doc(db, "settings", "app"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const title = data.systemTitle || "Cloudsysteem Wagt 2026";
    const maint = Boolean(data.maintenanceMode);
    currentGoal24h = Number(data.goal24hMl) || 1000;
    currentGoal48h = Number(data.goal48hMl) || 2000;

    serverTitleText.textContent = title;
    appBanner.textContent = maint
      ? `${title} — Onderhoudsmodus actief (Live DB).`
      : `${title} — Live verbonden met Cloud Firestore.`;

    systemTitleInput.value = title;
    goal24hInput.value = currentGoal24h;
    goal48hInput.value = currentGoal48h;
    maintenanceInput.checked = maint;

    if (activeUser && !moduleFluid.classList.contains("hidden")) {
      renderFluidCalculations(activeUser.uid);
    }
  });
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Serverinstellingen opslaan in database...");

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
    setStatus("Serverinstellingen live bijgewerkt.");
  } catch (err) {
    setStatus("Opslaan mislukt: " + err.message);
  }
});

// Live gebruikersbeheer voor admin
function subscribeUsersForAdmin() {
  if (typeof unsubAllUsers === "function") unsubAllUsers();

  unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
    usersList.innerHTML = "";

    snap.forEach((userDoc) => {
      const u = userDoc.data();
      const uid = userDoc.id;
      const perms = u.permissions || {};

      const wrapper = document.createElement("div");
      wrapper.className = "user-item";
      wrapper.innerHTML = `
        <div><strong>${u.email || uid}</strong> <span class="badge">${(u.role || "user").toUpperCase()}</span></div>
        <div style="margin-top: 8px;">
          <label>Rol</label>
          <select data-field="role">
            <option value="user" ${u.role !== "admin" ? "selected" : ""}>user</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="perm_data_${uid}" data-perm="canViewData" ${perms.canViewData !== false ? "checked" : ""} />
          <label for="perm_data_${uid}">Recht: Vocht intake &amp; data</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="perm_rep_${uid}" data-perm="canViewReports" ${perms.canViewReports ? "checked" : ""} />
          <label for="perm_rep_${uid}">Recht: Overzichten bekijken</label>
        </div>
        <button type="button">Rechten opslaan</button>
      `;

      wrapper.querySelector("button").addEventListener("click", async () => {
        const selectedRole = wrapper.querySelector('select[data-field="role"]').value;
        const canViewData = wrapper.querySelector('input[data-perm="canViewData"]').checked;
        const canViewReports = wrapper.querySelector('input[data-perm="canViewReports"]').checked;

        try {
          await updateDoc(doc(db, "users", uid), {
            role: selectedRole,
            permissions: {
              canViewData,
              canViewReports
            }
          });
          setStatus(`Rechten bijgewerkt voor ${u.email || uid}.`);
        } catch (err) {
          setStatus("Rechten opslaan mislukt: " + err.message);
        }
      });

      usersList.appendChild(wrapper);
    });
  });
}

// Live Database Explorer voor admin (bekijken en verwijderen van records)
function subscribeDbExplorer(colName) {
  if (typeof unsubExplorer === "function") unsubExplorer();
  dbExplorerList.innerHTML = `<p class="muted">Records laden uit ${colName}...</p>`;

  unsubExplorer = onSnapshot(collection(db, colName), (snap) => {
    dbExplorerList.innerHTML = "";

    if (snap.empty) {
      dbExplorerList.innerHTML = `<p class="muted">Geen records in collectie "${colName}".</p>`;
      return;
    }

    snap.forEach((docSnap) => {
      const docId = docSnap.id;
      const rawData = docSnap.data();
      const formatted = Object.fromEntries(
        Object.entries(rawData).map(([k, v]) => [
          k,
          v && typeof v.toDate === "function" ? v.toDate().toLocaleString("nl-NL") : v
        ])
      );

      const item = document.createElement("div");
      item.className = "db-record";
      item.innerHTML = `
        <div style="flex: 1; min-width: 200px;">
          <strong>ID: ${docId}</strong>
          <pre class="json-box">${JSON.stringify(formatted, null, 2)}</pre>
        </div>
        <div class="btn-group">
          <button type="button" class="danger">Verwijder</button>
        </div>
      `;

      item.querySelector("button").addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, colName, docId));
          setStatus(`Document ${docId} verwijderd uit ${colName}.`);
        } catch (err) {
          setStatus("Verwijderen mislukt: " + err.message);
        }
      });

      dbExplorerList.appendChild(item);
    });
  });
}

dbCollectionSelect.addEventListener("change", () => {
  if (activeIsAdmin) {
    subscribeDbExplorer(dbCollectionSelect.value);
  }
});

// Live luisteren naar eigen gebruikersprofiel & rechten
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
        permissions: {
          canViewData: true,
          canViewReports: false
        }
      });
      return;
    }

    const profile = userSnap.data() || {};
    const role = profile.role || "user";
    const permissions = profile.permissions || {};
    activeIsAdmin = role === "admin";

    welcomeTitle.textContent = `Sessie: ${profile.email || user.email || "gebruiker"}`;
    roleBadge.textContent = activeIsAdmin ? "ADMIN" : "GEBRUIKER";
    serverConnStatus.textContent = `Online (${role})`;
    liveDbBadge.classList.remove("hidden");

    const showFluid = permissions.canViewData !== false || activeIsAdmin;
    const showReports = Boolean(permissions.canViewReports) || activeIsAdmin;

    moduleFluid.classList.toggle("hidden", !showFluid);
    focusFluidBtn.classList.toggle("hidden", !showFluid);
    moduleReports.classList.toggle("hidden", !showReports);
    noModulesMsg.classList.toggle("hidden", showFluid || showReports);

    if (showFluid) {
      subscribeFluidIntake(user.uid);
    } else if (typeof unsubFluid === "function") {
      unsubFluid();
      unsubFluid = null;
    }

    if (activeIsAdmin) {
      adminSection.classList.remove("hidden");
      focusAdminBtn.classList.remove("hidden");
      subscribeUsersForAdmin();
      subscribeDbExplorer(dbCollectionSelect.value);
    } else {
      adminSection.classList.add("hidden");
      focusAdminBtn.classList.add("hidden");
      if (typeof unsubAllUsers === "function") unsubAllUsers();
      if (typeof unsubExplorer === "function") unsubExplorer();
    }

    loginSection.classList.add("hidden");
    shellSection.classList.remove("hidden");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cleanupListeners();
    activeUser = null;
    activeIsAdmin = false;
    latestFluidDocs = [];
    liveDbBadge.classList.add("hidden");
    serverConnStatus.textContent = "Afgesloten";
    dbStatsText.textContent = "Firestore: cloudsysteem-wagt-2026";
    focusAdminBtn.classList.add("hidden");
    shellSection.classList.add("hidden");
    adminSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    return;
  }

  setStatus("Verbinding maken met live database...");
  subscribeUserShell(user);
  setStatus("");
});
