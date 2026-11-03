const FIELD_NAMES = [
  "id",
  "kategoriPendaftaran",
  "namaLengkap",
  "nikPeserta",
  "jenisKelamin",
  "tempatLahir",
  "tanggalLahir",
  "alamatLengkap",
  "kecamatan",
  "kabupaten",
  "provinsi",
  "kodePos",
  "namaAyah",
  "nikAyah",
  "pendidikanAyah",
  "pekerjaanAyah",
  "hpAyah",
  "namaIbu",
  "nikIbu",
  "pendidikanIbu",
  "pekerjaanIbu",
  "hpIbu",
  "tingkatPendidikan",
  "namaSekolahAsal",
  "npsn",
  "alasan",
  "namaOrangTuaTtd",
  "tglFormulir",
  "persetujuanPemrosesanData",
];

const REQUIRED_FIELDS = [
  "namaLengkap",
  "nikPeserta",
  "jenisKelamin",
  "tempatLahir",
  "tanggalLahir",
  "alamatLengkap",
  "kecamatan",
  "kabupaten",
  "provinsi",
  "namaAyah",
  "nikAyah",
  "pendidikanAyah",
  "hpAyah",
  "namaIbu",
  "nikIbu",
  "pendidikanIbu",
  "hpIbu",
  "tingkatPendidikan",
  "namaSekolahAsal",
  "npsn",
  "alasan",
  "persetujuanPemrosesanData",
];

const FILE_FIELDS = {
  KK: "Kartu Keluarga",
  Akte: "Akte Kelahiran",
  Ijazah_SKL: "Ijazah / SKL",
  KTP_Ayah: "KTP Ayah",
  KTP_Ibu: "KTP Ibu",
};

const PORTAL_SHEETS = {
  "Portal Wali": ["Email Wali", "ID Santri", "Status Akses"],
  "Akun Portal": ["ID Santri", "Email Wali", "Salt Kata Sandi", "Hash Kata Sandi", "Status Akses"],
  "Data Santri": ["ID Santri", "Nama Santri", "Kelas", "Asrama", "Status"],
  "Presensi": ["ID", "ID Santri", "Tanggal", "Status", "Catatan"],
  "Tagihan": ["ID", "ID Santri", "Nama Tagihan", "Jumlah", "Status", "Jatuh Tempo", "Tanggal Bayar"],
  "Akademik": ["ID", "ID Santri", "Mata Pelajaran", "Periode", "Nilai", "Catatan"],
  "Pengumuman": ["ID", "Judul", "Isi", "Terbit", "Waktu Terbit"],
  "Pesan Wali": ["ID Pesan", "ID Santri", "Email Wali", "Topik", "Pesan", "Status", "Balasan", "Waktu Kirim"],
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const PORTAL_PASSWORD_HASH_ITERATIONS = 120000;
const PORTAL_SESSION_SECONDS = 21600;
const PORTAL_LOGIN_MAX_ATTEMPTS = 5;
const PORTAL_LOGIN_LOCK_SECONDS = 900;

function setupRegistrationStorage() {
  const properties = PropertiesService.getScriptProperties();
  let folderId = properties.getProperty("DRIVE_FOLDER_ID");
  let spreadsheetId = properties.getProperty("SPREADSHEET_ID");

  if (!folderId) {
    folderId = DriveApp.createFolder("Manba'ul Ulum - Dokumen Pendaftaran").getId();
    properties.setProperty("DRIVE_FOLDER_ID", folderId);
  }

  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create("Database Pendaftaran Santri - Manba'ul Ulum");
    spreadsheetId = spreadsheet.getId();
    properties.setProperty("SPREADSHEET_ID", spreadsheetId);
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Pendaftar")
    || SpreadsheetApp.openById(spreadsheetId).insertSheet("Pendaftar");

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ID Pendaftaran",
      "Waktu Daftar",
      "Status Pendaftaran",
      ...FIELD_NAMES,
      ...Object.keys(FILE_FIELDS).map((key) => `File ${FILE_FIELDS[key]} (ID Drive)`),
    ]);
  } else {
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!header.includes("Status Pendaftaran")) {
      sheet.insertColumnAfter(2);
      sheet.getRange(1, 3).setValue("Status Pendaftaran");
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 3, sheet.getLastRow() - 1, 1)
          .setValues(Array.from({ length: sheet.getLastRow() - 1 }, () => ["Menunggu verifikasi"]));
      }
    }
  }

  setupPortalSheets_(SpreadsheetApp.openById(spreadsheetId));
  console.log(`Spreadsheet: ${SpreadsheetApp.openById(spreadsheetId).getUrl()}`);
  console.log(`Folder Drive (privat): https://drive.google.com/drive/folders/${folderId}`);
}

