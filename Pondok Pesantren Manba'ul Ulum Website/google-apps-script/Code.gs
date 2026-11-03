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

const PORTAL_ADMIN_ENTITIES = {
  students: {
    sheet: "Data Santri",
    key: "ID Santri",
    fields: {
      studentId: "ID Santri",
      name: "Nama Santri",
      className: "Kelas",
      dormitory: "Asrama",
      status: "Status",
    },
  },
  guardians: {
    sheet: "Portal Wali",
    key: ["Email Wali", "ID Santri"],
    fields: {
      email: "Email Wali",
      studentId: "ID Santri",
      status: "Status Akses",
    },
  },
  attendance: {
    sheet: "Presensi",
    key: "ID",
    fields: {
      id: "ID",
      studentId: "ID Santri",
      date: "Tanggal",
      status: "Status",
      note: "Catatan",
    },
  },
  payments: {
    sheet: "Tagihan",
    key: "ID",
    fields: {
      id: "ID",
      studentId: "ID Santri",
      title: "Nama Tagihan",
      amount: "Jumlah",
      status: "Status",
      dueDate: "Jatuh Tempo",
      paidAt: "Tanggal Bayar",
    },
  },
  grades: {
    sheet: "Akademik",
    key: "ID",
    fields: {
      id: "ID",
      studentId: "ID Santri",
      subject: "Mata Pelajaran",
      period: "Periode",
      score: "Nilai",
      note: "Catatan",
    },
  },
  announcements: {
    sheet: "Pengumuman",
    key: "ID",
    fields: {
      id: "ID",
      title: "Judul",
      body: "Isi",
      published: "Terbit",
      createdAt: "Waktu Terbit",
    },
  },
  messages: {
    sheet: "Pesan Wali",
    key: "ID Pesan",
    fields: {
      id: "ID Pesan",
      studentId: "ID Santri",
      email: "Email Wali",
      category: "Topik",
      body: "Pesan",
      status: "Status",
      reply: "Balasan",
      createdAt: "Waktu Kirim",
    },
  },
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

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName("Pendaftar")
    || spreadsheet.insertSheet("Pendaftar");

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

  setupPortalSheets_(spreadsheet);
  console.log(`Spreadsheet: ${spreadsheet.getUrl()}`);
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
      throw new Error(
        `Kolom pada sheet "${name}" tidak sesuai. Periksa panduan portal wali sebelum menjalankan setup kembali.`
      );
    }
  });
}

function handleGuardianPortalRequest_(request) {
  if (!isAllowedPortalOrigin_(request.origin)) {
    throw new Error("Portal belum dikonfigurasi untuk alamat website ini.");
  }

  if (request.operation === "admin-login") {
    return loginPortalAdministrator_(request.username, request.password);
  }

  if (request.operation === "admin-logout") {
    removePortalAdminSession_(request.adminSessionToken);
    return { status: "success" };
  }

  if (request.operation === "login") {
    return loginPortalGuardian_(request.studentId, request.password);
  }

  if (request.operation === "set-guardian-password") {
    getPortalAdminSession_(request.adminSessionToken);
    setGuardianPassword_(request.studentId, request.guardianEmail, request.password);
    return { status: "success" };
  }

  if (request.operation === "admin-list"
    || request.operation === "admin-save"
    || request.operation === "admin-delete") {
    getPortalAdminSession_(request.adminSessionToken);
    if (request.operation === "admin-list") {
      return { status: "success", records: getPortalAdminRecords_() };
    }
    if (request.operation === "admin-save") {
      savePortalAdminRecord_(request.entity, request.record, request.originalKey);
      return { status: "success", records: getPortalAdminRecords_() };
    }
    deletePortalAdminRecord_(request.entity, request.key);
    return { status: "success", records: getPortalAdminRecords_() };
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

function configurePortalAdministrator() {
  const properties = PropertiesService.getScriptProperties();
  const username = String(properties.getProperty("PORTAL_ADMIN_USERNAME") || "").trim();
  const temporaryPassword = properties.getProperty("PORTAL_ADMIN_PASSWORD") || "";
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)
    || temporaryPassword.length < 14
    || temporaryPassword.length > 128) {
    throw new Error(
      "Atur PORTAL_ADMIN_USERNAME dan PORTAL_ADMIN_PASSWORD sementara di Script Properties. "
      + "Nama pengguna 3-64 karakter; kata sandi minimal 14 karakter."
    );
  }

  const salt = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const passwordHash = derivePortalPasswordHash_(temporaryPassword, salt);
  properties.setProperty("PORTAL_ADMIN_USERNAME", username.toLowerCase());
  properties.setProperty("PORTAL_ADMIN_PASSWORD_SALT", salt);
  properties.setProperty("PORTAL_ADMIN_PASSWORD_HASH", passwordHash);
  properties.deleteProperty("PORTAL_ADMIN_PASSWORD");
  return "Akun pengelola berhasil disiapkan. Kata sandi sementara telah dihapus dari Script Properties.";
}

