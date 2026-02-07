import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCL6vr_yk2q0fI8xj1Gk4N8HAra5JH86Ns",
  authDomain: "test-website-members.firebaseapp.com",
  projectId: "test-website-members",
  storageBucket: "test-website-members.firebasestorage.app",
  messagingSenderId: "853097537482",
  appId: "1:853097537482:web:9896e331dd86b72bc33933",
  measurementId: "G-0CH9TX3Z50",
};

const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const authStatus = document.querySelector("#auth-status");
const resendVerificationButton = document.querySelector("#resend-verification");
const checkVerificationButton = document.querySelector("#check-verification");

const welcomeTitle = document.querySelector("#welcome-title");
const profileStatus = document.querySelector("#profile-status");
const profileForm = document.querySelector("#profile-form");
const profilePhotoInput = document.querySelector("#profile-photo");
const profilePhotoPreview = document.querySelector("#profile-photo-preview");
const profileNameInput = document.querySelector("#profile-name");
const profileEmailInput = document.querySelector("#profile-email");
const profileAddressInput = document.querySelector("#profile-address");
const signOutButton = document.querySelector("#sign-out");

const jobCreateForm = document.querySelector("#job-create-form");
const jobsStatus = document.querySelector("#jobs-status");
const showClosedToggle = document.querySelector("#show-closed-toggle");
const openJobsList = document.querySelector("#open-jobs-list");
const myJobsList = document.querySelector("#my-jobs-list");

const jobDetailStatus = document.querySelector("#job-detail-status");
const jobDetailContainer = document.querySelector("#job-detail-container");
const jobNotFound = document.querySelector("#job-not-found");
const jobTitle = document.querySelector("#job-title");
const jobMeta = document.querySelector("#job-meta");
const jobStatusBadge = document.querySelector("#job-status-badge");
const jobDescription = document.querySelector("#job-description");
const applyPanel = document.querySelector("#apply-panel");
const applyButton = document.querySelector("#apply-button");
const posterPanel = document.querySelector("#poster-panel");
const applicationsList = document.querySelector("#applications-list");

const notificationsStatus = document.querySelector("#notifications-status");
const notificationsList = document.querySelector("#notifications-list");
const markAllReadButton = document.querySelector("#mark-all-read");

const MAX_PROFILE_PHOTO_BYTES = 1572864;

const EMPLOYMENT_LABELS = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const configIsReady = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_WITH_")
);

let pendingVerificationUser = null;

function setStatus(element, type, message) {
  if (!element) {
    return;
  }

  element.className = `status ${type}`;
  element.textContent = message;
}

function setVerificationButtonsVisible(isVisible) {
  if (resendVerificationButton) {
    resendVerificationButton.hidden = !isVisible;
  }

  if (checkVerificationButton) {
    checkVerificationButton.hidden = !isVisible;
  }
}

function profileUrl() {
  return new URL("profile.html", window.location.href).toString();
}

function loginUrl(reason) {
  const url = new URL("login.html", window.location.href);

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  return url.toString();
}

function formatAuthError(error) {
  const code = error && typeof error.code === "string" ? error.code : "";

  if (code === "auth/email-already-in-use") {
    return "That email is already in use. Try logging in instead.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/weak-password") {
    return "Password should be at least 6 characters.";
  }

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email or password is incorrect.";
  }

  return "Authentication request failed. Please try again.";
}

function getFirstName(user) {
  const displayName = (user.displayName || "").trim();

  if (displayName) {
    return displayName.split(/\s+/)[0];
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";

  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return "Member";
}

function getDisplayName(user) {
  const name = typeof user.displayName === "string" ? user.displayName.trim() : "";

  if (name) {
    return name;
  }

  return getFirstName(user);
}

function getProfileStorageKey(userId) {
  return `novasight-profile-${userId}`;
}

function readStoredProfile(userId) {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(userId));

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch (error) {
    return {};
  }
}

function writeStoredProfile(userId, profileData) {
  localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profileData));
}

function buildAvatarDataUrl(label) {
  const initial = String(label || "M").trim().charAt(0).toUpperCase() || "M";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0e6dff"/><stop offset="100%" stop-color="#14b3ff"/></linearGradient></defs><rect width="320" height="320" fill="url(#g)"/><text x="50%" y="54%" text-anchor="middle" font-size="140" font-family="Manrope, Arial, sans-serif" fill="white">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setProfilePhoto(photoUrl, fallbackLabel) {
  if (!profilePhotoPreview) {
    return;
  }

  profilePhotoPreview.src = photoUrl || buildAvatarDataUrl(fallbackLabel);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("Could not read file."));
    };

    reader.readAsDataURL(file);
  });
}