function doPost(event) {
  const createdFileIds = [];
  let lock;
  let request = {};
  let responseType = "manbaul-registration";
  let responseOrigin = "";

  try {
    if (!event || !event.postData || !event.postData.contents) {
      throw new Error("Permintaan tidak valid.");
    }

    const parameters = event.parameter || {};
    request = JSON.parse(parameters.payload || event.postData.contents);
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error("Permintaan tidak valid.");
    }
    const nonce = request.nonce || parameters.nonce || "";
    request.nonce = /^[0-9a-f-]{36}$/i.test(nonce) ? nonce : "";
    if (request.action === "guardian-portal") {
      responseType = "manbaul-portal";
      responseOrigin = typeof request.origin === "string" ? request.origin : "";
      if (!request.nonce) {
        throw new Error("Permintaan portal tidak valid.");
      }
      return htmlResponse_(handleGuardianPortalRequest_(request), request.nonce, responseType, responseOrigin);
    }
    if (request.website) {
      throw new Error("Permintaan ditolak.");
    }

    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    const folderId = properties.getProperty("DRIVE_FOLDER_ID");
    const recaptchaSecret = properties.getProperty("RECAPTCHA_SECRET");
    if (!spreadsheetId || !folderId || !recaptchaSecret) {
      throw new Error("Backend belum dikonfigurasi oleh pengelola.");
    }

    validateFields_(request.fields);
    const submissionId = request.fields.id;
    if (typeof submissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
      throw new Error("ID pendaftaran tidak valid.");
    }

    const cache = CacheService.getScriptCache();
    if (cache.get(`submission:${submissionId}`) === "success") {
      return htmlResponse_({ status: "success", submissionId }, request.nonce);
    }

    verifyRecaptcha_(request.captchaToken, recaptchaSecret);
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Pendaftar");
    if (!sheet) {
      throw new Error("Sheet pendaftaran tidak ditemukan.");
    }

    if (cache.get(`submission:${submissionId}`) === "success") {
      return htmlResponse_({ status: "success", submissionId }, request.nonce);
    }
    if (sheet.getLastRow() > 1
      && sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .createTextFinder(submissionId)
        .matchEntireCell(true)
        .findNext()) {
      cache.put(`submission:${submissionId}`, "success", 21600);
      return htmlResponse_({ status: "success", submissionId }, request.nonce);
    }

    const submittedAt = new Date();
    const folder = DriveApp.getFolderById(folderId);
    const fileIds = saveFiles_(request.files || {}, folder, submissionId, createdFileIds);

    const row = [
      submissionId,
      submittedAt,
      "Menunggu verifikasi",
      ...FIELD_NAMES.map((name) => safeCellValue_(request.fields[name] || "")),
      ...Object.keys(FILE_FIELDS).map((key) => fileIds[key] || ""),
    ];
    const target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
    target.setNumberFormat("@");
    target.setValues([row]);
    target.getCell(1, 2).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    cache.put(`submission:${submissionId}`, "success", 21600);

    return htmlResponse_({ status: "success", submissionId }, request.nonce);
  } catch (error) {
    createdFileIds.forEach((fileId) => {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (cleanupError) {
        console.error(`Could not remove an incomplete upload: ${cleanupError.message}`);
      }
    });
    console.error(error.message);
    const nonceCandidate = request.nonce || (event && event.parameter && event.parameter.nonce) || "";
    const nonce = /^[0-9a-f-]{36}$/i.test(nonceCandidate)
      ? nonceCandidate
      : "";
    return htmlResponse_(
      { status: "error", error: error.message || "Permintaan gagal diproses." },
      nonce,
      responseType,
      responseOrigin
    );
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function setupPortalSheets_(spreadsheet) {
  Object.keys(PORTAL_SHEETS).forEach((name) => {
    const expectedHeaders = PORTAL_SHEETS[name];
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(expectedHeaders);
      return;
    }

    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const matches = expectedHeaders.every((header, index) => actualHeaders[index] === header);
    if (!matches) {
      throw new Error(`Kolom pada sheet "${name}" tidak sesuai. Periksa panduan portal wali sebelum menjalankan setup kembali.`);
    }
  });
}

