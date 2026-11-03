const adminConfig = window.REGISTRATION_CONFIG || {};
const portalConfig = window.PORTAL_CONFIG || {};
const databaseStatus = document.querySelector("#database-status");
const databaseLink = document.querySelector("#database-link");
const spreadsheetUrl = adminConfig.adminSpreadsheetUrl;
const adminLoginPanel = document.querySelector("#admin-login-panel");
const adminLoginForm = document.querySelector("#admin-login-form");
const adminLoginStatus = document.querySelector("#admin-login-status");
const adminTools = document.querySelector("#admin-tools");
const guardianPasswordStatus = document.querySelector("#guardian-password-status");
const guardianPasswordForm = document.querySelector("#guardian-password-form");
const managementStatus = document.querySelector("#management-status");
const managementPanel = document.querySelector("#admin-portal-management");
const managementEntityPicker = document.querySelector("#management-entity");
const managementList = document.querySelector("#management-list");
const managementForm = document.querySelector("#management-form");
const managementFields = document.querySelector("#management-fields");
let adminSessionToken = "";
let portalRecords = {};
let editingRecord = null;

const MANAGEMENT_ENTITIES = {
  students: {
    label: "Data santri",
    key: (record) => record.studentId,
    fields: [
      { name: "studentId", label: "Nomor induk santri", type: "text", required: true, maxLength: 64 },
      { name: "name", label: "Nama lengkap", type: "text", required: true, maxLength: 200 },
      { name: "className", label: "Kelas", type: "text", required: true, maxLength: 100 },
      { name: "dormitory", label: "Asrama", type: "text", maxLength: 100 },
      { name: "status", label: "Status", type: "select", options: ["Aktif", "Nonaktif"], required: true },
    ],
  },
  guardians: {
    label: "Akses wali",
    key: (record) => [record.email, record.studentId],
    fields: [
      { name: "email", label: "Email wali", type: "email", required: true, maxLength: 254 },
      { name: "studentId", label: "Santri", type: "student", required: true },
      { name: "status", label: "Status akses", type: "select", options: ["Aktif", "Nonaktif"], required: true },
    ],
  },
  attendance: {
    label: "Presensi",
    key: (record) => record.id,
    fields: [
      { name: "studentId", label: "Santri", type: "student", required: true },
      { name: "date", label: "Tanggal", type: "date", required: true },
      { name: "status", label: "Kehadiran", type: "select", options: ["Hadir", "Izin", "Sakit", "Alpha"], required: true },
      { name: "note", label: "Catatan", type: "textarea", maxLength: 1000 },
    ],
  },
  payments: {
    label: "Tagihan dan pembayaran",
    key: (record) => record.id,
    fields: [
      { name: "studentId", label: "Santri", type: "student", required: true },
      { name: "title", label: "Nama tagihan", type: "text", required: true, maxLength: 200 },
      { name: "amount", label: "Jumlah (rupiah)", type: "number", required: true, min: 0, step: 1 },
      { name: "status", label: "Status pembayaran", type: "select", options: ["Belum Lunas", "Cicilan", "Lunas"], required: true },
      { name: "dueDate", label: "Jatuh tempo", type: "date" },
      { name: "paidAt", label: "Tanggal pembayaran", type: "date" },
    ],
  },
  grades: {
    label: "Akademik",
    key: (record) => record.id,
    fields: [
      { name: "studentId", label: "Santri", type: "student", required: true },
      { name: "subject", label: "Mata pelajaran", type: "text", required: true, maxLength: 200 },
      { name: "period", label: "Periode", type: "text", required: true, maxLength: 100 },
      { name: "score", label: "Nilai", type: "text", required: true, maxLength: 100 },
      { name: "note", label: "Catatan", type: "textarea", maxLength: 1000 },
    ],
  },
  announcements: {
    label: "Pengumuman",
    key: (record) => record.id,
    fields: [
      { name: "title", label: "Judul", type: "text", required: true, maxLength: 200 },
      { name: "body", label: "Isi pengumuman", type: "textarea", required: true, maxLength: 5000 },
      { name: "published", label: "Publikasi", type: "select", options: ["Ya", "Tidak"], required: true },
      { name: "createdAt", label: "Tanggal dan waktu terbit", type: "datetime-local", required: true },
    ],
  },
  messages: {
    label: "Pesan wali",
    key: (record) => record.id,
    fields: [
      { name: "status", label: "Status tindak lanjut", type: "select", options: ["Baru", "Diproses", "Selesai"], required: true },
      { name: "reply", label: "Balasan pengurus", type: "textarea", maxLength: 2000 },
    ],
  },
};

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