function formatEmploymentType(value) {
  return EMPLOYMENT_LABELS[value] || "Other";
}

function formatDate(value) {
  if (!value || typeof value.toDate !== "function") {
    return "Just now";
  }

  try {
    return value.toDate().toLocaleString();
  } catch (error) {
    return "Just now";
  }
}

function escapeHtml(value) {
  const text = String(value || "");
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMultiline(text) {
  return escapeHtml(text).replace(/\n/g, "<br />");
}

function renderJobBadge(status) {
  const normalized = typeof status === "string" ? status : "open";
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `<span class="job-badge ${escapeHtml(normalized)}">${escapeHtml(label)}</span>`;
}

function renderApplicationBadge(status) {
  const normalized = typeof status === "string" ? status : "pending";
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `<span class="job-badge app-${escapeHtml(normalized)}">${escapeHtml(label)}</span>`;
}

function buildJobCard(jobId, job, options = {}) {
  const isOwner = options.isOwner === true;
  const allowClose = options.allowClose === true && job.status === "open";

  return `
    <article class="job-item">
      <div class="job-head-row">
        <h3>${escapeHtml(job.title)}</h3>
        ${renderJobBadge(job.status)}
      </div>
      <p class="job-meta">${escapeHtml(job.company)} • ${escapeHtml(job.location)} • ${escapeHtml(formatEmploymentType(job.employmentType))}</p>
      <p class="job-meta">Salary: ${escapeHtml(job.salaryRange)}</p>
      <p class="job-snippet">${escapeHtml(job.description).slice(0, 220)}${job.description && job.description.length > 220 ? "..." : ""}</p>
      <p class="job-meta">Posted ${escapeHtml(formatDate(job.createdAt))}${isOwner ? " by you" : ""}</p>
      <div class="job-actions">
        <a class="text-link" href="job.html?id=${encodeURIComponent(jobId)}">View details</a>
        ${allowClose ? `<button class="text-btn close-job-btn" type="button" data-job-id="${escapeHtml(jobId)}">Close job</button>` : ""}
      </div>
    </article>
  `;
}

function notificationMessage(notification) {
  const actor = escapeHtml(notification.actorName || "A member");
  const title = escapeHtml(notification.jobTitle || "a job");

  if (notification.type === "application_received") {
    return `${actor} applied to your job <strong>${title}</strong>.`;
  }

  if (notification.type === "application_accepted") {
    return `${actor} accepted your application for <strong>${title}</strong>.`;
  }

  if (notification.type === "application_denied") {
    return `${actor} denied your application for <strong>${title}</strong>.`;
  }

  return `${actor} sent you an update for <strong>${title}</strong>.`;
}

async function createNotification(db, payload) {
  await addDoc(collection(db, "notifications"), {
    recipientUid: payload.recipientUid,
    recipientEmail: payload.recipientEmail,
    actorUid: payload.actorUid,
    actorName: payload.actorName,
    type: payload.type,
    jobId: payload.jobId,
    jobTitle: payload.jobTitle,
    applicationApplicantUid: payload.applicationApplicantUid,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

async function queueEmail(db, payload) {
  if (!payload.recipientEmail) {
    throw new Error("No recipient email found.");
  }

  await addDoc(collection(db, "mail"), {
    to: [payload.recipientEmail],
    message: {
      subject: payload.subject,
      text: payload.text,
    },
    meta: {
      type: payload.type,
      jobId: payload.jobId,
      actorUid: payload.actorUid,
      recipientUid: payload.recipientUid,
      createdAt: serverTimestamp(),
    },
  });
}

async function createNotificationAndEmail(db, payload) {
  const warnings = [];

  try {
    await createNotification(db, payload);
  } catch (error) {
    warnings.push("in-app notification could not be created.");
  }

  try {
    await queueEmail(db, {
      recipientEmail: payload.recipientEmail,
      subject: payload.subject,
      text: payload.text,
      type: payload.type,
      jobId: payload.jobId,
      actorUid: payload.actorUid,
      recipientUid: payload.recipientUid,
    });
  } catch (error) {
    warnings.push("email notification may have failed.");
  }

  if (warnings.length > 0) {
    return `Action saved, ${warnings.join(" ")}`;
  }

  return null;
}

function disableAuthInputs() {
  [loginForm, signupForm, profileForm, jobCreateForm].forEach((form) => {
    if (!form) {
      return;
    }

    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = true;
    });
  });

  [resendVerificationButton, checkVerificationButton, signOutButton, applyButton, markAllReadButton].forEach((button) => {
    if (button) {
      button.disabled = true;
    }
  });
}

function redirectToProfile() {
  window.location.href = profileUrl();
}

async function getVerifiedMember(auth) {
  const user = await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (resolvedUser) => {
      unsubscribe();
      if (!resolvedUser) {
        resolve(null);
        return;
      }

      try {
        await reload(resolvedUser);
      } catch (error) {
        // Continue with last known auth state.
      }

      resolve(resolvedUser);
    });
  });

  if (!user) {
    window.location.href = loginUrl("login");
    return null;
  }

  if (!user.emailVerified) {
    window.location.href = loginUrl("verify");
    return null;
  }

  return user;
}

