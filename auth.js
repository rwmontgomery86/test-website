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
const MAX_PROFILE_PHOTO_BYTES = 1572864;

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

function disableAuthInputs() {
  [loginForm, signupForm, profileForm].forEach((form) => {
    if (!form) {
      return;
    }

    form.querySelectorAll("input, textarea, button").forEach((element) => {
      element.disabled = true;
    });
  });

  if (resendVerificationButton) {
    resendVerificationButton.disabled = true;
  }

  if (checkVerificationButton) {
    checkVerificationButton.disabled = true;
  }

  if (signOutButton) {
    signOutButton.disabled = true;
  }
}

function redirectToProfile() {
  window.location.href = profileUrl();
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

function runProfilePage(auth) {
  let currentUser = null;
  let currentPhotoDataUrl = "";
  setProfilePhoto("", "Member");

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

      if (!currentUser) {
        setStatus(profileStatus, "error", "You need to be logged in to save profile changes.");
        return;
      }

      const name = String((profileNameInput && profileNameInput.value) || "").trim();
      const address = String((profileAddressInput && profileAddressInput.value) || "").trim();

      if (!name) {
        setStatus(profileStatus, "error", "Please enter your full name.");
        return;
      }

      try {
        await updateProfile(currentUser, { displayName: name });

        const profileData = {
          name,
          address,
          photoDataUrl: currentPhotoDataUrl,
          updatedAt: Date.now(),
        };

        writeStoredProfile(currentUser.uid, profileData);
        setProfilePhoto(currentPhotoDataUrl, name);

        if (welcomeTitle) {
          welcomeTitle.textContent = `Welcome ${getFirstName({ displayName: name, email: currentUser.email })}!`;
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

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = loginUrl("login");
      return;
    }

    await reload(user);

    if (!user.emailVerified) {
      window.location.href = loginUrl("verify");
      return;
    }

    currentUser = user;

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
  });

  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = loginUrl("signedout");
    });
  }
}

if (!loginForm && !signupForm && !profileStatus) {
  // No auth UI on this page.
} else if (!configIsReady) {
  disableAuthInputs();
  setStatus(authStatus, "error", "Set your Firebase config values in auth.js before using login/signup.");
  setStatus(profileStatus, "error", "Set your Firebase config values in auth.js before using profile access.");
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (loginForm || signupForm) {
    runAuthPage(auth);
  }

  if (profileStatus) {
    runProfilePage(auth);
  }
}
