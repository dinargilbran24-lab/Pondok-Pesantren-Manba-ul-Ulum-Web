const portalConfig = window.PORTAL_CONFIG || {};
const notice = document.querySelector("#portal-notice");
const loginPanel = document.querySelector("#portal-login");
const portalApp = document.querySelector("#portal-app");
const studentPicker = document.querySelector("#student-picker");
let sessionToken = "";
let accessibleStudentIds = [];
let activeStudentId = "";

document.querySelector("#current-year").textContent = String(new Date().getFullYear());

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("portal-notice-error", isError);
  notice.hidden = !message;
}

function valueText(value, fallback = "Belum tersedia") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function formatDate(value) {
  if (!value) return "Tanggal belum tersedia";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function clearStudentData() {
  activeStudentId = "";
  accessibleStudentIds = [];
  document.querySelector("#portal-student-data").hidden = true;
  document.querySelector("#student-picker-wrap").hidden = true;
  studentPicker.replaceChildren();
  document.querySelector("#student-count").textContent = "";
  document.querySelector("#student-overview").replaceChildren();
  ["#attendance-list", "#payments-list", "#grades-list", "#announcements-list", "#messages-list"]
    .forEach((selector) => document.querySelector(selector).replaceChildren());
}

function renderRecords(container, records, type) {
  container.replaceChildren();
  if (!records.length) {
    container.append(makeElement("p", "portal-empty", "Belum ada informasi untuk ditampilkan."));
    return;
  }

  records.forEach((record) => {
    const item = makeElement("article", "portal-record");
    const title = type === "attendance" ? "Kehadiran"
      : type === "payments" ? valueText(record.title, "Tagihan")
        : type === "grades" ? valueText(record.subject, "Mata pelajaran")
          : type === "announcements" ? valueText(record.title, "Pengumuman")
            : valueText(record.category, "Pesan");
    item.append(makeElement("h3", "", title));

    const details = [];
    if (type === "attendance") {
      details.push(`${formatDate(record.date)} · ${valueText(record.status)}`);
      if (record.note) details.push(String(record.note));
    } else if (type === "payments") {
      const amount = typeof record.amount === "number"
        ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(record.amount)
        : valueText(record.amount);
      details.push(`${amount} · ${valueText(record.status)}`);
      if (record.dueDate) details.push(`Jatuh tempo ${formatDate(record.dueDate)}`);
      if (record.paidAt) details.push(`Dibayar ${formatDate(record.paidAt)}`);
    } else if (type === "grades") {
      details.push(`${valueText(record.period, "Periode belum tersedia")} · Nilai ${valueText(record.score)}`);
      if (record.note) details.push(String(record.note));
    } else if (type === "announcements") {
      details.push(formatDate(record.createdAt));
      if (record.body) details.push(String(record.body));
    } else {
      details.push(String(record.body || ""));
      details.push(`Status: ${valueText(record.status)}`);
      if (record.reply) details.push(`Balasan pengurus: ${String(record.reply)}`);
      if (record.createdAt) details.push(formatDate(record.createdAt));
    }

    details.forEach((detail) => item.append(makeElement("p", "portal-record-detail", detail)));
    container.append(item);
  });
}

function renderDashboard(dashboard) {
  const student = dashboard.student;
  const overview = document.querySelector("#student-overview");
  overview.replaceChildren();
  overview.append(makeElement("p", "eyebrow", "Informasi santri"));
  overview.append(makeElement("h2", "", valueText(student.name, "Nama belum tersedia")));
  const metadata = [student.className, student.dormitory, student.status]
    .filter(Boolean)
    .map(String);
  overview.append(makeElement("p", "portal-muted", metadata.join(" · ") || "Rincian santri belum tersedia."));
  renderRecords(document.querySelector("#attendance-list"), dashboard.attendance || [], "attendance");
  renderRecords(document.querySelector("#payments-list"), dashboard.payments || [], "payments");
  renderRecords(document.querySelector("#grades-list"), dashboard.grades || [], "grades");
  renderRecords(document.querySelector("#announcements-list"), dashboard.announcements || [], "announcements");
  renderRecords(document.querySelector("#messages-list"), dashboard.messages || [], "messages");
}

function portalRequest(operation, extra = {}) {
  return new Promise((resolve, reject) => {
    if (operation !== "login" && !sessionToken) {
      reject(new Error("Masuk dengan nomor induk dan kata sandi untuk melanjutkan."));
      return;
    }

    const nonce = crypto.randomUUID();
    const frameName = `portal-response-${nonce}`;
    const frame = document.createElement("iframe");
    frame.name = frameName;
    frame.title = "Respons privat Portal Wali";
    frame.hidden = true;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = portalConfig.appsScriptUrl;
    form.target = frameName;
    form.hidden = true;

    const payload = {
      action: "guardian-portal",
      operation,
      nonce,
      origin: window.location.origin,
      sessionToken,
      ...extra,
    };
    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
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
          || "Permintaan portal tidak berhasil diproses."));
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

async function loadStudent(studentId) {
  if (!accessibleStudentIds.includes(studentId)) return;
  activeStudentId = studentId;
  ["#attendance-list", "#payments-list", "#grades-list", "#announcements-list", "#messages-list"]
    .forEach((selector) => document.querySelector(selector).replaceChildren(makeElement("p", "portal-empty", "Memuat…")));
  try {
    const result = await portalRequest("dashboard", { studentId });
    if (activeStudentId !== studentId) return;
    renderDashboard(result.dashboard);
    showNotice("");
    return true;
  } catch (error) {
    console.error(error);
    showNotice(error.message, true);
    return false;
  }
}

function initializePortal() {
  if (typeof portalConfig.appsScriptUrl !== "string" || !portalConfig.appsScriptUrl.trim()) {
    loginPanel.hidden = true;
    showNotice("Portal belum aktif. Pengelola perlu mengisi URL Apps Script di portal-config.js.", true);
    return;
  }
  try {
    const appUrl = new URL(portalConfig.appsScriptUrl);
    if (appUrl.protocol !== "https:" || appUrl.hostname !== "script.google.com"
      || !/^\/macros\/s\/[^/]+\/exec$/.test(appUrl.pathname)) {
      throw new Error("URL Web App Apps Script belum benar.");
    }
  } catch (error) {
    loginPanel.hidden = true;
    showNotice(error.message || "URL Web App Apps Script belum benar.", true);
    return;
  }

  loginPanel.hidden = false;
  showNotice("Masuk dengan nomor induk santri dan kata sandi yang diberikan pengelola.");
}

async function finishLogin(result) {
  sessionToken = result.sessionToken;
  if (typeof sessionToken !== "string" || sessionToken.length < 100) {
    sessionToken = "";
    throw new Error("Sesi login tidak valid. Silakan coba lagi.");
  }

  const students = Array.isArray(result.students) ? result.students : [];
  accessibleStudentIds = students.map((student) => student.id);
  if (!students.length) {
    sessionToken = "";
    throw new Error("Akun ini belum ditautkan ke data santri. Hubungi pengelola pesantren.");
  }

  document.querySelector("#student-login-password").value = "";
  document.querySelector("#guardian-email").textContent = result.email || "Wali santri";
  document.querySelector("#student-count").textContent =
    `${students.length} santri terhubung ke akun ini.`;
  const pickerWrap = document.querySelector("#student-picker-wrap");
  pickerWrap.hidden = students.length < 2;
  studentPicker.replaceChildren();
  students.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    studentPicker.append(option);
  });
  loginPanel.hidden = true;
  portalApp.hidden = false;
  document.querySelector("#portal-student-data").hidden = false;
  await loadStudent(students[0].id);
}