async function runAuthPage(auth) {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");

  setStatus(authStatus, "info", "Use login for existing members or sign up if this is your first time.");

  if (reason === "login") {
    setStatus(authStatus, "info", "Please log in to view your profile.");
  }

  if (reason === "verify") {
    setStatus(authStatus, "error", "Verify your email first, then log in again.");
  }

  if (reason === "signedout") {
    setStatus(authStatus, "info", "You signed out successfully.");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(loginForm);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");

      setStatus(authStatus, "info", "Signing in...");

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await reload(credential.user);

        if (!credential.user.emailVerified) {
          pendingVerificationUser = credential.user;
          setVerificationButtonsVisible(true);
          setStatus(authStatus, "error", "Your account is not verified. Check your email for the verification link.");
          return;
        }

        redirectToProfile();
      } catch (error) {
        setStatus(authStatus, "error", formatAuthError(error));
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(signupForm);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");

      if (!name) {
        setStatus(authStatus, "error", "Enter your full name to create an account.");
        return;
      }

      setStatus(authStatus, "info", "Creating account...");

      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await sendEmailVerification(credential.user, { url: profileUrl() });

        pendingVerificationUser = credential.user;
        setVerificationButtonsVisible(true);

        setStatus(
          authStatus,
          "success",
          "Account created. A verification email has been sent. Verify your email before accessing your profile."
        );

        signupForm.reset();
      } catch (error) {
        setStatus(authStatus, "error", formatAuthError(error));
      }
    });
  }

  if (resendVerificationButton) {
    resendVerificationButton.addEventListener("click", async () => {
      const user = auth.currentUser || pendingVerificationUser;

      if (!user) {
        setStatus(authStatus, "error", "Log in or sign up first so we know which account to verify.");
        return;
      }

      try {
        await sendEmailVerification(user, { url: profileUrl() });
        setStatus(authStatus, "success", "Verification email sent again. Check your inbox.");
      } catch (error) {
        setStatus(authStatus, "error", formatAuthError(error));
      }
    });
  }

  if (checkVerificationButton) {
    checkVerificationButton.addEventListener("click", async () => {
      if (!auth.currentUser) {
        setStatus(authStatus, "error", "Log in with your verified account to continue.");
        return;
      }

      try {
        await reload(auth.currentUser);

        if (!auth.currentUser.emailVerified) {
          setStatus(authStatus, "error", "Your email is still not verified. Open the verification email and click the link.");
          return;
        }

        redirectToProfile();
      } catch (error) {
        setStatus(authStatus, "error", formatAuthError(error));
      }
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      return;
    }

    await reload(user);

    if (user.emailVerified) {
      return;
    }

    pendingVerificationUser = user;
    setVerificationButtonsVisible(true);
  });
}