function handleGuardianPortalRequest_(request) {
  if (!isAllowedPortalOrigin_(request.origin)) {
    throw new Error("Portal belum dikonfigurasi untuk alamat website ini.");
  }

  if (request.operation === "login") {
    return loginPortalGuardian_(request.studentId, request.password);
  }

  if (request.operation === "set-guardian-password") {
    const administrator = verifyGoogleIdToken_(request.adminIdToken);
    if (!isPortalAdministrator_(administrator.email)) {
      throw new Error("Akun Google ini tidak diizinkan mengatur akses Portal Wali.");
    }
    setGuardianPassword_(request.studentId, request.guardianEmail, request.password);
    return { status: "success" };
  }

  const email = getPortalSessionEmail_(request.sessionToken);
  if (request.operation === "logout") {
    removePortalSession_(request.sessionToken);
    return { status: "success" };
  }

  const students = getGuardianStudents_(email);
  if (typeof request.studentId !== "string"
    || !students.some((student) => student.id === request.studentId)) {
    throw new Error("Akun ini tidak memiliki akses ke data santri yang diminta.");
  }

  if (request.operation === "dashboard") {
    return {
      status: "success",
      dashboard: getPortalDashboard_(email, request.studentId),
    };
  }

  if (request.operation === "send-message") {
    saveGuardianMessage_(email, request.studentId, request.category, request.body);
    return { status: "success" };
  }

  throw new Error("Jenis permintaan portal tidak dikenal.");
}

function loginPortalGuardian_(studentId, password) {
  const normalizedStudentId = typeof studentId === "string" ? studentId.trim() : "";
  const attemptKey = getPortalLoginAttemptKey_(normalizedStudentId);
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(attemptKey) || 0);
  if (attempts >= PORTAL_LOGIN_MAX_ATTEMPTS) {
    throw new Error("Nomor induk atau kata sandi tidak benar, atau akses sementara dibatasi. Coba lagi nanti.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(normalizedStudentId)) {
    recordPortalLoginFailure_(attemptKey);
    throw new Error("Nomor induk atau kata sandi tidak benar, atau akses sementara dibatasi. Coba lagi nanti.");
  }

  const credentials = getSheetRecords_("Akun Portal").find((row) =>
    String(row["ID Santri"] || "").trim() === normalizedStudentId
    && String(row["Status Akses"] || "").trim().toLowerCase() === "aktif");
  const salt = credentials ? String(credentials["Salt Kata Sandi"] || "") : "portal-login-invalid-user";
  const storedHash = credentials ? String(credentials["Hash Kata Sandi"] || "") : "";
  const validPassword = typeof password === "string"
    && password.length >= 12
    && password.length <= 128
    && constantTimeEquals_(derivePortalPasswordHash_(password, salt), storedHash);
  const email = credentials ? String(credentials["Email Wali"] || "").trim().toLowerCase() : "";
  const students = validPassword && email ? getGuardianStudents_(email) : [];
  const linkedStudent = students.some((student) => student.id === normalizedStudentId);

  if (!validPassword || !email || !linkedStudent) {
    recordPortalLoginFailure_(attemptKey);
    throw new Error("Nomor induk atau kata sandi tidak benar, atau akses sementara dibatasi. Coba lagi nanti.");
  }

  cache.remove(attemptKey);
  const sessionToken = createPortalSession_(email);
  return { status: "success", sessionToken, email, students };
}

