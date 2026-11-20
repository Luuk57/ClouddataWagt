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
  updateDoc,
  collection,
  getDocs
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

const moduleData = document.getElementById("moduleData");
const moduleReports = document.getElementById("moduleReports");
const noModulesMsg = document.getElementById("noModulesMsg");

const adminSection = document.getElementById("adminSection");
const settingsForm = document.getElementById("settingsForm");
const systemTitleInput = document.getElementById("systemTitleInput");
const maintenanceInput = document.getElementById("maintenanceInput");
const usersList = document.getElementById("usersList");

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

// Globale systeeminstellingen laden uit settings/app
async function loadAppSettings() {
  const settingsRef = doc(db, "settings", "app");
  const snap = await getDoc(settingsRef);

  if (snap.exists()) {
    const data = snap.data();
    const title = data.systemTitle || "Cloudsysteem Wagt 2026";
    const maint = Boolean(data.maintenanceMode);
    appBanner.textContent = maint
      ? `${title} — Onderhoudsmodus is actief.`
      : `${title} — Actief verbonden met Firebase.`;
    systemTitleInput.value = title;
    maintenanceInput.checked = maint;
  } else {
    systemTitleInput.value = "Cloudsysteem Wagt 2026";
    maintenanceInput.checked = false;
  }
}

// Systeeminstellingen opslaan als admin
settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Instellingen opslaan...");

  try {
    await setDoc(
      doc(db, "settings", "app"),
      {
        systemTitle: systemTitleInput.value.trim(),
        maintenanceMode: maintenanceInput.checked
      },
      { merge: true }
    );
    await loadAppSettings();
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
        <input type="checkbox" id="perm_data_${uid}" data-perm="canViewData" ${perms.canViewData ? "checked" : ""} />
        <label for="perm_data_${uid}">Recht: Data bekijken/invoeren</label>
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
  const userRef = doc(db, "users", user.uid);
  let userSnap = await getDoc(userRef);

  // Maak bij eerste login automatisch een basisprofiel aan als het nog niet bestaat
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
  const isAdmin = role === "admin";

  welcomeTitle.textContent = `Welkom, ${profile.email || user.email || "gebruiker"}`;
  roleBadge.textContent = isAdmin ? "ADMIN" : "GEBRUIKER";

  const showData = Boolean(permissions.canViewData) || isAdmin;
  const showReports = Boolean(permissions.canViewReports) || isAdmin;

  moduleData.classList.toggle("hidden", !showData);
  moduleReports.classList.toggle("hidden", !showReports);
  noModulesMsg.classList.toggle("hidden", showData || showReports);

  await loadAppSettings();

  if (isAdmin) {
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
    shellSection.classList.add("hidden");
    adminSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    return;
  }

  setStatus("Profiel en rechten laden...");
  try {
    await renderUserShell(user);
    setStatus("");
  } catch (err) {
    setStatus("Fout bij laden van profiel: " + err.message);
  }
});
