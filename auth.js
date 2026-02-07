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
const signOutButton = document.querySelector("#sign-out");

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

function disableAuthInputs() {
  [loginForm, signupForm].forEach((form) => {
    if (!form) {
      return;
    }

    form.querySelectorAll("input, button").forEach((element) => {
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

    const firstName = getFirstName(user);
    if (welcomeTitle) {
      welcomeTitle.textContent = `Welcome ${firstName}!`;
    }

    setStatus(profileStatus, "success", "Email verified. Profile access granted.");
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
