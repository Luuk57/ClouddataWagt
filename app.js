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
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuratie voor Cloudsysteem Wagt 2026
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

let currentGoal24h = 1000;
let currentGoal48h = 2000;
let activeUser = null;
let activeIsAdmin = false;

function setStatus(text) {
  statusMsg.textContent = text || "";
}

// PWA Service Worker registreren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.error("Service Worker fout:", err);
    }
  });
}

// Kleur bepalen voor progress bar op basis van percentage
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

// Vocht-invoer van de afgelopen 48 uur laden en berekenen voor 24u en 48u
async function loadFluidIntake(userId) {
  fluidHistoryList.innerHTML = "Vochtgegevens laden...";

  const nowMs = Date.now();
  const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
  const cutoff48h = nowMs - 48 * 60 * 60 * 1000;

  const q = query(
    collection(db, "fluidIntake"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  let docsList = [];
  try {
    const snap = await getDocs(q);
    docsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback als er nog geen samengestelde index is aangemaakt in Firestore
    const fallbackSnap = await getDocs(
      query(collection(db, "fluidIntake"), where("userId", "==", userId))
    );
    docsList = fallbackSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bMs - aMs;
      });
  }

  let sum24h = 0;
  let sum48h = 0;
  const recent48hItems = [];

  for (const item of docsList) {
    const createdMs = item.createdAt?.toMillis
      ? item.createdAt.toMillis()
      : nowMs;
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

  if (recent48hItems.length === 0) {
    fluidHistoryList.innerHTML = `<p class="muted">Geen vochtinvoer in de afgelopen 48 uur.</p>`;
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
      <button type="button" class="danger" data-del-id="${entry.id}">Verwijder</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "fluidIntake", entry.id));
        setStatus("Invoer verwijderd.");
        await loadFluidIntake(userId);
      } catch (err) {
        setStatus("Verwijderen mislukt: " + err.message);
      }
    });

    fluidHistoryList.appendChild(row);
  }
}

// Nieuwe vochtinvoer opslaan
fluidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeUser) return;

  const amountMl = Number(fluidMlInput.value);
  const note = fluidNoteInput.value.trim();

  if (!amountMl || amountMl <= 0) {
    setStatus("Vul een geldige hoeveelheid in ml in.");
    return;
  }

  setStatus("Vocht opslaan...");
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
    setStatus("Vocht opgeslagen.");
    await loadFluidIntake(activeUser.uid);
  } catch (err) {
    setStatus("Opslaan mislukt: " + err.message);
  }
});

// Inloggen
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Bezig met inloggen...");

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setStatus("");
  } catch (err) {
    setStatus("Inloggen mislukt: " + err.message);
  }
});

// Uitloggen
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  setStatus("Uitgelogd.");
});

// Globale systeeminstellingen & vochtdoelen laden uit settings/app
async function loadAppSettings() {
  const settingsRef = doc(db, "settings", "app");
  const snap = await getDoc(settingsRef);

  if (snap.exists()) {
    const data = snap.data();
    const title = data.systemTitle || "Cloudsysteem Wagt 2026";
    const maint = Boolean(data.maintenanceMode);
    currentGoal24h = Number(data.goal24hMl) || 1000;
    currentGoal48h = Number(data.goal48hMl) || 2000;

    appBanner.textContent = maint
      ? `${title} — Onderhoudsmodus is actief.`
      : `${title} — Actief verbonden met Firebase.`;

    systemTitleInput.value = title;
    goal24hInput.value = currentGoal24h;
    goal48hInput.value = currentGoal48h;
    maintenanceInput.checked = maint;
  } else {
    currentGoal24h = 1000;
    currentGoal48h = 2000;
    systemTitleInput.value = "Cloudsysteem Wagt 2026";
    goal24hInput.value = currentGoal24h;
    goal48hInput.value = currentGoal48h;
    maintenanceInput.checked = false;
  }
}

// Instellingen & vochtdoelen opslaan als admin
settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Instellingen opslaan...");

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
    await loadAppSettings();
    if (activeUser && !moduleFluid.classList.contains("hidden")) {
      await loadFluidIntake(activeUser.uid);
    }
    setStatus("Instellingen opgeslagen in Firestore.");
  } catch (err) {
    setStatus("Opslaan mislukt: " + err.message);
  }
});

// Gebruikers en rechten laden voor admin
async function loadUsersForAdmin(currentUid) {
  usersList.innerHTML = "Gebruikers laden...";
  const snap = await getDocs(collection(db, "users"));
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
      <button type="button" data-save-uid="${uid}">Rechten opslaan</button>
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
        if (uid === currentUid) {
          await renderUserShell(auth.currentUser);
        }
      } catch (err) {
        setStatus("Rechten opslaan mislukt: " + err.message);
      }
    });

    usersList.appendChild(wrapper);
  });
}

// Schil opbouwen op basis van ingelogde gebruiker + Firestore-profiel
async function renderUserShell(user) {
  activeUser = user;
  const userRef = doc(db, "users", user.uid);
  let userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email || "",
      role: "user",
      permissions: {
        canViewData: true,
        canViewReports: false
      }
    });
    userSnap = await getDoc(userRef);
  }

  const profile = userSnap.data() || {};
  const role = profile.role || "user";
  const permissions = profile.permissions || {};
  activeIsAdmin = role === "admin";

  welcomeTitle.textContent = `Welkom, ${profile.email || user.email || "gebruiker"}`;
  roleBadge.textContent = activeIsAdmin ? "ADMIN" : "GEBRUIKER";

  const showFluid = permissions.canViewData !== false || activeIsAdmin;
  const showReports = Boolean(permissions.canViewReports) || activeIsAdmin;

  moduleFluid.classList.toggle("hidden", !showFluid);
  moduleReports.classList.toggle("hidden", !showReports);
  noModulesMsg.classList.toggle("hidden", showFluid || showReports);

  await loadAppSettings();

  if (showFluid) {
    await loadFluidIntake(user.uid);
  }

  if (activeIsAdmin) {
    adminSection.classList.remove("hidden");
    await loadUsersForAdmin(user.uid);
  } else {
    adminSection.classList.add("hidden");
  }

  loginSection.classList.add("hidden");
  shellSection.classList.remove("hidden");
}

// Auth-status volgen
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    activeUser = null;
    activeIsAdmin = false;
    shellSection.classList.add("hidden");
    adminSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    return;
  }

  setStatus("Profiel en vochtgegevens laden...");
  try {
    await renderUserShell(user);
    setStatus("");
  } catch (err) {
    setStatus("Fout bij laden van profiel: " + err.message);
  }
});
