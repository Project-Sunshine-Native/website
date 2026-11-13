/* ==========================================================
   CONFIG — update when a new build is ready
   ========================================================== */
var _kT = [];
var _kR = [];
var _kM = [];
var _kD = [0x3a,0xf7,0x5c,0x91,0x2e,0xd4,0x8b,0x60,0x15,0xca,0x4f,0xa2];

var gameFolderFiles = [];
var gameFolderName = '';
var preprocessWorker = null;

function md5(input) {
  var k = [], i = 0;
  for (; i < 64;) { k[i] = 0 | (Math.abs(Math.sin(++i)) * 4294967296); }

  var b, c, d, j, x = [], str2binl = function (str) {
    var nblk = ((str.length + 8) >> 6) + 1,
      blks = Array(nblk * 16);
    for (var i = 0; i < nblk * 16; i++) blks[i] = 0;
    for (var i = 0; i < str.length; i++)
      blks[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
    blks[i >> 2] |= 0x80 << ((i % 4) * 8);
    blks[nblk * 16 - 2] = str.length * 8;
    return blks;
  },
  binl2hex = function (binarray) {
    var hex_tab = "0123456789abcdef", str = "";
    for (var i = 0; i < binarray.length * 4; i++) {
      str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
          hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
    }
    return str;
  };

  x = str2binl(input);

  var a = 1732584193;
  b = -271733879;
  c = -1732584194;
  d = 271733878;

  for (i = 0; i < x.length; i += 16) {
    var olda = a, oldb = b, oldc = c, oldd = d;

    function md5_ff(a, b, c, d, x, s, t) {
      var n = a + ((b & c) | (~b & d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }
    function md5_gg(a, b, c, d, x, s, t) {
      var n = a + ((b & d) | (c & ~d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }
    function md5_hh(a, b, c, d, x, s, t) {
      var n = a + (b ^ c ^ d) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }
    function md5_ii(a, b, c, d, x, s, t) {
      var n = a + (c ^ (b | ~d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }

    a = md5_ff(a, b, c, d, x[i + 0], 7, k[0]);
    d = md5_ff(d, a, b, c, x[i + 1], 12, k[1]);
    c = md5_ff(c, d, a, b, x[i + 2], 17, k[2]);
    b = md5_ff(b, c, d, a, x[i + 3], 22, k[3]);
    a = md5_ff(a, b, c, d, x[i + 4], 7, k[4]);
    d = md5_ff(d, a, b, c, x[i + 5], 12, k[5]);
    c = md5_ff(c, d, a, b, x[i + 6], 17, k[6]);
    b = md5_ff(b, c, d, a, x[i + 7], 22, k[7]);
    a = md5_ff(a, b, c, d, x[i + 8], 7, k[8]);
    d = md5_ff(d, a, b, c, x[i + 9], 12, k[9]);
    c = md5_ff(c, d, a, b, x[i + 10], 17, k[10]);
    b = md5_ff(b, c, d, a, x[i + 11], 22, k[11]);
    a = md5_ff(a, b, c, d, x[i + 12], 7, k[12]);
    d = md5_ff(d, a, b, c, x[i + 13], 12, k[13]);
    c = md5_ff(c, d, a, b, x[i + 14], 17, k[14]);
    b = md5_ff(b, c, d, a, x[i + 15], 22, k[15]);

    a = md5_gg(a, b, c, d, x[i + 1], 5, k[16]);
    d = md5_gg(d, a, b, c, x[i + 6], 9, k[17]);
    c = md5_gg(c, d, a, b, x[i + 11], 14, k[18]);
    b = md5_gg(b, c, d, a, x[i + 0], 20, k[19]);
    a = md5_gg(a, b, c, d, x[i + 5], 5, k[20]);
    d = md5_gg(d, a, b, c, x[i + 10], 9, k[21]);
    c = md5_gg(c, d, a, b, x[i + 15], 14, k[22]);
    b = md5_gg(b, c, d, a, x[i + 4], 20, k[23]);
    a = md5_gg(a, b, c, d, x[i + 9], 5, k[24]);
    d = md5_gg(d, a, b, c, x[i + 14], 9, k[25]);
    c = md5_gg(c, d, a, b, x[i + 3], 14, k[26]);
    b = md5_gg(b, c, d, a, x[i + 8], 20, k[27]);
    a = md5_gg(a, b, c, d, x[i + 13], 5, k[28]);
    d = md5_gg(d, a, b, c, x[i + 2], 9, k[29]);
    c = md5_gg(c, d, a, b, x[i + 7], 14, k[30]);
    b = md5_gg(b, c, d, a, x[i + 12], 20, k[31]);

    a = md5_hh(a, b, c, d, x[i + 5], 4, k[32]);
    d = md5_hh(d, a, b, c, x[i + 8], 11, k[33]);
    c = md5_hh(c, d, a, b, x[i + 11], 16, k[34]);
    b = md5_hh(b, c, d, a, x[i + 14], 23, k[35]);
    a = md5_hh(a, b, c, d, x[i + 1], 4, k[36]);
    d = md5_hh(d, a, b, c, x[i + 4], 11, k[37]);
    c = md5_hh(c, d, a, b, x[i + 7], 16, k[38]);
    b = md5_hh(b, c, d, a, x[i + 10], 23, k[39]);
    a = md5_hh(a, b, c, d, x[i + 13], 4, k[40]);
    d = md5_hh(d, a, b, c, x[i + 0], 11, k[41]);
    c = md5_hh(c, d, a, b, x[i + 3], 16, k[42]);
    b = md5_hh(b, c, d, a, x[i + 6], 23, k[43]);
    a = md5_hh(a, b, c, d, x[i + 9], 4, k[44]);
    d = md5_hh(d, a, b, c, x[i + 12], 11, k[45]);
    c = md5_hh(c, d, a, b, x[i + 15], 16, k[46]);
    b = md5_hh(b, c, d, a, x[i + 2], 23, k[47]);

    a = md5_ii(a, b, c, d, x[i + 0], 6, k[48]);
    d = md5_ii(d, a, b, c, x[i + 7], 10, k[49]);
    c = md5_ii(c, d, a, b, x[i + 14], 15, k[50]);
    b = md5_ii(b, c, d, a, x[i + 5], 21, k[51]);
    a = md5_ii(a, b, c, d, x[i + 12], 6, k[52]);
    d = md5_ii(d, a, b, c, x[i + 3], 10, k[53]);
    c = md5_ii(c, d, a, b, x[i + 10], 15, k[54]);
    b = md5_ii(b, c, d, a, x[i + 1], 21, k[55]);
    a = md5_ii(a, b, c, d, x[i + 8], 6, k[56]);
    d = md5_ii(d, a, b, c, x[i + 15], 10, k[57]);
    c = md5_ii(c, d, a, b, x[i + 6], 15, k[58]);
    b = md5_ii(b, c, d, a, x[i + 13], 21, k[59]);
    a = md5_ii(a, b, c, d, x[i + 4], 6, k[60]);
    d = md5_ii(d, a, b, c, x[i + 11], 10, k[61]);
    c = md5_ii(c, d, a, b, x[i + 2], 15, k[62]);
    b = md5_ii(b, c, d, a, x[i + 9], 21, k[63]);

    a = (a + olda) | 0;
    b = (b + oldb) | 0;
    c = (c + oldc) | 0;
    d = (d + oldd) | 0;
  }
  return binl2hex([a, b, c, d]);
}

function _resolveH(seg, h) {
  var src = seg === 0 ? _kT : seg === 1 ? _kR : _kM;
  if (!src.length) return '';
  var p = [
    (h.charCodeAt(0) + h.charCodeAt(3)) & 0xFF,
    (h.charCodeAt(7) + h.charCodeAt(11)) & 0xFF,
    (h.charCodeAt(15) + h.charCodeAt(23)) & 0xFF
  ];
  var s = [3, 5, 7];
  var out = '';
  for (var i = 0; i < src.length; i++) {
    out += String.fromCharCode(src[i] ^ ((p[seg] + i * s[seg]) & 0xFF));
  }
  return out;
}

function _fetchR(h) {
  return _resolveH(0, h) + _resolveH(1, h) + _resolveH(2, h);
}

function normalizeUploadPath(path) {
  return (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function stripUploadRoot(path) {
  path = normalizeUploadPath(path);
  var slash = path.indexOf('/');
  return slash >= 0 ? path.substring(slash + 1) : path;
}

function pathBaseName(path) {
  path = normalizeUploadPath(path);
  var slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(slash + 1) : path;
}

function shouldIncludeGameFolderFile(path) {
  var name = pathBaseName(path).toLowerCase();
  return !/\.(dll|exe)$/.test(name);
}

function getRootGameMakerDataPath(entries) {
  var dataWinPath = '';
  var gameUnxPath = '';
  (entries || gameFolderFiles).forEach(function(entry) {
    var path = normalizeUploadPath(entry.path);
    var lowerPath = path.toLowerCase();
    if (lowerPath === 'data.win') dataWinPath = path;
    if (lowerPath === 'game.unx') gameUnxPath = path;
  });
  if (dataWinPath) return dataWinPath;
  if (gameUnxPath) return gameUnxPath;
  return '';
}

function updateTargetUi() {
  var target = getSelectedTarget();
  var patchName = getPatchDisplayName(getSelectedPatchTarget());
  var radios = document.querySelectorAll('input[type="radio"]');
  radios.forEach(function(radio) {
    var row = radio.closest('.radio-row');
    if (row) row.classList.toggle('checked', radio.checked);
  });
  setStatus(gameFolderFiles.length ? gameFolderName + ' ready for ' + patchName + ' on ' + target.toUpperCase() + '.' : 'Ready.');
}

function getSelectedPatchTarget() {
  var selected = document.querySelector('input[name="patchTarget"]:checked');
  return selected ? selected.value : 'undertale';
}

function getPatchDisplayName(patchTarget) {
  return patchTarget === 'general' ? 'general game' : patchTarget.charAt(0).toUpperCase() + patchTarget.slice(1);
}

function getSelectedTarget() {
  var selected = document.querySelector('input[name="platformTarget"]:checked');
  return selected ? selected.value : 'wii';
}

function getTargetDisplayName(target) {
  return target === 'wii' ? 'Wii' : '3DS';
}

function getWiiDolPackageFolder(patchTarget) {
  if (patchTarget === 'undertale') return 'UNDERTALE';
  if (patchTarget === 'deltarune') return 'DELTARUNE';
  return 'cinnamon';
}

function getWiiAppInstallPath(patchTarget) {
  return 'apps/' + getWiiDolPackageFolder(patchTarget || getSelectedPatchTarget());
}

function getWiiGameInstallPath(patchTarget) {
  var appPath = getWiiAppInstallPath(patchTarget);
  return patchTarget === 'general' ? appPath + '/' + safeOutputFolderName(gameFolderName) : appPath;
}

function getTargetInstallPath(target, patchTarget) {
  return target === 'wii' ? 'apps/' + getWiiDolPackageFolder(patchTarget || getSelectedPatchTarget()) : '3ds/cinnamon';
}

function handleGameFolder(input) {
  var files = Array.prototype.slice.call(input.files || []);
  if (!files.length) return;

  var firstPath = normalizeUploadPath(files[0].webkitRelativePath || files[0].name);
  gameFolderName = firstPath.indexOf('/') >= 0 ? firstPath.substring(0, firstPath.indexOf('/')) : 'game';
  gameFolderFiles = files.map(function(file) {
    var uploadPath = normalizeUploadPath(file.webkitRelativePath || file.name);
    return {
      file: file,
      path: stripUploadRoot(uploadPath)
    };
  }).filter(function(entry) {
    return entry.path !== '' && shouldIncludeGameFolderFile(entry.path);
  });

  var hasGameMakerData = !!getRootGameMakerDataPath(gameFolderFiles);

  document.getElementById('gameFolderPath').value = gameFolderName + ' (' + gameFolderFiles.length + ' files)';
  if (hasGameMakerData) {
    updateTargetUi();
  } else {
    setStatus('Warning: selected folder does not contain data.win or game.unx at its root.');
  }
}

function showOutputNote() {
  var target = getSelectedTarget();
  showDialog('Output Folder', 'Since this runs in a browser, downloaded files\nwill go to your default Downloads folder.\n\nExtract the zip at the root of your SD card afterward.', [
    { label: 'OK', cls: 'yes', action: closeDialog }
  ]);
}

function setStatus(msg) {
  document.getElementById('statusBar').textContent = msg;
}

function showDialog(title, msg, buttons) {
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogMsg').textContent = msg;
  var btns = document.getElementById('dialogBtns');
  btns.innerHTML = '';
  buttons.forEach(function(b) {
    var el = document.createElement('button');
    el.className = 'dialog-btn ' + (b.cls || '');
    el.textContent = b.label;
    el.onclick = b.action;
    btns.appendChild(el);
  });
  document.getElementById('overlay').classList.add('visible');
}

function closeDialog() {
  document.getElementById('overlay').classList.remove('visible');
}

function setProgress(pct) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '% Complete. Pls wait';
}

function onError(msg) {
  document.getElementById('progressArea').classList.remove('visible');
  document.getElementById('patchBtn').disabled = false;
  setStatus('Error: ' + msg);
  showDialog('Preprocess Failed', 'Something went wrong:\n\n' + msg, [
    { label: 'OK', cls: 'yes', action: closeDialog }
  ]);
}

function appendLog(line) {
  var log = document.getElementById('logArea');
  log.classList.add('visible');
  log.textContent += line + '\n';
  log.scrollTop = log.scrollHeight;
}

function resetLog() {
  var log = document.getElementById('logArea');
  log.textContent = '';
  log.classList.remove('visible');
}

function createPreprocessWorker() {
  return new Worker(new URL('assets/preprocess-worker.js', window.location.href), { type: 'module' });
}

var zipCrcTable = null;

function getZipCrcTable() {
  if (zipCrcTable) return zipCrcTable;
  zipCrcTable = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    zipCrcTable[i] = c >>> 0;
  }
  return zipCrcTable;
}

function crc32(bytes) {
  var table = getZipCrcTable();
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosTimestamp(date) {
  var year = Math.max(1980, date.getFullYear());
  var time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  var day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time, day: day };
}

function write16(out, offset, value) {
  out[offset] = value & 0xFF;
  out[offset + 1] = (value >>> 8) & 0xFF;
}

function write32(out, offset, value) {
  out[offset] = value & 0xFF;
  out[offset + 1] = (value >>> 8) & 0xFF;
  out[offset + 2] = (value >>> 16) & 0xFF;
  out[offset + 3] = (value >>> 24) & 0xFF;
}

function makeZip(files) {
  var encoder = new TextEncoder();
  var stamp = dosTimestamp(new Date());
  var entries = files.map(function(file) {
    var nameBytes = encoder.encode(file.name.replace(/\\/g, '/'));
    var bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    return {
      nameBytes: nameBytes,
      bytes: bytes,
      crc: crc32(bytes),
      offset: 0
    };
  });

  var localSize = 0;
  var centralSize = 0;
  entries.forEach(function(entry) {
    localSize += 30 + entry.nameBytes.length + entry.bytes.length;
    centralSize += 46 + entry.nameBytes.length;
  });
  var totalSize = localSize + centralSize + 22;
  var out = new Uint8Array(totalSize);
  var offset = 0;

  entries.forEach(function(entry) {
    entry.offset = offset;
    write32(out, offset, 0x04034b50); offset += 4;
    write16(out, offset, 20); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, stamp.time); offset += 2;
    write16(out, offset, stamp.day); offset += 2;
    write32(out, offset, entry.crc); offset += 4;
    write32(out, offset, entry.bytes.length); offset += 4;
    write32(out, offset, entry.bytes.length); offset += 4;
    write16(out, offset, entry.nameBytes.length); offset += 2;
    write16(out, offset, 0); offset += 2;
    out.set(entry.nameBytes, offset); offset += entry.nameBytes.length;
    out.set(entry.bytes, offset); offset += entry.bytes.length;
  });

  var centralOffset = offset;
  entries.forEach(function(entry) {
    write32(out, offset, 0x02014b50); offset += 4;
    write16(out, offset, 20); offset += 2;
    write16(out, offset, 20); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, stamp.time); offset += 2;
    write16(out, offset, stamp.day); offset += 2;
    write32(out, offset, entry.crc); offset += 4;
    write32(out, offset, entry.bytes.length); offset += 4;
    write32(out, offset, entry.bytes.length); offset += 4;
    write16(out, offset, entry.nameBytes.length); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, 0); offset += 2;
    write16(out, offset, 0); offset += 2;
    write32(out, offset, 0); offset += 4;
    write32(out, offset, entry.offset); offset += 4;
    out.set(entry.nameBytes, offset); offset += entry.nameBytes.length;
  });

  write32(out, offset, 0x06054b50); offset += 4;
  write16(out, offset, 0); offset += 2;
  write16(out, offset, 0); offset += 2;
  write16(out, offset, entries.length); offset += 2;
  write16(out, offset, entries.length); offset += 2;
  write32(out, offset, centralSize); offset += 4;
  write32(out, offset, centralOffset); offset += 4;
  write16(out, offset, 0);

  return new Blob([out], { type: 'application/zip' });
}

function downloadBlob(blob, fileName) {
  var blobUrl = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 5000);
}

function safeOutputFolderName(name) {
  var clean = (name || 'game').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return clean && !/^\.+$/.test(clean) ? clean : 'game';
}

function zipRootForTarget(target, patchTarget) {
  return target === 'wii' ? getWiiGameInstallPath(patchTarget) : getTargetInstallPath(target, patchTarget) + '/' + safeOutputFolderName(gameFolderName);
}

function zipFileNameForTarget(target) {
  return 'ProjectSunshine-' + getTargetDisplayName(target) + '-' + safeOutputFolderName(gameFolderName) + '-preprocessed-assets.zip';
}

function addOrReplaceZipFile(files, name, bytes) {
  var normalizedName = name.replace(/\\/g, '/');
  var key = normalizedName.toLowerCase();
  for (var i = 0; i < files.length; i++) {
    if (files[i].name.replace(/\\/g, '/').toLowerCase() === key) {
      files[i] = { name: normalizedName, bytes: bytes };
      return;
    }
  }
  files.push({ name: normalizedName, bytes: bytes });
}

function inferRunnerOsType(entries) {
  entries = entries || gameFolderFiles;
  for (var i = 0; i < entries.length; i++) {
    if (pathBaseName(entries[i].path).toLowerCase() === 'game.unx') return 'linux';
  }
  return 'windows';
}

function upsertRunnerIniValue(text, key, value) {
  var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  var runnerStart = -1;
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*\[runner\]\s*$/i.test(lines[i])) {
      runnerStart = i;
      break;
    }
  }
  if (runnerStart < 0) {
    lines.unshift('[runner]');
    runnerStart = 0;
  }

  var runnerEnd = lines.length;
  for (var j = runnerStart + 1; j < lines.length; j++) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[j])) {
      runnerEnd = j;
      break;
    }
  }

  var keyRe = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=', 'i');
  for (var k = runnerStart + 1; k < runnerEnd; k++) {
    if (keyRe.test(lines[k])) {
      lines[k] = key + '=' + value;
      return lines.join('\n') + '\n';
    }
  }

  lines.splice(runnerEnd, 0, key + '=' + value);
  return lines.join('\n') + '\n';
}