function showAdminLoginStatus(message, isError = false) {
  adminLoginStatus.textContent = message;
  adminLoginStatus.classList.toggle("admin-error", isError);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
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
      adminSessionToken,
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

async function showGuardianPasswordForm(response) {
  adminSessionToken = response.adminSessionToken;
  if (typeof adminSessionToken !== "string" || adminSessionToken.length < 100) {
    adminSessionToken = "";
    throw new Error("Sesi pengelola tidak valid. Silakan coba lagi.");
  }
  showAdminLoginStatus("Memuat menu pengelolaan…");
  try {
    const result = await adminPortalRequest("admin-list");
    portalRecords = result.records || {};
    adminLoginPanel.hidden = true;
    adminTools.hidden = false;
    adminTools.classList.remove("admin-tools-hidden");
    guardianPasswordForm.hidden = false;
    managementPanel.hidden = false;
    showAdminLoginStatus("Pengelola berhasil login.");
    showGuardianPasswordStatus("Buat atau ganti kata sandi wali yang sudah terhubung ke santri.");
    setManagementStatus("Data Portal Wali berhasil dimuat.");
    renderManagementList();
  } catch (error) {
    console.error(error);
    adminSessionToken = "";
    showAdminLoginStatus(error.message, true);
  }
}

function initializeAdminLogin() {
  if (window.location.protocol !== "https:" || window.location.origin === "null") {
    adminLoginForm.hidden = true;
    showAdminLoginStatus(
      "Halaman Admin harus dibuka dari situs HTTPS yang sudah dipublikasikan. File lokal (file://) tidak didukung; pastikan origin situs terdaftar di PORTAL_ALLOWED_ORIGIN Apps Script.",
      true
    );
    return;
  }

  const appUrl = adminConfig.appsScriptUrl || portalConfig.appsScriptUrl;
  if (typeof appUrl !== "string" || !appUrl.trim()) {
    adminLoginForm.hidden = true;
    showAdminLoginStatus("Konfigurasi belum lengkap. Atur URL Apps Script di portal-config.js.", true);
    return;
  }

  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com"
      || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
      throw new Error("URL Web App Apps Script belum benar.");
    }
  } catch (error) {
    adminLoginForm.hidden = true;
    showAdminLoginStatus(error.message, true);
    return;
  }

  showAdminLoginStatus("Masuk dengan nama pengguna dan kata sandi pengelola.");
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const passwordInput = document.querySelector("#admin-password");
  submitButton.disabled = true;
  showAdminLoginStatus("Memeriksa login pengelola…");
  try {
    const result = await adminPortalRequest("admin-login", {
      username: document.querySelector("#admin-username").value.trim(),
      password: passwordInput.value,
    });
    passwordInput.value = "";
    await showGuardianPasswordForm(result);
  } catch (error) {
    console.error(error);
    passwordInput.value = "";
    showAdminLoginStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

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

function setManagementStatus(message, isError = false) {
  managementStatus.textContent = message;
  managementStatus.classList.toggle("admin-error", isError);
}

function currentManagementEntity() {
  return managementEntityPicker.value;
}

function currentRecords(entityName = currentManagementEntity()) {
  return Array.isArray(portalRecords[entityName]) ? portalRecords[entityName] : [];
}

function createManagementField(field, value = "", disabled = false) {
  const wrapper = document.createElement("div");
  wrapper.className = field.type === "textarea"
    ? "admin-management-field admin-management-field-wide"
    : "admin-management-field";
  const id = `management-field-${field.name}`;
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = field.label;
  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = 3;
  } else if (field.type === "select" || field.type === "student") {
    input = document.createElement("select");
    const options = field.type === "student"
      ? currentRecords("students").map((student) => [student.studentId, `${student.name} — ${student.studentId}`])
      : field.options.map((option) => [option, option]);
    input.add(new Option("Pilih…", ""));
    options.forEach(([optionValue, optionLabel]) => input.add(new Option(optionLabel, optionValue)));
    if (value && !options.some(([optionValue]) => optionValue === String(value))) {
      input.add(new Option(String(value), String(value)));
    }
  } else {
    input = document.createElement("input");
    input.type = field.type;
  }
  input.id = id;
  input.name = field.name;
  input.required = Boolean(field.required);
  input.disabled = disabled;
  if (field.maxLength) input.maxLength = field.maxLength;
  if (field.min !== undefined) input.min = String(field.min);
  if (field.step !== undefined) input.step = String(field.step);
  if (value) {
    input.value = field.type === "datetime-local" ? String(value).slice(0, 16) : String(value);
  }
  wrapper.append(label, input);
  return wrapper;
}