function loginPortalAdministrator_(username, password) {
  const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
  const attemptKey = getPortalAdminLoginAttemptKey_(normalizedUsername);
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(attemptKey) || 0);
  if (attempts >= PORTAL_LOGIN_MAX_ATTEMPTS) {
    throw new Error("Nama pengguna atau kata sandi tidak benar, atau akses sementara dibatasi. Coba lagi nanti.");
  }

  const properties = PropertiesService.getScriptProperties();
  const configuredUsername = (properties.getProperty("PORTAL_ADMIN_USERNAME") || "").trim().toLowerCase();
  const salt = properties.getProperty("PORTAL_ADMIN_PASSWORD_SALT") || "";
  const storedHash = properties.getProperty("PORTAL_ADMIN_PASSWORD_HASH") || "";
  if (!configuredUsername || !salt || !storedHash) {
    throw new Error(
      "Akun pengelola belum disiapkan. Atur kredensial sementara di Script Properties "
      + "lalu jalankan configurePortalAdministrator()."
    );
  }

  const safePassword = typeof password === "string" && password.length <= 128 ? password : "";
  const passwordHash = derivePortalPasswordHash_(safePassword || "invalid-admin-password", salt);
  if (!constantTimeEquals_(normalizedUsername, configuredUsername)
    || !safePassword
    || !constantTimeEquals_(passwordHash, storedHash)) {
    recordPortalLoginFailure_(attemptKey);
    throw new Error("Nama pengguna atau kata sandi tidak benar, atau akses sementara dibatasi. Coba lagi nanti.");
  }

  cache.remove(attemptKey);
  return { status: "success", adminSessionToken: createPortalAdminSession_() };
}

function getPortalAdminLoginAttemptKey_(username) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(username).toLowerCase()
  );
  return `portal-admin-login:${Utilities.base64EncodeWebSafe(digest)}`;
}

function createPortalAdminSession_() {
  const token = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join("");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const key = `portal-admin-session:${Utilities.base64EncodeWebSafe(digest)}`;
  const salt = PropertiesService.getScriptProperties().getProperty("PORTAL_ADMIN_PASSWORD_SALT") || "";
  CacheService.getScriptCache().put(key, salt, PORTAL_SESSION_SECONDS);
  return token;
}

