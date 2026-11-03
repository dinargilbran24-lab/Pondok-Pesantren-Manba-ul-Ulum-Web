const adminConfig = window.REGISTRATION_CONFIG || {};
const portalConfig = window.PORTAL_CONFIG || {};
const databaseStatus = document.querySelector("#database-status");
const databaseLink = document.querySelector("#database-link");
const spreadsheetUrl = adminConfig.adminSpreadsheetUrl;
const guardianPasswordStatus = document.querySelector("#guardian-password-status");
const guardianPasswordForm = document.querySelector("#guardian-password-form");
const guardianPasswordGoogleButton = document.querySelector("#guardian-password-google-button");
let adminIdToken = "";

if (typeof spreadsheetUrl === "string" && spreadsheetUrl.trim()) {
  try {
    const url = new URL(spreadsheetUrl.trim());
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com"
      || !/^\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)) {
      throw new Error("URL Google Spreadsheet tidak valid.");
    }

    databaseLink.href = url.href;
    databaseLink.hidden = false;
    databaseStatus.textContent =
      "Akses dikontrol oleh izin berbagi Google Spreadsheet. Login dengan akun Google yang sudah diberi akses.";
  } catch (error) {
    databaseStatus.textContent = error.message;
    databaseStatus.classList.add("admin-error");
    console.error(error);
  }
} else {
  databaseStatus.textContent =
    "Tautan belum diatur. Jalankan setupRegistrationStorage pada Apps Script, lalu masukkan URL Spreadsheet di registration-config.js.";
}

function showGuardianPasswordStatus(message, isError = false) {
  guardianPasswordStatus.textContent = message;
  guardianPasswordStatus.classList.toggle("admin-error", isError);
}

function adminPortalRequest(operation, extra = {}) {
  return new Promise((resolve, reject) => {
    const appUrl = adminConfig.appsScriptUrl || portalConfig.appsScriptUrl;
    if (!appUrl) {
      reject(new Error("URL Web App Apps Script belum diatur."));
      return;
    }

    const nonce = crypto.randomUUID();
    const frameName = `admin-response-${nonce}`;
    const frame = document.createElement("iframe");
    frame.name = frameName;
    frame.title = "Respons pengaturan Portal Wali";
    frame.hidden = true;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = appUrl;
    form.target = frameName;
    form.hidden = true;

    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify({
      action: "guardian-portal",
      operation,
      nonce,
      origin: window.location.origin,
      adminIdToken,
      ...extra,
    });
    form.append(payloadInput);

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeout);
      form.remove();
      frame.remove();
    };
    const handleMessage = (event) => {
      if (event.source !== frame.contentWindow || !event.data
        || event.data.type !== "manbaul-portal" || event.data.nonce !== nonce) {
        return;
      }
      cleanup();
      if (event.data.result && event.data.result.status === "success") {
        resolve(event.data.result);
      } else {
        reject(new Error((event.data.result && event.data.result.error)
          || "Permintaan tidak berhasil diproses."));
      }
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Respons server belum diterima. Periksa koneksi lalu coba lagi."));
    }, 45000);

    window.addEventListener("message", handleMessage);
    document.body.append(frame, form);
    form.submit();
  });
}

function showGuardianPasswordForm(response) {
  adminIdToken = response.credential;
  guardianPasswordGoogleButton.hidden = true;
  guardianPasswordForm.hidden = false;
  showGuardianPasswordStatus("Login pengelola aktif. Buat atau perbarui kata sandi wali di bawah.");
}

function initializeGuardianPasswordManagement() {
  const clientId = portalConfig.googleClientId;
  const appUrl = adminConfig.appsScriptUrl || portalConfig.appsScriptUrl;
  if (typeof clientId !== "string" || !clientId.trim().endsWith(".apps.googleusercontent.com")
    || typeof appUrl !== "string" || !appUrl.trim()) {
    guardianPasswordGoogleButton.hidden = true;
    showGuardianPasswordStatus(
      "Konfigurasi belum lengkap. Atur URL Apps Script dan Google Client ID di file konfigurasi portal.",
      true
    );
    return;
  }

  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com"
      || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
      throw new Error("URL Web App Apps Script belum benar.");
    }
  } catch (error) {
    guardianPasswordGoogleButton.hidden = true;
    showGuardianPasswordStatus(error.message, true);
    return;
  }

  const renderButton = () => {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      showGuardianPasswordStatus("Layanan login pengelola belum siap. Muat ulang halaman.", true);
      return;
    }
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response || typeof response.credential !== "string") {
            showGuardianPasswordStatus("Login pengelola tidak berhasil. Silakan coba kembali.", true);
            return;
          }
          showGuardianPasswordForm(response);
        },
      });
      window.google.accounts.id.renderButton(guardianPasswordGoogleButton, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 280,
      });
    } catch (error) {
      console.error(error);
      showGuardianPasswordStatus("Login Google untuk pengelola belum dapat ditampilkan. Periksa Client ID dan domain OAuth.", true);
    }
  };

  if (window.google && window.google.accounts && window.google.accounts.id) {
    renderButton();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = renderButton;
  script.onerror = () => showGuardianPasswordStatus(
    "Layanan login pengelola tidak dapat dimuat. Periksa koneksi internet.",
    true
  );
  document.head.append(script);
}

guardianPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const passwordInput = document.querySelector("#credential-password");
  const confirmInput = document.querySelector("#credential-password-confirm");
  if (passwordInput.value !== confirmInput.value) {
    showGuardianPasswordStatus("Kata sandi yang dimasukkan belum sama.", true);
    confirmInput.focus();
    return;
  }

  submitButton.disabled = true;
  showGuardianPasswordStatus("Menyimpan kredensial secara aman…");
  try {
    await adminPortalRequest("set-guardian-password", {
      studentId: document.querySelector("#credential-student-id").value.trim(),
      guardianEmail: document.querySelector("#credential-guardian-email").value.trim(),
      password: passwordInput.value,
    });
    form.reset();
    showGuardianPasswordStatus("Kata sandi tersimpan. Bagikan kepada wali melalui saluran privat.");
  } catch (error) {
    console.error(error);
    passwordInput.value = "";
    confirmInput.value = "";
    showGuardianPasswordStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#guardian-password-logout").addEventListener("click", () => {
  adminIdToken = "";
  guardianPasswordForm.reset();
  guardianPasswordForm.hidden = true;
  guardianPasswordGoogleButton.hidden = false;
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  showGuardianPasswordStatus("Anda telah keluar dari pengaturan kata sandi.");
});

initializeGuardianPasswordManagement();
document.querySelector("#current-year").textContent = String(new Date().getFullYear());