function getManagementSummary(entityName, record) {
  if (entityName === "students") return `${record.name} · ${record.className} · ${record.status}`;
  if (entityName === "guardians") return `${record.email} → ${findStudentName(record.studentId)} · ${record.status}`;
  if (entityName === "attendance") return `${findStudentName(record.studentId)} · ${record.date} · ${record.status}`;
  if (entityName === "payments") return `${findStudentName(record.studentId)} · ${record.title} · Rp ${record.amount} · ${record.status}`;
  if (entityName === "grades") return `${findStudentName(record.studentId)} · ${record.subject} · ${record.period} · Nilai ${record.score}`;
  if (entityName === "announcements") return `${record.title} · ${record.published === "Ya" ? "Terbit" : "Draf"}`;
  return `${findStudentName(record.studentId)} · ${record.email} · ${record.category} · ${record.status}`;
}

function findStudentName(studentId) {
  const student = currentRecords("students").find((record) => record.studentId === studentId);
  return student ? `${student.name} (${studentId})` : studentId;
}

function renderManagementList() {
  const entityName = currentManagementEntity();
  document.querySelector("#management-add").hidden = entityName === "messages";
  managementList.replaceChildren();
  const records = currentRecords(entityName);
  if (!records.length) {
    managementList.append(makeElement("p", "portal-empty", "Belum ada data untuk kategori ini."));
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("article");
    item.className = "admin-record";
    const detail = document.createElement("div");
    detail.className = "admin-record-copy";
    const title = document.createElement("h3");
    title.textContent = getManagementSummary(entityName, record);
    detail.append(title);
    if (entityName === "messages") {
      const body = document.createElement("p");
      body.textContent = record.body;
      detail.append(body);
      if (record.reply) {
        const reply = document.createElement("p");
        reply.textContent = `Balasan: ${record.reply}`;
        detail.append(reply);
      }
    } else if (entityName === "announcements") {
      const body = document.createElement("p");
      body.textContent = record.body;
      detail.append(body);
    } else if (entityName === "attendance" && record.note) {
      const note = document.createElement("p");
      note.textContent = record.note;
      detail.append(note);
    } else if (entityName === "grades" && record.note) {
      const note = document.createElement("p");
      note.textContent = record.note;
      detail.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "admin-record-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "portal-outline-button";
    editButton.textContent = entityName === "messages" ? "Balas / ubah status" : "Ubah";
    editButton.addEventListener("click", () => openManagementEditor(record));
    actions.append(editButton);
    if (entityName !== "messages") {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "portal-outline-button admin-delete-button";
      deleteButton.textContent = "Hapus";
      deleteButton.addEventListener("click", () => deleteManagementRecord(record));
      actions.append(deleteButton);
    }
    item.append(detail, actions);
    managementList.append(item);
  });
}

