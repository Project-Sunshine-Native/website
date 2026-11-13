import createPreprocessor from './wasm/cinnamon-preprocessor.mjs';

const wasmBaseUrl = new URL('./wasm/', import.meta.url);
const deltaruneChapterOneConfigUrl = new URL('./wasm/deltarune-ch1-game-profiles.cfg', import.meta.url);

async function loadPreprocessorResources(FS) {
  const resources = ['game_profiles.cfg', 'resources/wii/icon.png', 'resources/wii/meta.xml'];
  await Promise.all(resources.map(async function(path) {
    const response = await fetch(new URL(path, wasmBaseUrl));
    if (!response.ok) throw new Error('Could not load preprocessor resource: ' + path);
    const destination = '/' + path;
    ensureDir(FS, parentDir(destination));
    FS.writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  }));
}

var lastLogLine = '';

function postProgress(pct, status) {
  self.postMessage({ type: 'progress', pct: pct, status: status });
}

function postLog(line) {
  lastLogLine = String(line);
  self.postMessage({ type: 'log', line: line });
}

function ensureDir(FS, path) {
  var parts = path.split('/').filter(Boolean);
  var current = '';
  for (var i = 0; i < parts.length; i++) {
    current += '/' + parts[i];
    try {
      FS.mkdir(current);
    } catch (err) {
      if (!FS.analyzePath(current).exists) throw err;
    }
  }
}

function parentDir(path) {
  var slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(0, slash) : '';
}

function safeOutputFolderName(name) {
  var clean = (name || 'game').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'game';
}

function getPreprocessorInputPath(path) {
  var normalized = (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return '/work/game';
  var lowerPath = normalized.toLowerCase();
  if (lowerPath !== 'data.win' && lowerPath !== 'game.unx') {
    throw new Error('General game preprocessing requires data.win or game.unx at the selected folder root.');
  }
  return '/work/game/' + normalized;
}

async function readEntryBytes(entry) {
  if (entry.bytes) return entry.bytes;
  if (entry.file && entry.file.arrayBuffer) return new Uint8Array(await entry.file.arrayBuffer());
  throw new Error('Could not read ' + (entry.path || 'selected file') + '.');
}

async function writeGameFolder(FS, entries) {
  ensureDir(FS, '/work/game');
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var path = (entry.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path) continue;
    var dir = parentDir(path);
    if (dir) ensureDir(FS, '/work/game/' + dir);
    var bytes = await readEntryBytes(entry);
    FS.writeFile('/work/game/' + path, bytes);
    if ((i % 8) === 0 || i + 1 === entries.length) {
      var pct = 8 + Math.round(((i + 1) / entries.length) * 32);
      postProgress(pct, 'Copying game folder into memory... ' + (i + 1) + '/' + entries.length);
    }
  }
}

async function applyDeltaruneChapterOneProfileConfig(FS) {
  postProgress(6, 'Loading Deltarune Chapter 1 profile config...');
  var response = await fetch(deltaruneChapterOneConfigUrl);
  if (!response.ok) throw new Error('Could not load Deltarune Chapter 1 profile config.');
  var bytes = new Uint8Array(await response.arrayBuffer());
  try {
    if (FS.analyzePath('/game_profiles.cfg').exists) FS.unlink('/game_profiles.cfg');
  } catch (err) {}
  FS.writeFile('/game_profiles.cfg', bytes);
  postLog('Using Deltarune Chapter 1-only preprocessor config.');
}

function removeRecursive(FS, path) {
  var info = FS.analyzePath(path);
  if (!info.exists) return;
  var stat = FS.stat(path);
  if (FS.isDir(stat.mode)) {
    FS.readdir(path).forEach(function(name) {
      if (name === '.' || name === '..') return;
      removeRecursive(FS, path + '/' + name);
    });
    FS.rmdir(path);
  } else {
    FS.unlink(path);
  }
}

function collectFiles(FS, root, relativeRoot, out) {
  FS.readdir(root).forEach(function(name) {
    if (name === '.' || name === '..') return;
    var path = root + '/' + name;
    var relativePath = relativeRoot ? relativeRoot + '/' + name : name;
    var stat = FS.stat(path);
    if (FS.isDir(stat.mode)) {
      collectFiles(FS, path, relativePath, out);
    } else {
      var bytes = FS.readFile(path, { encoding: 'binary' });
      out.push({ name: relativePath, bytes: bytes });
    }
  });
}

self.onmessage = async function(event) {
  if (event.data.type !== 'run') return;
  try {
    postProgress(3, 'Loading WASM preprocessor...');
    var module = await createPreprocessor({
      thisProgram: 'cinnamon-preprocessor',
      locateFile: function(path) { return new URL(path, wasmBaseUrl).href; },
      preprocessProgress: postProgress,
      print: postLog,
      printErr: postLog,
      setStatus: function(status) {
        if (status) postLog(status);
      }
    });

    var FS = module.FS;
    await loadPreprocessorResources(FS);
    removeRecursive(FS, '/work');
    removeRecursive(FS, '/out');
    ensureDir(FS, '/work');
    ensureDir(FS, '/out');

    var target = event.data.target === 'wii' ? 'wii' : '3ds';
    var outputDir = target === 'wii'
      ? '/out/' + (event.data.wiiGameInstallPath || 'apps/cinnamon').replace(/^[/]+/, '')
      : '/out/3ds/cinnamon/' + safeOutputFolderName(event.data.gameFolderName);

    if (event.data.limitDeltaruneToChapterOne) {
      await applyDeltaruneChapterOneProfileConfig(FS);
    }

    postProgress(8, 'Copying game folder into memory...');
    await writeGameFolder(FS, event.data.files || []);

    postProgress(45, 'Running ' + target.toUpperCase() + ' asset preprocessor...');
    var inputPath = getPreprocessorInputPath(event.data.inputDataPath);
    var rc = module.callMain([inputPath, '--output', outputDir, '--target', target]);
    if (rc !== 0) throw new Error('cinnamon-preprocessor exited with code ' + rc);

    postProgress(88, 'Collecting generated files...');
    var files = [];
    collectFiles(FS, '/out', '', files);
    if (!files.length) throw new Error('No output files were generated.');

    var transfers = files.map(function(file) { return file.bytes.buffer; });
    self.postMessage({ type: 'done', files: files }, transfers);
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    if (lastLogLine) message += '\nLast log: ' + lastLogLine;
    self.postMessage({
      type: 'error',
      message: message
    });
  }
};