function getPortalLoginAttemptKey_(studentId) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(studentId).toLowerCase()
  );
  return `portal-login:${Utilities.base64EncodeWebSafe(digest)}`;
}

function recordPortalLoginFailure_(attemptKey) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const attempts = Number(cache.get(attemptKey) || 0);
    cache.put(attemptKey, String(attempts + 1), PORTAL_LOGIN_LOCK_SECONDS);
  } finally {
    lock.releaseLock();
  }
}

function createPortalSession_(email) {
  const token = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join("");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const key = `portal-session:${Utilities.base64EncodeWebSafe(digest)}`;
  CacheService.getScriptCache().put(key, email, PORTAL_SESSION_SECONDS);
  return token;
}

function getPortalSessionEmail_(token) {
  if (typeof token !== "string" || token.length < 100 || token.length > 256) {
    throw new Error("Sesi portal berakhir. Silakan masuk kembali.");
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const key = `portal-session:${Utilities.base64EncodeWebSafe(digest)}`;
  const email = CacheService.getScriptCache().get(key);
  if (!email) {
    throw new Error("Sesi portal berakhir. Silakan masuk kembali.");
  }
  return email;
}

function removePortalSession_(token) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  CacheService.getScriptCache().remove(`portal-session:${Utilities.base64EncodeWebSafe(digest)}`);
}

function derivePortalPasswordHash_(password, salt) {
  const key = Utilities.newBlob(password).getBytes();
  const block = Utilities.newBlob(salt).getBytes().concat([0, 0, 0, 1]);
  let current = Utilities.computeHmacSha256Signature(block, key);
  const result = current.slice();
  for (let iteration = 1; iteration < PORTAL_PASSWORD_HASH_ITERATIONS; iteration += 1) {
    current = Utilities.computeHmacSha256Signature(current, key);
    for (let index = 0; index < result.length; index += 1) {
      result[index] ^= current[index];
    }
  }
  return Utilities.base64EncodeWebSafe(result);
}

function constantTimeEquals_(left, right) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function isPortalAdministrator_(email) {
  const administrators = (PropertiesService.getScriptProperties()
    .getProperty("PORTAL_ADMIN_EMAILS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!administrators.length) {
    throw new Error("Pengelola Portal Wali belum dikonfigurasi.");
  }
  return administrators.includes(email);
}

function setGuardianPassword_(studentId, guardianEmail, password) {
  const normalizedStudentId = typeof studentId === "string" ? studentId.trim() : "";
  const normalizedEmail = typeof guardianEmail === "string" ? guardianEmail.trim().toLowerCase() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(normalizedStudentId)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || typeof password !== "string"
    || password.length < 12
    || password.length > 128
    || password.toLowerCase() === normalizedStudentId.toLowerCase()) {
    throw new Error("Nomor induk, email wali, atau kata sandi tidak valid. Kata sandi minimal 12 karakter.");
  }

  const activeLink = getSheetRecords_("Portal Wali").some((row) =>
    String(row["ID Santri"] || "").trim() === normalizedStudentId
    && String(row["Email Wali"] || "").trim().toLowerCase() === normalizedEmail
    && String(row["Status Akses"] || "").trim().toLowerCase() === "aktif");
  const knownStudent = getSheetRecords_("Data Santri").some((row) =>
    String(row["ID Santri"] || "").trim() === normalizedStudentId);
  if (!activeLink || !knownStudent) {
    throw new Error("Nomor induk dan email wali harus sudah ditautkan dengan akses aktif.");
  }

  const salt = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const passwordHash = derivePortalPasswordHash_(password, salt);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Akun Portal");
    if (!sheet) {
      throw new Error("Sheet kredensial portal tidak ditemukan. Jalankan setupRegistrationStorage terlebih dahulu.");
    }
    const records = getSheetRecords_("Akun Portal");
    const matches = records.filter((row) =>
      String(row["ID Santri"] || "").trim() === normalizedStudentId);
    if (matches.length > 1) {
      throw new Error("Terdapat kredensial ganda untuk nomor induk ini. Periksa sheet Akun Portal.");
    }

    const values = [
      safeCellValue_(normalizedStudentId),
      safeCellValue_(normalizedEmail),
      salt,
      passwordHash,
      "Aktif",
    ];
    if (matches.length === 1) {
      const rowNumber = records.indexOf(matches[0]) + 2;
      sheet.getRange(rowNumber, 1, 1, values.length).setNumberFormat("@").setValues([values]);
    } else {
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length);
      range.setNumberFormat("@");
      range.setValues([values]);
    }
  } finally {
    lock.releaseLock();
  }
}