async function runProfilePage(auth) {
  const user = await getVerifiedMember(auth);

  if (!user) {
    return;
  }

  let currentPhotoDataUrl = "";
  setProfilePhoto("", "Member");

  const storedProfile = readStoredProfile(user.uid);
  const name = String(storedProfile.name || user.displayName || "").trim();
  const address = String(storedProfile.address || "").trim();
  const email = String(user.email || "").trim();
  const storedPhoto = typeof storedProfile.photoDataUrl === "string" ? storedProfile.photoDataUrl : "";
  const userPhoto = typeof user.photoURL === "string" ? user.photoURL : "";
  currentPhotoDataUrl = storedPhoto || userPhoto;

  if (profileNameInput) {
    profileNameInput.value = name;
  }

  if (profileEmailInput) {
    profileEmailInput.value = email;
  }

  if (profileAddressInput) {
    profileAddressInput.value = address;
  }

  setProfilePhoto(currentPhotoDataUrl, name || email || "Member");

  const firstName = getFirstName({ displayName: name || user.displayName || "", email });
  if (welcomeTitle) {
    welcomeTitle.textContent = `Welcome ${firstName}!`;
  }

  setStatus(profileStatus, "success", "Email verified. Update your profile details below.");

  if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", async () => {
      const file = profilePhotoInput.files && profilePhotoInput.files[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setStatus(profileStatus, "error", "Please upload a valid image file.");
        profilePhotoInput.value = "";
        return;
      }

      if (file.size > MAX_PROFILE_PHOTO_BYTES) {
        setStatus(profileStatus, "error", "Profile photo is too large. Please use an image under 1.5 MB.");
        profilePhotoInput.value = "";
        return;
      }

      try {
        currentPhotoDataUrl = await fileToDataUrl(file);
        const fallbackLabel = (profileNameInput && profileNameInput.value.trim()) || "Member";
        setProfilePhoto(currentPhotoDataUrl, fallbackLabel);
        setStatus(profileStatus, "info", "Photo selected. Click Save Profile to keep your changes.");
      } catch (error) {
        setStatus(profileStatus, "error", "We could not process that image. Please try another file.");
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const nextName = String((profileNameInput && profileNameInput.value) || "").trim();
      const nextAddress = String((profileAddressInput && profileAddressInput.value) || "").trim();

      if (!nextName) {
        setStatus(profileStatus, "error", "Please enter your full name.");
        return;
      }

      try {
        await updateProfile(user, { displayName: nextName });

        const profileData = {
          name: nextName,
          address: nextAddress,
          photoDataUrl: currentPhotoDataUrl,
          updatedAt: Date.now(),
        };

        writeStoredProfile(user.uid, profileData);
        setProfilePhoto(currentPhotoDataUrl, nextName);

        if (welcomeTitle) {
          welcomeTitle.textContent = `Welcome ${getFirstName({ displayName: nextName, email: user.email })}!`;
        }

        setStatus(profileStatus, "success", "Profile saved successfully.");
      } catch (error) {
        const message = error && error.name === "QuotaExceededError"
          ? "Could not save profile photo. Try a smaller image."
          : "Could not save your profile right now. Please try again.";
        setStatus(profileStatus, "error", message);
      }
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = loginUrl("signedout");
    });
  }
}

async function runJobsPage(auth, db) {
  const user = await getVerifiedMember(auth);

  if (!user) {
    return;
  }

  setStatus(jobsStatus, "info", "Loading jobs...");

  let openJobsUnsubscribe = null;

  function subscribeOpenJobs() {
    if (openJobsUnsubscribe) {
      openJobsUnsubscribe();
    }

    const jobsQuery = showClosedToggle && showClosedToggle.checked
      ? query(collection(db, "jobs"), orderBy("createdAt", "desc"))
      : query(collection(db, "jobs"), where("status", "==", "open"), orderBy("createdAt", "desc"));

    openJobsUnsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        if (!openJobsList) {
          return;
        }

        if (snapshot.empty) {
          openJobsList.innerHTML = '<p class="job-empty">No jobs available right now.</p>';
          return;
        }

        openJobsList.innerHTML = snapshot.docs.map((snap) => buildJobCard(snap.id, snap.data())).join("");
      },
      () => {
        setStatus(jobsStatus, "error", "Could not load jobs right now.");
      }
    );
  }

  subscribeOpenJobs();

  const myJobsQuery = query(collection(db, "jobs"), where("posterUid", "==", user.uid), orderBy("createdAt", "desc"));

  onSnapshot(
    myJobsQuery,
    (snapshot) => {
      if (!myJobsList) {
        return;
      }

      if (snapshot.empty) {
        myJobsList.innerHTML = '<p class="job-empty">You have not posted any jobs yet.</p>';
        return;
      }

      myJobsList.innerHTML = snapshot.docs
        .map((snap) => buildJobCard(snap.id, snap.data(), { isOwner: true, allowClose: true }))
        .join("");
    },
    () => {
      setStatus(jobsStatus, "error", "Could not load your posted jobs.");
    }
  );

  if (showClosedToggle) {
    showClosedToggle.addEventListener("change", subscribeOpenJobs);
  }

  if (jobCreateForm) {
    jobCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(jobCreateForm);
      const payload = {
        title: String(formData.get("title") || "").trim(),
        company: String(formData.get("company") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        employmentType: String(formData.get("employmentType") || "").trim(),
        salaryRange: String(formData.get("salaryRange") || "").trim(),
        description: String(formData.get("description") || "").trim(),
      };

      const isComplete = payload.title
        && payload.company
        && payload.location
        && payload.employmentType
        && payload.salaryRange
        && payload.description;

      if (!isComplete) {
        setStatus(jobsStatus, "error", "Complete all required fields before publishing.");
        return;
      }

      setStatus(jobsStatus, "info", "Publishing job...");

      try {
        await addDoc(collection(db, "jobs"), {
          posterUid: user.uid,
          posterName: getDisplayName(user),
          posterEmail: String(user.email || ""),
          title: payload.title,
          company: payload.company,
          location: payload.location,
          employmentType: payload.employmentType,
          salaryRange: payload.salaryRange,
          description: payload.description,
          status: "open",
          acceptedApplicantUid: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          closedAt: null,
        });

        jobCreateForm.reset();
        setStatus(jobsStatus, "success", "Job published successfully.");
      } catch (error) {
        setStatus(jobsStatus, "error", "Could not publish the job right now.");
      }
    });
  }

  if (myJobsList) {
    myJobsList.addEventListener("click", async (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement) || !target.classList.contains("close-job-btn")) {
        return;
      }

      const jobId = target.getAttribute("data-job-id");
      if (!jobId) {
        return;
      }

      setStatus(jobsStatus, "info", "Closing job...");

      try {
        const jobRef = doc(db, "jobs", jobId);
        const snap = await getDoc(jobRef);

        if (!snap.exists()) {
          setStatus(jobsStatus, "error", "This job no longer exists.");
          return;
        }

        const job = snap.data();

        if (job.posterUid !== user.uid) {
          setStatus(jobsStatus, "error", "You can only close jobs you posted.");
          return;
        }

        if (job.status !== "open") {
          setStatus(jobsStatus, "info", "This job is already closed or filled.");
          return;
        }

        await updateDoc(jobRef, {
          status: "closed",
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setStatus(jobsStatus, "success", "Job closed.");
      } catch (error) {
        setStatus(jobsStatus, "error", "Could not close this job.");
      }
    });
  }
}