function getPortalAdminSession_(token) {
  if (typeof token !== "string" || token.length < 100 || token.length > 256) {
    throw new Error("Sesi pengelola berakhir. Silakan login kembali.");
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const key = `portal-admin-session:${Utilities.base64EncodeWebSafe(digest)}`;
  const sessionSalt = CacheService.getScriptCache().get(key);
  const currentSalt = PropertiesService.getScriptProperties().getProperty("PORTAL_ADMIN_PASSWORD_SALT") || "";
  if (!sessionSalt || sessionSalt !== currentSalt) {
    throw new Error("Sesi pengelola berakhir. Silakan login kembali.");
  }
}

function removePortalAdminSession_(token) {
  if (typeof token !== "string" || token.length < 100 || token.length > 256) return;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const key = `portal-admin-session:${Utilities.base64EncodeWebSafe(digest)}`;
  CacheService.getScriptCache().remove(key);
}

function getPortalAdminRecords_() {
  return Object.keys(PORTAL_ADMIN_ENTITIES).reduce((result, entityName) => {
    const entity = PORTAL_ADMIN_ENTITIES[entityName];
    result[entityName] = getSheetRecords_(entity.sheet).map((row) =>
      Object.keys(entity.fields).reduce((record, fieldName) => {
        const header = entity.fields[fieldName];
        const value = row[header];
        if (fieldName === "date" || fieldName === "dueDate" || fieldName === "paidAt") {
          record[fieldName] = formatPortalDate_(value);
        } else if (fieldName === "createdAt") {
          record[fieldName] = formatPortalTimestamp_(value);
        } else {
          record[fieldName] = value == null ? "" : String(value);
        }
        return record;
      }, {})
    );
    return result;
  }, {});
}

function getPortalAdminRecord_(entityName, key) {
  const entity = PORTAL_ADMIN_ENTITIES[entityName];
  if (!entity || !entity.key) {
    throw new Error("Jenis data pengelolaan tidak valid.");
  }
  const records = getSheetRecords_(entity.sheet);
  let record = null;
  let recordIndex = -1;
  records.forEach((row, index) => {
    if (!portalAdminRecordMatchesKey_(row, entity, key)) {
      return;
    }
    if (record) {
      throw new Error("Kunci data ganda ditemukan. Periksa dan rapikan baris pada Spreadsheet.");
    }
    record = row;
    recordIndex = index;
  });
  if (recordIndex < 0) {
    throw new Error("Data yang dipilih tidak ditemukan. Muat ulang daftar lalu coba lagi.");
  }
  return { entity, record, records, rowNumber: recordIndex + 2 };
}

function portalAdminRecordMatchesKey_(row, entity, key) {
  if (Array.isArray(entity.key)) {
    return entity.key.every((header, index) =>
      String(row[header] || "").trim().toLowerCase()
      === String(Array.isArray(key) ? key[index] : "").trim().toLowerCase());
  }
  return String(row[entity.key] || "").trim() === String(key || "").trim();
}

function validatePortalAdminRecord_(entityName, record, originalKey) {
  const entity = PORTAL_ADMIN_ENTITIES[entityName];
  if (!entity || !record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Data pengelolaan tidak valid.");
  }
  const allowedFields = Object.keys(entity.fields);
  if (Object.keys(record).some((field) => !allowedFields.includes(field))) {
    throw new Error("Data berisi kolom yang tidak dikenal.");
  }
  allowedFields.forEach((field) => {
    if (typeof record[field] !== "string" || record[field].length > 5000) {
      throw new Error(`Kolom ${entity.fields[field]} tidak valid.`);
    }
  });

  const value = (field) => record[field].trim();
  const validStudentId = (studentId) =>
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(studentId)
    && getSheetRecords_("Data Santri").some((row) =>
      String(row["ID Santri"] || "").trim() === studentId);
  if (entityName !== "students" && entityName !== "announcements"
    && entityName !== "messages" && !validStudentId(value("studentId"))) {
    throw new Error("Pilih nomor induk santri yang sudah terdaftar.");
  }

  if (entityName === "students") {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value("studentId"))
      || !value("name") || !value("className") || !value("status")) {
      throw new Error("Nomor induk, nama, kelas, dan status santri wajib diisi dengan benar.");
    }
  } else if (entityName === "guardians") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email"))
      || !["aktif", "nonaktif"].includes(value("status").toLowerCase())) {
      throw new Error("Email wali atau status akses tidak valid.");
    }
    const duplicate = getSheetRecords_(entity.sheet).some((row) =>
      String(row["Email Wali"] || "").trim().toLowerCase() === value("email").toLowerCase()
      && String(row["ID Santri"] || "").trim() === value("studentId")
      && (!originalKey || !portalAdminRecordMatchesKey_(row, entity, originalKey)));
    if (duplicate) {
      throw new Error("Tautan email wali dan santri tersebut sudah ada.");
    }
  } else if (entityName === "attendance") {
    if (!value("status") || !isValidPortalDate_(value("date"))) {
      throw new Error("Tanggal presensi atau status tidak valid.");
    }
  } else if (entityName === "payments") {
    if (!value("title") || !value("status")
      || !/^\d+(?:\.\d{1,2})?$/.test(value("amount"))
      || !isValidPortalDate_(value("dueDate"))
      || !isValidPortalDate_(value("paidAt"))) {
      throw new Error("Nama tagihan, jumlah, status, atau tanggal pembayaran tidak valid.");
    }
  } else if (entityName === "grades") {
    if (!value("subject") || !value("period") || !value("score")) {
      throw new Error("Mata pelajaran, periode, dan nilai wajib diisi.");
    }
  } else if (entityName === "announcements") {
    if (!value("title") || !value("body")
      || !["ya", "tidak"].includes(value("published").toLowerCase())) {
      throw new Error("Judul, isi, dan status terbit pengumuman wajib diisi.");
    }
  } else if (entityName === "messages") {
    if (!value("status") || value("status").length > 100 || record.reply.length > 2000) {
      throw new Error("Status pesan wajib diisi (maksimal 100 karakter) dan balasan maksimal 2.000 karakter.");
    }
  }
}