function getPackagedRunnerGameDirectory(patchTarget) {
  var appFolder = getWiiDolPackageFolder(patchTarget);
  return patchTarget === 'general' ? appFolder + '/' + safeOutputFolderName(gameFolderName) : appFolder;
}

function preparePackagedRunnerSettings(text, osType, gameDirectory) {
  text = upsertRunnerIniValue(text, 'game_directory', gameDirectory);
  text = upsertRunnerIniValue(text, '240p_mode', 'disabled');
  text = upsertRunnerIniValue(text, 'debug_stats', 'off');
  text = upsertRunnerIniValue(text, 'os_type', osType);
  return text;
}

async function fetchAssetBytes(path) {
  var response = await fetch(path);
  if (!response.ok) throw new Error('Could not load runner package file: ' + path);
  return new Uint8Array(await response.arrayBuffer());
}

async function addRunnerPackageFiles(files, target, patchTarget, originalEntries) {
  var merged = files.slice();

  if (target === '3ds') {
    addOrReplaceZipFile(
      merged,
      '3ds/cinnamon/cinnamon.cia',
      await fetchAssetBytes('assets/runners/3ds/cinnamon.cia')
    );
    return merged;
  }

  if (target !== 'wii') return merged;
  var appRoot = getWiiAppInstallPath(patchTarget);
  var packageFolder = getWiiDolPackageFolder(patchTarget);
  var runnerRoot = 'assets/runners/wii/dol';
  var metadataNames = ['meta.xml', 'icon.png'];

  addOrReplaceZipFile(merged, appRoot + '/boot.dol', await fetchAssetBytes(runnerRoot + '/boot.dol'));
  for (var i = 0; i < metadataNames.length; i++) {
    var name = metadataNames[i];
    addOrReplaceZipFile(merged, appRoot + '/' + name, await fetchAssetBytes(runnerRoot + '/' + packageFolder + '/' + name));
  }

  var settingsPath = runnerRoot + '/' + packageFolder + '/cinnamon_settings.ini';
  var settingsResponse = await fetch(settingsPath);
  if (!settingsResponse.ok) throw new Error('Could not load runner package file: ' + settingsPath);
  var settingsText = await settingsResponse.text();
  settingsText = preparePackagedRunnerSettings(settingsText, inferRunnerOsType(originalEntries), getPackagedRunnerGameDirectory(patchTarget));
  addOrReplaceZipFile(merged, appRoot + '/cinnamon_settings.ini', new TextEncoder().encode(settingsText));

  return merged;
}