async function runJobDetailPage(auth, db) {
  const user = await getVerifiedMember(auth);

  if (!user) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const jobId = String(params.get("id") || "").trim();

  if (!jobId) {
    if (jobDetailContainer) {
      jobDetailContainer.hidden = true;
    }

    if (posterPanel) {
      posterPanel.hidden = true;
    }

    if (jobNotFound) {
      jobNotFound.hidden = false;
    }

    setStatus(jobDetailStatus, "error", "Missing job id.");
    return;
  }

  let currentJob = null;
  let applicationUnsubscribe = null;

  function tearDownApplications() {
    if (applicationUnsubscribe) {
      applicationUnsubscribe();
      applicationUnsubscribe = null;
    }
  }

  function renderJob(data) {
    if (jobTitle) {
      jobTitle.textContent = data.title;
    }

    if (jobMeta) {
      jobMeta.textContent = `${data.company} • ${data.location} • ${formatEmploymentType(data.employmentType)} • ${data.salaryRange}`;
    }

    if (jobStatusBadge) {
      jobStatusBadge.className = `job-badge ${data.status}`;
      jobStatusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    }

    if (jobDescription) {
      jobDescription.innerHTML = renderMultiline(data.description || "");
    }
  }

  async function sendApplicationReceivedNotification(jobData) {
    const warning = await createNotificationAndEmail(db, {
      recipientUid: jobData.posterUid,
      recipientEmail: jobData.posterEmail,
      actorUid: user.uid,
      actorName: getDisplayName(user),
      type: "application_received",
      jobId,
      jobTitle: jobData.title,
      applicationApplicantUid: user.uid,
      subject: `New application for ${jobData.title}`,
      text: `${getDisplayName(user)} applied to your job "${jobData.title}".`,
    });

    if (warning) {
      setStatus(jobDetailStatus, "info", `Application saved. ${warning}`);
      return;
    }

    setStatus(jobDetailStatus, "success", "Application submitted.");
  }

  async function sendDecisionNotification(jobData, recipient, type) {
    const isAccepted = type === "application_accepted";
    const outcomeWord = isAccepted ? "accepted" : "denied";

    return createNotificationAndEmail(db, {
      recipientUid: recipient.applicantUid,
      recipientEmail: recipient.applicantEmail,
      actorUid: user.uid,
      actorName: getDisplayName(user),
      type,
      jobId,
      jobTitle: jobData.title,
      applicationApplicantUid: recipient.applicantUid,
      subject: `Application ${outcomeWord}: ${jobData.title}`,
      text: `${getDisplayName(user)} ${outcomeWord} your application for "${jobData.title}".`,
    });
  }

  async function acceptApplicant(applicantUid) {
    if (!currentJob) {
      return;
    }

    if (currentJob.posterUid !== user.uid) {
      setStatus(jobDetailStatus, "error", "Only the job poster can accept applicants.");
      return;
    }

    if (currentJob.status !== "open") {
      setStatus(jobDetailStatus, "error", "This job is no longer open.");
      return;
    }

    setStatus(jobDetailStatus, "info", "Accepting applicant...");

    const jobRef = doc(db, "jobs", jobId);
    const targetRef = doc(db, "jobs", jobId, "applications", applicantUid);
    let acceptedApplication = null;

    try {
      await runTransaction(db, async (transaction) => {
        const jobSnap = await transaction.get(jobRef);

        if (!jobSnap.exists()) {
          throw new Error("Job missing");
        }

        const jobData = jobSnap.data();

        if (jobData.posterUid !== user.uid || jobData.status !== "open") {
          throw new Error("Invalid job state");
        }

        const applicationSnap = await transaction.get(targetRef);

        if (!applicationSnap.exists()) {
          throw new Error("Application missing");
        }

        const applicationData = applicationSnap.data();

        if (applicationData.status !== "pending") {
          throw new Error("Application already decided");
        }

        acceptedApplication = { ...applicationData, applicantUid };

        transaction.update(targetRef, {
          status: "accepted",
          decidedAt: serverTimestamp(),
          decidedByUid: user.uid,
        });

        transaction.update(jobRef, {
          status: "filled",
          acceptedApplicantUid: applicantUid,
          updatedAt: serverTimestamp(),
          closedAt: serverTimestamp(),
        });
      });

      const pendingSnapshot = await getDocs(
        query(collection(db, "jobs", jobId, "applications"), where("status", "==", "pending"))
      );

      const deniedApplicants = [];
      const batch = writeBatch(db);

      pendingSnapshot.forEach((snap) => {
        if (snap.id === applicantUid) {
          return;
        }

        batch.update(snap.ref, {
          status: "denied",
          decidedAt: serverTimestamp(),
          decidedByUid: user.uid,
        });

        deniedApplicants.push({ ...snap.data(), applicantUid: snap.id });
      });

      if (deniedApplicants.length > 0) {
        await batch.commit();
      }

      const warnings = [];

      if (acceptedApplication) {
        const warning = await sendDecisionNotification(currentJob, acceptedApplication, "application_accepted");
        if (warning) {
          warnings.push(warning);
        }
      }

      for (const deniedApplicant of deniedApplicants) {
        const warning = await sendDecisionNotification(currentJob, deniedApplicant, "application_denied");
        if (warning) {
          warnings.push(warning);
        }
      }

      if (warnings.length > 0) {
        setStatus(jobDetailStatus, "info", `Applicant accepted. ${warnings[0]}`);
        return;
      }

      setStatus(jobDetailStatus, "success", "Applicant accepted and job marked as filled.");
    } catch (error) {
      setStatus(jobDetailStatus, "error", "Could not accept applicant. Please refresh and try again.");
    }
  }

  async function denyApplicant(applicantUid) {
    if (!currentJob) {
      return;
    }

    if (currentJob.posterUid !== user.uid) {
      setStatus(jobDetailStatus, "error", "Only the job poster can deny applicants.");
      return;
    }

    setStatus(jobDetailStatus, "info", "Denying applicant...");

    const applicationRef = doc(db, "jobs", jobId, "applications", applicantUid);

    try {
      const snap = await getDoc(applicationRef);

      if (!snap.exists()) {
        setStatus(jobDetailStatus, "error", "Application not found.");
        return;
      }

      const application = snap.data();

      if (application.status !== "pending") {
        setStatus(jobDetailStatus, "info", "This application has already been reviewed.");
        return;
      }

      await updateDoc(applicationRef, {
        status: "denied",
        decidedAt: serverTimestamp(),
        decidedByUid: user.uid,
      });

      const warning = await sendDecisionNotification(
        currentJob,
        { ...application, applicantUid },
        "application_denied"
      );

      if (warning) {
        setStatus(jobDetailStatus, "info", `Application denied. ${warning}`);
        return;
      }

      setStatus(jobDetailStatus, "success", "Application denied.");
    } catch (error) {
      setStatus(jobDetailStatus, "error", "Could not deny application right now.");
    }
  }

  if (applicationsList) {
    applicationsList.addEventListener("click", async (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute("data-action");
      const applicantUid = target.getAttribute("data-applicant-uid");

      if (!action || !applicantUid) {
        return;
      }

      if (action === "accept") {
        await acceptApplicant(applicantUid);
        return;
      }

      if (action === "deny") {
        await denyApplicant(applicantUid);
      }
    });
  }

  if (applyButton) {
    applyButton.addEventListener("click", async () => {
      if (!currentJob) {
        return;
      }

      if (currentJob.posterUid === user.uid) {
        setStatus(jobDetailStatus, "error", "You cannot apply to your own job posting.");
        return;
      }

      if (currentJob.status !== "open") {
        setStatus(jobDetailStatus, "error", "This job is no longer open for applications.");
        return;
      }

      const applicationRef = doc(db, "jobs", jobId, "applications", user.uid);

      setStatus(jobDetailStatus, "info", "Submitting application...");

      try {
        const existing = await getDoc(applicationRef);

        if (existing.exists()) {
          const status = existing.data().status;

          if (status === "pending") {
            setStatus(jobDetailStatus, "info", "You already applied to this job.");
            return;
          }

          if (status === "accepted") {
            setStatus(jobDetailStatus, "success", "You were already accepted for this job.");
            return;
          }

          setStatus(jobDetailStatus, "info", "Your application was already reviewed.");
          return;
        }

        await setDoc(applicationRef, {
          jobId,
          applicantUid: user.uid,
          applicantName: getDisplayName(user),
          applicantEmail: String(user.email || ""),
          status: "pending",
          appliedAt: serverTimestamp(),
          decidedAt: null,
          decidedByUid: null,
        });

        await sendApplicationReceivedNotification(currentJob);
      } catch (error) {
        setStatus(jobDetailStatus, "error", "Could not submit your application.");
      }
    });
  }

  onSnapshot(
    doc(db, "jobs", jobId),
    (snapshot) => {
      if (!snapshot.exists()) {
        tearDownApplications();

        if (jobDetailContainer) {
          jobDetailContainer.hidden = true;
        }

        if (posterPanel) {
          posterPanel.hidden = true;
        }

        if (jobNotFound) {
          jobNotFound.hidden = false;
        }

        setStatus(jobDetailStatus, "error", "This job posting does not exist.");
        return;
      }

      currentJob = snapshot.data();
      renderJob(currentJob);

      if (jobNotFound) {
        jobNotFound.hidden = true;
      }

      if (jobDetailContainer) {
        jobDetailContainer.hidden = false;
      }

      const isPoster = currentJob.posterUid === user.uid;

      if (applyPanel) {
        applyPanel.hidden = isPoster;
      }

      if (applyButton) {
        applyButton.disabled = isPoster || currentJob.status !== "open";
      }

      if (!isPoster) {
        if (posterPanel) {
          posterPanel.hidden = true;
        }

        tearDownApplications();

        if (currentJob.status !== "open") {
          setStatus(jobDetailStatus, "info", "This job is closed for new applications.");
        } else {
          setStatus(jobDetailStatus, "success", "Job loaded. Apply if you're interested.");
        }

        return;
      }

      if (posterPanel) {
        posterPanel.hidden = false;
      }

      tearDownApplications();

      const applicationsQuery = query(
        collection(db, "jobs", jobId, "applications"),
        orderBy("appliedAt", "desc")
      );

      applicationUnsubscribe = onSnapshot(applicationsQuery, (applicationsSnapshot) => {
        if (!applicationsList) {
          return;
        }

        if (applicationsSnapshot.empty) {
          applicationsList.innerHTML = '<p class="job-empty">No applications yet.</p>';
          return;
        }

        applicationsList.innerHTML = applicationsSnapshot.docs
          .map((applicationSnap) => {
            const application = applicationSnap.data();
            const canDecide = currentJob.status === "open" && application.status === "pending";

            return `
              <article class="application-item">
                <div class="application-head">
                  <h3>${escapeHtml(application.applicantName || "Member")}</h3>
                  ${renderApplicationBadge(application.status)}
                </div>
                <p class="job-meta">${escapeHtml(application.applicantEmail || "")}</p>
                <p class="job-meta">Applied ${escapeHtml(formatDate(application.appliedAt))}</p>
                <div class="job-actions">
                  ${canDecide ? `<button class="text-btn" type="button" data-action="accept" data-applicant-uid="${escapeHtml(applicationSnap.id)}">Accept</button>` : ""}
                  ${canDecide ? `<button class="text-btn" type="button" data-action="deny" data-applicant-uid="${escapeHtml(applicationSnap.id)}">Deny</button>` : ""}
                </div>
              </article>
            `;
          })
          .join("");
      });

      setStatus(jobDetailStatus, "success", "Job loaded. Manage applications below.");
    },
    () => {
      if (jobDetailContainer) {
        jobDetailContainer.hidden = true;
      }

      if (posterPanel) {
        posterPanel.hidden = true;
      }

      if (jobNotFound) {
        jobNotFound.hidden = false;
      }

      setStatus(jobDetailStatus, "error", "Could not load this job right now.");
    }
  );
}