function isValidPortalDate_(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function savePortalAdminRecord_(entityName, record, originalKey) {
  const entity = PORTAL_ADMIN_ENTITIES[entityName];
  if (!entity) {
    throw new Error("Jenis data pengelolaan tidak valid.");
  }
  if (entityName === "messages" && !originalKey) {
    throw new Error("Pesan wali hanya dapat dibalas, tidak dapat dibuat dari halaman pengelola.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (entityName !== "messages" && entity.fields.id && !originalKey) {
      record.id = Utilities.getUuid();
    }
    validatePortalAdminRecord_(entityName, record, originalKey);
    const sheet = getPortalSpreadsheet_().getSheetByName(entity.sheet);
    if (!sheet) {
      throw new Error(`Sheet "${entity.sheet}" tidak ditemukan.`);
    }
    let rowNumber = 0;
    if (originalKey) {
      const current = getPortalAdminRecord_(entityName, originalKey);
      rowNumber = current.rowNumber;
    }

    if (entityName === "students" && !rowNumber
      && getSheetRecords_(entity.sheet).some((row) =>
        String(row["ID Santri"] || "").trim() === record.studentId.trim())) {
      throw new Error("Nomor induk santri sudah terdaftar.");
    }
    if (entityName === "messages") {
      const existing = getPortalAdminRecord_(entityName, originalKey).record;
      record.id = String(existing["ID Pesan"] || "");
      record.studentId = String(existing["ID Santri"] || "");
      record.email = String(existing["Email Wali"] || "");
      record.category = String(existing.Topik || "");
      record.body = String(existing.Pesan || "");
      record.createdAt = formatPortalTimestamp_(existing["Waktu Kirim"]);
    }
    const values = Object.keys(entity.fields).map((fieldName) => {
      let value = record[fieldName].trim();
      if (fieldName === "email") value = value.toLowerCase();
      if (fieldName === "status" && entityName === "guardians") {
        value = value.toLowerCase() === "aktif" ? "Aktif" : "Nonaktif";
      }
      if (fieldName === "published") value = value.toLowerCase() === "ya" ? "Ya" : "Tidak";
      if (fieldName === "createdAt" && !value) value = new Date().toISOString();
      return safeCellValue_(value);
    });
    const range = sheet.getRange(rowNumber || sheet.getLastRow() + 1, 1, 1, values.length);
    range.setNumberFormat("@");
    range.setValues([values]);
  } finally {
    lock.releaseLock();
  }
}

function deletePortalAdminRecord_(entityName, key) {
  const entity = PORTAL_ADMIN_ENTITIES[entityName];
  if (!entity || entityName === "messages") {
    throw new Error("Data ini tidak dapat dihapus dari halaman pengelola.");
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const current = getPortalAdminRecord_(entityName, key);
    if (entityName === "students") {
      const studentId = String(current.record["ID Santri"] || "").trim();
      const dependentSheets = ["Portal Wali", "Akun Portal", "Presensi", "Tagihan", "Akademik", "Pesan Wali"];
      const hasDependencies = dependentSheets.some((sheetName) =>
        getSheetRecords_(sheetName).some((row) => String(row["ID Santri"] || "").trim() === studentId));
      if (hasDependencies) {
        throw new Error(
          "Santri masih memiliki tautan atau riwayat data. "
          + "Nonaktifkan status santri agar riwayat tetap utuh."
        );
      }
    }
    getPortalSpreadsheet_().getSheetByName(entity.sheet).deleteRow(current.rowNumber);
  } finally {
    lock.releaseLock();
  }
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
  if (typeof token !== "string" || token.length < 100 || token.length > 256) return;
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
    const sheet = getPortalSpreadsheet_().getSheetByName("Akun Portal");
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

function getSheetRecords_(sheetName) {
  const sheet = getPortalSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan. Jalankan setup penyimpanan terlebih dahulu.`);
  }
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map((header) => String(header));
  return values.slice(1).reduce((records, row) => {
    if (!row.some((value) => value !== "" && value !== null)) {
      return records;
    }
    const record = headers.reduce((result, header, index) => {
      if (header) {
        result[header] = row[index];
      }
      return result;
    }, {});
    records.push(record);
    return records;
  }, []);
}

function getPortalSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) {
    throw new Error("Database portal belum disiapkan.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getGuardianStudents_(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const linkedIds = getSheetRecords_("Portal Wali")
    .filter((row) => String(row["Email Wali"] || "").trim().toLowerCase() === normalizedEmail
      && String(row["Status Akses"] || "").trim().toLowerCase() === "aktif")
    .map((row) => String(row["ID Santri"] || "").trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(linkedIds)];
  const profilesById = new Map();
  getSheetRecords_("Data Santri").forEach((profile) => {
    const id = String(profile["ID Santri"] || "").trim();
    if (id && !profilesById.has(id)) {
      profilesById.set(id, profile);
    }
  });
  return uniqueIds.map((id) => {
    const profile = profilesById.get(id);
    if (profile && String(profile.Status || "").trim().toLowerCase() === "nonaktif") {
      return null;
    }
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
  return records.slice()
    .sort((left, right) => String(right[field] || "").localeCompare(String(left[field] || "")))
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

    const sheet = getPortalSpreadsheet_().getSheetByName("Pesan Wali");
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