function openManagementEditor(record = null) {
  const entityName = currentManagementEntity();
  const fields = MANAGEMENT_ENTITIES[entityName].fields;
  editingRecord = record;
  managementFields.replaceChildren();
  document.querySelector("#management-form-title").textContent =
    `${record ? "Ubah" : "Tambah"} ${MANAGEMENT_ENTITIES[entityName].label.toLowerCase()}`;
  if (entityName === "messages" && record) {
    const context = document.createElement("p");
    context.className = "portal-muted";
    context.textContent = `Pesan dari ${record.email}: ${record.body}`;
    managementFields.append(context);
  }
  fields.forEach((field) => {
    const lockedStudentId = entityName === "students" && field.name === "studentId" && record;
    const defaultValue = entityName === "announcements" && field.name === "createdAt" && !record
      ? new Date().toISOString().slice(0, 16)
      : "";
    managementFields.append(createManagementField(
      field,
      record ? record[field.name] : defaultValue,
      Boolean(lockedStudentId)
    ));
  });
  managementForm.hidden = false;
  managementForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshManagementRecords() {
  setManagementStatus("Memuat data kepengurusan…");
  try {
    const result = await adminPortalRequest("admin-list");
    portalRecords = result.records || {};
    renderManagementList();
    setManagementStatus("Data Portal Wali berhasil dimuat.");
  } catch (error) {
    console.error(error);
    setManagementStatus(error.message, true);
  }
}

async function deleteManagementRecord(record) {
  const entityName = currentManagementEntity();
  if (!window.confirm(`Hapus data ${getManagementSummary(entityName, record)}?`)) return;
  setManagementStatus("Menghapus data…");
  try {
    const key = MANAGEMENT_ENTITIES[entityName].key(record);
    const result = await adminPortalRequest("admin-delete", { entity: entityName, key });
    portalRecords = result.records || {};
    renderManagementList();
    setManagementStatus("Data berhasil dihapus.");
  } catch (error) {
    console.error(error);
    setManagementStatus(error.message, true);
  }
}

managementEntityPicker.addEventListener("change", () => {
  managementForm.hidden = true;
  editingRecord = null;
  renderManagementList();
});

document.querySelector("#management-add").addEventListener("click", () => openManagementEditor());
document.querySelector("#management-refresh").addEventListener("click", refreshManagementRecords);
document.querySelector("#management-cancel").addEventListener("click", () => {
  managementForm.reset();
  managementForm.hidden = true;
  editingRecord = null;
});

managementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const entityName = currentManagementEntity();
  const record = editingRecord ? { ...editingRecord } : {};
  MANAGEMENT_ENTITIES[entityName].fields.forEach((field) => {
    const input = managementForm.elements.namedItem(field.name);
    record[field.name] = input ? input.value.trim() : "";
  });
  if (entityName !== "messages" && entityName !== "students" && entityName !== "guardians"
    && !editingRecord) {
    record.id = crypto.randomUUID();
  }
  if (entityName === "announcements" && !editingRecord) {
    record.id = crypto.randomUUID();
  }

  const submitButton = managementForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setManagementStatus("Menyimpan perubahan…");
  try {
    const originalKey = editingRecord ? MANAGEMENT_ENTITIES[entityName].key(editingRecord) : null;
    const result = await adminPortalRequest("admin-save", { entity: entityName, record, originalKey });
    portalRecords = result.records || {};
    managementForm.reset();
    managementForm.hidden = true;
    editingRecord = null;
    renderManagementList();
    setManagementStatus("Perubahan berhasil disimpan.");
  } catch (error) {
    console.error(error);
    setManagementStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

function logoutAdminManagement() {
  const sessionToken = adminSessionToken;
  adminSessionToken = "";
  portalRecords = {};
  editingRecord = null;
  guardianPasswordForm.reset();
  guardianPasswordForm.hidden = true;
  adminLoginForm.reset();
  adminTools.hidden = true;
  adminTools.classList.add("admin-tools-hidden");
  adminLoginPanel.hidden = false;
  managementPanel.hidden = true;
  managementForm.hidden = true;
  showAdminLoginStatus("Anda telah keluar. Login kembali untuk membuka menu Admin.");
  if (sessionToken) {
    adminPortalRequest("admin-logout", { adminSessionToken: sessionToken })
      .catch((error) => console.error("Could not close the admin session:", error));
  }
}

document.querySelector("#admin-portal-logout").addEventListener("click", logoutAdminManagement);

initializeAdminLogin();
document.querySelector("#current-year").textContent = String(new Date().getFullYear());