async function mergeOriginalFolderFiles(generatedFiles, target, originalEntries, patchTarget) {
  var merged = generatedFiles.slice();
  var existing = {};
  var entries = originalEntries || gameFolderFiles;
  generatedFiles.forEach(function(file) {
    existing[file.name.replace(/\\/g, '/').toLowerCase()] = true;
  });

  var root = zipRootForTarget(target, patchTarget);
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var zipName = root + '/' + entry.path.replace(/\\/g, '/');
    if (existing[zipName.toLowerCase()]) continue;
    var buffer = await entry.file.arrayBuffer();
    merged.push({ name: zipName, bytes: new Uint8Array(buffer) });
  }
  return merged;
}

function startPatch() {
  if (!gameFolderFiles.length) {
    showDialog('Missing Folder', 'Please select your game folder first.', [
      { label: 'OK', cls: 'yes', action: closeDialog }
    ]);
    return;
  }

  var rootGameMakerDataPath = getRootGameMakerDataPath(gameFolderFiles);
  var hasGameMakerData = !!rootGameMakerDataPath;
  if (!hasGameMakerData) {
    showDialog('Missing Game Data', 'The selected folder does not contain data.win or game.unx at its root.', [
      { label: 'OK', cls: 'yes', action: closeDialog }
    ]);
    return;
  }

  if (window.location.protocol === 'file:') {
    showDialog('Server Required', 'The WASM preprocessor must be loaded over http:// or https://.\n\nStart a local static server and open this page from that URL.', [
      { label: 'OK', cls: 'yes', action: closeDialog }
    ]);
    return;
  }

  var target = getSelectedTarget();
  var patchTarget = getSelectedPatchTarget();
  var patchName = getPatchDisplayName(patchTarget);
  var installPath = zipRootForTarget(target, patchTarget);
  var msg = 'This will run the ' + patchName + ' ' + getTargetDisplayName(target) + ' asset preprocessor in your browser.\n\nThe generated zip will contain ' + installPath + ' and should be extracted at the SD card root.\n\nReady to preprocess?';
  showDialog('Confirm Preprocess', msg, [
    { label: 'No',  cls: '',    action: closeDialog },
    { label: 'Yes', cls: 'yes', action: function() { closeDialog(); runPreprocess(); } }
  ]);
}