function isAllowedPortalOrigin_(origin) {
  if (typeof origin !== "string"
    || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
    return false;
  }

  const configuredOrigins = (PropertiesService.getScriptProperties()
    .getProperty("PORTAL_ALLOWED_ORIGIN") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredOrigins.includes(origin.toLowerCase());
}

function verifyGoogleIdToken_(idToken) {
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 10000) {
    throw new Error("Login Google tidak valid. Silakan masuk kembali.");
  }

  const clientId = PropertiesService.getScriptProperties()
    .getProperty("PORTAL_GOOGLE_CLIENT_ID");
  if (!clientId) {
    throw new Error("Login Google belum dikonfigurasi oleh pengelola.");
  }

  const tokenDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken);
  const cacheKey = `portal-token:${Utilities.base64EncodeWebSafe(tokenDigest)}`;
  const cache = CacheService.getScriptCache();
  const cachedEmail = cache.get(cacheKey);
  if (cachedEmail) {
    return { email: cachedEmail };
  }

  let response;
  try {
    response = UrlFetchApp.fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { muteHttpExceptions: true }
    );
  } catch (error) {
    console.error("Google token verification request failed.");
    throw new Error("Login Google sementara tidak dapat diverifikasi. Coba lagi.");
  }
  if (response.getResponseCode() !== 200) {
    throw new Error("Sesi Login Google tidak valid atau sudah berakhir. Silakan masuk kembali.");
  }

  const claims = JSON.parse(response.getContentText());
  const issuerValid = claims.iss === "accounts.google.com"
    || claims.iss === "https://accounts.google.com";
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  const expiresAt = Number(claims.exp);
  const secondsRemaining = expiresAt - Math.floor(Date.now() / 1000);
  if (claims.aud !== clientId
    || (claims.azp && claims.azp !== clientId)
    || !issuerValid
    || !emailVerified
    || !claims.email
    || !Number.isFinite(expiresAt)
    || secondsRemaining <= 0) {
    throw new Error("Akun Google tidak dapat diverifikasi. Silakan masuk kembali.");
  }

  const email = String(claims.email).trim().toLowerCase();
  cache.put(cacheKey, email, Math.min(300, secondsRemaining));
  return { email };
}