document.querySelector("#portal-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const studentId = document.querySelector("#student-login-id").value.trim();
  const passwordInput = document.querySelector("#student-login-password");
  submitButton.disabled = true;
  showNotice("Memeriksa akses akun…");
  try {
    const result = await portalRequest("login", { studentId, password: passwordInput.value });
    await finishLogin(result);
  } catch (error) {
    console.error(error);
    passwordInput.value = "";
    showNotice(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  let logoutError = null;
  try {
    await portalRequest("logout");
  } catch (error) {
    console.error(error);
    logoutError = error;
  }
  sessionToken = "";
  clearStudentData();
  portalApp.hidden = true;
  loginPanel.hidden = false;
  if (logoutError) {
    showNotice("Anda telah keluar dari perangkat ini, tetapi sesi server belum dapat ditutup. Sesi tersebut akan kedaluwarsa otomatis.", true);
  } else {
    showNotice("Anda telah keluar dari Portal Wali.");
  }
});

studentPicker.addEventListener("change", () => {
  if (accessibleStudentIds.includes(studentPicker.value)) {
    loadStudent(studentPicker.value);
  }
});

document.querySelector("#message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeStudentId || !accessibleStudentIds.includes(activeStudentId)) {
    showNotice("Masuk kembali untuk mengirim pesan.", true);
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const category = document.querySelector("#message-category").value;
  const body = document.querySelector("#message-body").value.trim();
  if (!body) {
    showNotice("Isi pesan terlebih dahulu.", true);
    return;
  }

  submitButton.disabled = true;
  const targetStudentId = activeStudentId;
  try {
    await portalRequest("send-message", { studentId: targetStudentId, category, body });
    form.reset();
    if (await loadStudent(targetStudentId)) {
      showNotice("Pesan terkirim kepada pengelola.");
    }
  } catch (error) {
    console.error(error);
    showNotice(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

initializePortal();