async function runNotificationsPage(auth, db) {
  const user = await getVerifiedMember(auth);

  if (!user) {
    return;
  }

  const notificationsQuery = query(
    collection(db, "notifications"),
    where("recipientUid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    notificationsQuery,
    (snapshot) => {
      if (!notificationsList) {
        return;
      }

      if (snapshot.empty) {
        notificationsList.innerHTML = '<p class="job-empty">No notifications yet.</p>';
        setStatus(notificationsStatus, "success", "You are all caught up.");
        return;
      }

      notificationsList.innerHTML = snapshot.docs
        .map((snap) => {
          const notification = snap.data();
          const readClass = notification.isRead ? "read" : "unread";

          const typeLabel = String(notification.type || "notification").replace(/_/g, " ");

          return `
            <article class="notification-item ${readClass}">
              <div class="application-head">
                <h3>${escapeHtml(typeLabel)}</h3>
                <span class="job-meta">${escapeHtml(formatDate(notification.createdAt))}</span>
              </div>
              <p>${notificationMessage(notification)}</p>
              <div class="job-actions">
                <a class="text-link" href="job.html?id=${encodeURIComponent(notification.jobId)}">View job</a>
                ${notification.isRead ? "" : `<button class="text-btn" type="button" data-mark-read="${escapeHtml(snap.id)}">Mark read</button>`}
              </div>
            </article>
          `;
        })
        .join("");

      setStatus(notificationsStatus, "success", "Notifications updated.");
    },
    () => {
      setStatus(notificationsStatus, "error", "Could not load notifications right now.");
    }
  );

  if (notificationsList) {
    notificationsList.addEventListener("click", async (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const notificationId = target.getAttribute("data-mark-read");
      if (!notificationId) {
        return;
      }

      try {
        await updateDoc(doc(db, "notifications", notificationId), {
          isRead: true,
        });
      } catch (error) {
        setStatus(notificationsStatus, "error", "Could not mark this notification as read.");
      }
    });
  }

  if (markAllReadButton) {
    markAllReadButton.addEventListener("click", async () => {
      try {
        setStatus(notificationsStatus, "info", "Marking notifications as read...");

        const unreadQuery = query(
          collection(db, "notifications"),
          where("recipientUid", "==", user.uid),
          where("isRead", "==", false)
        );

        const snapshot = await getDocs(unreadQuery);

        if (snapshot.empty) {
          setStatus(notificationsStatus, "success", "No unread notifications.");
          return;
        }

        const batch = writeBatch(db);
        snapshot.forEach((snap) => {
          batch.update(snap.ref, { isRead: true });
        });
        await batch.commit();

        setStatus(notificationsStatus, "success", "All notifications marked as read.");
      } catch (error) {
        setStatus(notificationsStatus, "error", "Could not mark all notifications as read.");
      }
    });
  }
}

if (!configIsReady) {
  disableAuthInputs();
  setStatus(authStatus, "error", "Set your Firebase config values in auth.js before using login/signup.");
  setStatus(profileStatus, "error", "Set your Firebase config values in auth.js before using profile access.");
  setStatus(jobsStatus, "error", "Set your Firebase config values in auth.js before using jobs.");
  setStatus(jobDetailStatus, "error", "Set your Firebase config values in auth.js before using job details.");
  setStatus(notificationsStatus, "error", "Set your Firebase config values in auth.js before using notifications.");
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (loginForm || signupForm) {
    runAuthPage(auth);
  }

  if (profileStatus && profileForm) {
    runProfilePage(auth);
  }

  if (jobsStatus) {
    runJobsPage(auth, db);
  }

  if (jobDetailStatus) {
    runJobDetailPage(auth, db);
  }

  if (notificationsStatus) {
    runNotificationsPage(auth, db);
  }
}