function getSheetRecords_(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) {
    throw new Error("Database portal belum disiapkan.");
  }
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan. Jalankan setup penyimpanan terlebih dahulu.`);
  }
  if (sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values[0].map((header) => String(header));
  return values.slice(1)
    .filter((row) => row.some((value) => value !== "" && value !== null))
    .map((row) => headers.reduce((record, header, index) => {
      record[header] = row[index];
      return record;
    }, {}));
}

function getGuardianStudents_(email) {
  const linkedIds = getSheetRecords_("Portal Wali")
    .filter((row) => String(row["Email Wali"] || "").trim().toLowerCase() === email
      && String(row["Status Akses"] || "").trim().toLowerCase() === "aktif")
    .map((row) => String(row["ID Santri"] || "").trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(linkedIds)];
  const profiles = getSheetRecords_("Data Santri");
  return uniqueIds.map((id) => {
    const profile = profiles.find((row) => String(row["ID Santri"] || "").trim() === id);
    return profile ? {
      id,
      name: String(profile["Nama Santri"] || "Santri"),
      className: String(profile.Kelas || ""),
      dormitory: String(profile.Asrama || ""),
      status: String(profile.Status || ""),
    } : null;
  }).filter(Boolean);
}

function formatPortalDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "").trim();
}

function formatPortalTimestamp_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value || "").trim();
}

function sortPortalRecords_(records, field) {
  return records.sort((left, right) => String(right[field] || "").localeCompare(String(left[field] || "")))
    .slice(0, 25);
}

function getPortalDashboard_(email, studentId) {
  const profile = getGuardianStudents_(email).find((student) => student.id === studentId);
  if (!profile) {
    throw new Error("Akun ini tidak memiliki akses ke data santri yang diminta.");
  }

  const attendance = getSheetRecords_("Presensi")
    .filter((row) => String(row["ID Santri"] || "").trim() === studentId)
    .map((row) => ({
      date: formatPortalDate_(row.Tanggal),
      status: String(row.Status || ""),
      note: String(row.Catatan || ""),
    }));
  const payments = getSheetRecords_("Tagihan")
    .filter((row) => String(row["ID Santri"] || "").trim() === studentId)
    .map((row) => ({
      title: String(row["Nama Tagihan"] || "Tagihan"),
      amount: Number.isFinite(Number(row.Jumlah)) ? Number(row.Jumlah) : String(row.Jumlah || ""),
      status: String(row.Status || ""),
      dueDate: formatPortalDate_(row["Jatuh Tempo"]),
      paidAt: formatPortalDate_(row["Tanggal Bayar"]),
    }));
  const grades = getSheetRecords_("Akademik")
    .filter((row) => String(row["ID Santri"] || "").trim() === studentId)
    .map((row) => ({
      subject: String(row["Mata Pelajaran"] || ""),
      period: String(row.Periode || ""),
      score: String(row.Nilai == null ? "" : row.Nilai),
      note: String(row.Catatan || ""),
    }));
  const announcements = getSheetRecords_("Pengumuman")
    .filter((row) => ["true", "ya", "1", "terbit"].includes(String(row.Terbit || "").trim().toLowerCase()))
    .map((row) => ({
      title: String(row.Judul || "Pengumuman"),
      body: String(row.Isi || ""),
      published: true,
      createdAt: formatPortalTimestamp_(row["Waktu Terbit"]),
    }));
  const messages = getSheetRecords_("Pesan Wali")
    .filter((row) => String(row["ID Santri"] || "").trim() === studentId
      && String(row["Email Wali"] || "").trim().toLowerCase() === email)
    .map((row) => ({
      category: String(row.Topik || ""),
      body: String(row.Pesan || ""),
      status: String(row.Status || ""),
      reply: String(row.Balasan || ""),
      createdAt: formatPortalTimestamp_(row["Waktu Kirim"]),
    }));

  return {
    student: profile,
    attendance: sortPortalRecords_(attendance, "date"),
    payments: sortPortalRecords_(payments, "dueDate"),
    grades: sortPortalRecords_(grades, "period"),
    announcements: sortPortalRecords_(announcements, "createdAt"),
    messages: sortPortalRecords_(messages, "createdAt"),
  };
}

function saveGuardianMessage_(email, studentId, category, body) {
  const allowedCategories = ["Akademik", "Kehadiran", "Administrasi", "Lainnya"];
  if (!allowedCategories.includes(category)
    || typeof body !== "string"
    || !body.trim()
    || body.length > 2000) {
    throw new Error("Topik atau isi pesan tidak valid (maksimal 2.000 karakter).");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!getGuardianStudents_(email).some((student) => student.id === studentId)) {
      throw new Error("Akun ini tidak memiliki akses ke data santri yang diminta.");
    }

    const cache = CacheService.getScriptCache();
    const emailDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email);
    const cacheKey = `portal-message:${Utilities.base64EncodeWebSafe(emailDigest)}`;
    if (cache.get(cacheKey)) {
      throw new Error("Mohon tunggu sebentar sebelum mengirim pesan berikutnya.");
    }

    const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Pesan Wali");
    if (!sheet) {
      throw new Error("Sheet pesan wali tidak ditemukan.");
    }
    sheet.appendRow([
      Utilities.getUuid(),
      studentId,
      email,
      safeCellValue_(category),
      safeCellValue_(body.trim()),
      "Baru",
      "",
      new Date(),
    ]);
    cache.put(cacheKey, "sent", 30);
  } finally {
    lock.releaseLock();
  }
}

function validateFields_(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("Data formulir tidak valid.");
  }
  if (Object.keys(fields).some((name) => !FIELD_NAMES.includes(name))) {
    throw new Error("Formulir berisi kolom yang tidak dikenal.");
  }

  REQUIRED_FIELDS.forEach((name) => {
    if (typeof fields[name] !== "string" || !fields[name].trim()) {
      throw new Error(`Kolom wajib belum lengkap: ${name}.`);
    }
  });
  if (fields.persetujuanPemrosesanData !== "Ya") {
    throw new Error("Persetujuan penggunaan data wajib diberikan.");
  }

  ["nikPeserta", "nikAyah", "nikIbu"].forEach((name) => {
    if (!/^\d{16}$/.test(fields[name])) {
      throw new Error(`Format ${name} harus 16 digit angka.`);
    }
  });

  FIELD_NAMES.forEach((name) => {
    const value = fields[name] == null ? "" : fields[name];
    if (typeof value !== "string" || value.length > 2000) {
      throw new Error(`Nilai kolom ${name} tidak valid.`);
    }
  });
}

function verifyRecaptcha_(token, secret) {
  if (typeof token !== "string" || !token) {
    throw new Error("Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.");
  }

  const response = UrlFetchApp.fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "post",
    payload: { secret, response: token },
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  if (!result.success || result.action !== "registration" || Number(result.score) < 0.5) {
    throw new Error("Verifikasi keamanan gagal. Coba lagi atau hubungi pengurus.");
  }
}

function saveFiles_(files, folder, submissionId, createdFileIds) {
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    throw new Error("Daftar dokumen tidak valid.");
  }

  let totalBytes = 0;
  const savedIds = {};
  Object.keys(files).forEach((key) => {
    if (!FILE_FIELDS[key]) {
      throw new Error("Jenis dokumen tidak dikenal.");
    }

    const file = files[key];
    if (!file || typeof file.base64 !== "string" || typeof file.mimeType !== "string") {
      throw new Error(`Dokumen ${FILE_FIELDS[key]} tidak valid.`);
    }

    const mimeTypes = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
    };
    const extension = mimeTypes[file.mimeType];
    if (!extension) {
      throw new Error(`Format dokumen ${FILE_FIELDS[key]} tidak didukung.`);
    }
    if (file.base64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4) {
      throw new Error("Ukuran dokumen melebihi batas (4 MB per file).");
    }

    const bytes = Utilities.base64Decode(file.base64);
    totalBytes += bytes.length;
    if (!bytes.length || bytes.length > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_FILE_BYTES) {
      throw new Error("Ukuran dokumen melebihi batas (4 MB per file, 12 MB total).");
    }

    const blob = Utilities.newBlob(
      bytes,
      file.mimeType,
      `${submissionId}_${key}.${extension}`
    );
    const savedFile = folder.createFile(blob);
    createdFileIds.push(savedFile.getId());
    savedIds[key] = savedFile.getId();
  });

  return savedIds;
}

function safeCellValue_(value) {
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function htmlResponse_(data, nonce, type, targetOrigin) {
  const message = JSON.stringify({
    type: type || "manbaul-registration",
    nonce: nonce || "",
    result: data,
  })
    .replace(/</g, "\\u003c");
  const safeOrigin = typeof targetOrigin === "string"
    && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(targetOrigin)
    ? JSON.stringify(targetOrigin)
    : JSON.stringify("*");
  return HtmlService.createHtmlOutput(`<script>window.parent.postMessage(${message}, ${safeOrigin});</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