function runPreprocess() {
  var btn = document.getElementById('patchBtn');
  btn.disabled = true;
  resetLog();
  document.getElementById('progressArea').classList.add('visible');
  document.getElementById('completeArea').classList.remove('visible');
  setProgress(0);
  setStatus('Starting WASM preprocessor...');

  Promise.resolve().then(function() {
    var target = getSelectedTarget();
    var patchTarget = getSelectedPatchTarget();
    var limitDeltaruneToChapterOne = patchTarget === 'deltarune';
    setProgress(2);
    return {
      target: target,
      patchTarget: patchTarget,
      wiiAppFolderName: getWiiDolPackageFolder(patchTarget),
      wiiGameInstallPath: getWiiGameInstallPath(patchTarget),
      limitDeltaruneToChapterOne: limitDeltaruneToChapterOne,
      inputDataPath: patchTarget === 'general' ? getRootGameMakerDataPath(gameFolderFiles) : '',
      filesForPreprocess: gameFolderFiles
    };
  }).then(function(runConfig) {
    var target = runConfig.target;
    setStatus('Starting ' + getTargetDisplayName(target) + ' WASM preprocessor...');
    preprocessWorker = createPreprocessWorker();

    preprocessWorker.onmessage = function(event) {
      var data = event.data;
      if (data.type === 'progress') {
        setProgress(data.pct);
        setStatus(data.status);
      } else if (data.type === 'log') {
        appendLog(data.line);
      } else if (data.type === 'done') {
        setProgress(95);
        setStatus('Creating zip...');
        mergeOriginalFolderFiles(data.files, target, runConfig.filesForPreprocess, runConfig.patchTarget).then(function(files) {
          return addRunnerPackageFiles(files, target, runConfig.patchTarget, runConfig.filesForPreprocess);
        }).then(function(files) {
          var zip = makeZip(files);
          var targetName = getTargetDisplayName(target);
          downloadBlob(zip, zipFileNameForTarget(target));
          setProgress(100);
          document.getElementById('progressArea').classList.remove('visible');
          document.getElementById('completeArea').classList.add('visible');
          document.getElementById('completeSub').textContent = 'You should see the ' + targetName + ' asset zip in your Downloads folder.';
          setStatus('Done! ' + targetName + ' asset zip saved to your Downloads folder.');
          cleanupPreprocessWorker();
          btn.disabled = false;
        }).catch(function(err) {
          cleanupPreprocessWorker();
          onError(err && err.message ? err.message : String(err));
        });
      } else if (data.type === 'error') {
        cleanupPreprocessWorker();
        onError(data.message);
      }
    };

    preprocessWorker.onerror = function(event) {
      cleanupPreprocessWorker();
      onError(event.message || 'WASM worker failed.');
    };

    preprocessWorker.postMessage({
      type: 'run',
      files: runConfig.filesForPreprocess,
      gameFolderName: gameFolderName,
      wiiAppFolderName: runConfig.wiiAppFolderName,
      wiiGameInstallPath: runConfig.wiiGameInstallPath,
      target: target,
      limitDeltaruneToChapterOne: runConfig.limitDeltaruneToChapterOne,
      inputDataPath: runConfig.inputDataPath
    });
  }).catch(function(err) {
    onError(err && err.message ? err.message : String(err));
  });
}

function cleanupPreprocessWorker() {
  if (preprocessWorker) {
    preprocessWorker.terminate();
    preprocessWorker = null;
  }
}

function initializePatcherUi() {
  document.querySelectorAll('input[name="patchTarget"], input[name="platformTarget"]').forEach(function(input) {
    input.addEventListener('change', updateTargetUi);
  });

  document.getElementById('browseGameFolderBtn').addEventListener('click', function() {
    document.getElementById('gameFolderInput').click();
  });
  document.getElementById('gameFolderInput').addEventListener('change', function() {
    handleGameFolder(this);
  });
  document.getElementById('outputInfoBtn').addEventListener('click', showOutputNote);
  document.getElementById('patchBtn').addEventListener('click', startPatch);
  updateTargetUi();
}

initializePatcherUi();
