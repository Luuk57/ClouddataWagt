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
  updateDoc,
  collection,
  onSnapshot
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

const PIN_STORAGE_KEY = "wagt_2026_pin_locked";
const DEFAULT_PIN = "1234";

// DOM-elementen voor volledige pincode-vergrendeling
const pinLockOverlay = document.getElementById("pinLockOverlay");
const pinDisplayInput = document.getElementById("pinDisplayInput");
const pinClearBtn = document.getElementById("pinClearBtn");
const pinUnlockBtn = document.getElementById("pinUnlockBtn");
const pinStatusMsg = document.getElementById("pinStatusMsg");
const lockScreenBtn = document.getElementById("lockScreenBtn");

// DOM-elementen voor schil & beheer
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
const panelShell = document.getElementById("panelShell");
const panelAdmin = document.getElementById("panelAdmin");
const welcomeTitle = document.getElementById("welcomeTitle");
const roleBadge = document.getElementById("roleBadge");
const appBanner = document.getElementById("appBanner");
const statusMsg = document.getElementById("statusMsg");
const logoutBtn = document.getElementById("logoutBtn");
const myPermissionsBox = document.getElementById("myPermissionsBox");

const pendingUsersList = document.getElementById("pendingUsersList");
const allUsersList = document.getElementById("allUsersList");
const settingsForm = document.getElementById("settingsForm");
const systemTitleInput = document.getElementById("systemTitleInput");
const unlockPinInput = document.getElementById("unlockPinInput");
const maintenanceInput = document.getElementById("maintenanceInput");

const taskShellBtn = document.getElementById("taskShellBtn");
const taskAdminBtn = document.getElementById("taskAdminBtn");
const taskClock = document.getElementById("taskClock");

let activeUser = null;
let activeIsAdmin = false;
let activeView = "shell";
let configuredUnlockPin = DEFAULT_PIN;
let isPinLocked = localStorage.getItem(PIN_STORAGE_KEY) !== "false";

let unsubMe = null;
let unsubSettings = null;
let unsubUsers = null;

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

// Direct bij laden vergrendelstand toepassen (blijft aan bij refresh)
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

lockScreenBtn.addEventListener("click", () => {
  applyPinLockState(true);
});

function cleanupListeners() {
  for (const fn of [unsubMe, unsubSettings, unsubUsers]) {
    if (typeof fn === "function") fn();
  }
  unsubMe = null;
  unsubSettings = null;
  unsubUsers = null;
}

function setStatus(text) {
  statusMsg.textContent = text || "";
}

function setLoginStatus(text) {
  loginStatusMsg.textContent = text || "";
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
  panelShell.classList.toggle("hidden", viewName !== "shell");
  panelAdmin.classList.toggle("hidden", viewName !== "admin");
  taskShellBtn.classList.toggle("active", viewName === "shell");
  taskAdminBtn.classList.toggle("active", viewName === "admin");
}

taskShellBtn.addEventListener("click", () => switchView("shell"));
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

function renderMyPermissions(perms, isAdmin) {
  const items = [
    { label: "Toegang tot schil", allowed: true },
    { label: "Gegevens bekijken & invoeren", allowed: isAdmin || Boolean(perms.canViewData) },
    { label: "Overzichten bekijken", allowed: isAdmin || Boolean(perms.canViewReports) },
    { label: "Beheerapp & gebruikersbeheer", allowed: isAdmin }
  ];

  myPermissionsBox.innerHTML = items
    .map(
      (it) =>
        `<div>${it.allowed ? "✓" : "✕"} <strong>${it.label}</strong> — ${
          it.allowed ? "Toegestaan" : "Geen recht"
        }</div>`
    )
    .join("");
}

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
      <input type="checkbox" id="perm_data_${uid}" data-perm="canViewData" ${perms.canViewData ? "checked" : ""} />
      <label for="perm_data_${uid}">Recht: Gegevens bekijken &amp; invoeren</label>
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
      try {
        await updateDoc(doc(db, "users", uid), {
          status: "active",
          role: "user"
        });
        setStatus(`Gebruiker ${u.email || uid} is geaccepteerd.`);
      } catch (err) {
        setStatus("Accepteren mislukt: " + err.message);
      }
    });
  }

  const blockButtons = card.querySelectorAll('[data-action="block"]');
  blockButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "users", uid), {
          status: "blocked"
        });
        setStatus(`Gebruiker ${u.email || uid} is geblokkeerd.`);
      } catch (err) {
        setStatus("Blokkeren mislukt: " + err.message);
      }
    });
  });

  const unblockBtn = card.querySelector('[data-action="unblock"]');
  if (unblockBtn) {
    unblockBtn.addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "users", uid), {
          status: "active"
        });
        setStatus(`Gebruiker ${u.email || uid} is gedeblokkeerd.`);
      } catch (err) {
        setStatus("Deblokkeren mislukt: " + err.message);
      }
    });
  }

  const saveBtn = card.querySelector('[data-action="save"]');
  saveBtn.addEventListener("click", async () => {
    const selectedRole = card.querySelector('select[data-field="role"]').value;
    const selectedStatus = card.querySelector('select[data-field="status"]').value;
    const canViewData = card.querySelector('input[data-perm="canViewData"]').checked;
    const canViewReports = card.querySelector('input[data-perm="canViewReports"]').checked;

    try {
      await updateDoc(doc(db, "users", uid), {
        role: selectedRole,
        status: selectedStatus,
        permissions: {
          canViewData,
          canViewReports
        }
      });
      setStatus(`Instellingen opgeslagen voor ${u.email || uid}.`);
    } catch (err) {
      setStatus("Opslaan mislukt: " + err.message);
    }
  });

  return card;
}

function subscribeUsersAdmin() {
  if (typeof unsubUsers === "function") unsubUsers();

  unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
    pendingUsersList.innerHTML = "";
    allUsersList.innerHTML = "";

    let pendingCount = 0;
    let totalCount = 0;

    snap.forEach((userDoc) => {
      totalCount += 1;
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
    if (totalCount === 0) {
      allUsersList.innerHTML = `<p class="muted">Geen gebruikers gevonden.</p>`;
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
    setStatus("Pincode moet uit 4 tot 10 cijfers bestaan.");
    return;
  }

  try {
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
  } catch (err) {
    setStatus("Opslaan mislukt: " + err.message);
  }
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
    topConnStatus.textContent = "Afgesloten";
    taskAdminBtn.classList.add("hidden");
    shellSection.classList.add("hidden");
    gateSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    return;
  }

  activeUser = user;
  subscribeSettings();

  const userRef = doc(db, "users", user.uid);
  unsubMe = onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email || "",
        role: "user",
        status: "pending",
        permissions: {
          canViewData: false,
          canViewReports: false
        }
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

    renderMyPermissions(permissions, activeIsAdmin);

    if (activeIsAdmin) {
      taskAdminBtn.classList.remove("hidden");
      subscribeUsersAdmin();
    } else {
      taskAdminBtn.classList.add("hidden");
      panelAdmin.classList.add("hidden");
      if (activeView === "admin") switchView("shell");
    }

    switchView(activeView);
  });
});
