import { FileCache, mountFileSystem, openTemporaryFile, discardTemporaryFile, cleanOldTemporaryFiles } from './preprocess-storage.js?v=20261114-memory-stream-2';
import { writeZip } from './preprocess-zip.js?v=20261114-memory-stream-2';

const wasmBaseUrl = new URL('./wasm/', import.meta.url);
const assetVersion = new URL(import.meta.url).searchParams.get('v') || '20261114-memory-stream-2';

function wasmAssetUrl(path) {
  const url = new URL(path, wasmBaseUrl);
  url.searchParams.set('v', assetVersion);
  return url;
}

async function createPreprocessor(options) {
  const factory = await import(wasmAssetUrl('cinnamon-preprocessor.mjs').href);
  return factory.default(options);
}

async function loadPreprocessorResources(FS) {
  const resources = ['game_profiles.cfg', 'resources/wii/icon.png', 'resources/wii/meta.xml'];
  await Promise.all(resources.map(async function(path) {
    const response = await fetch(wasmAssetUrl(path));
    if (!response.ok) throw new Error('Could not load preprocessor resource: ' + path);
    const destination = '/' + path;
    ensureDir(FS, parentDir(destination));
    FS.writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  }));
}

var lastLogLine = '';
var pendingLogs = [];
var context = null;

function flushLogs() {
  if (!pendingLogs.length) return;
  self.postMessage({ type: 'logs', lines: pendingLogs });
  pendingLogs = [];
}

function postProgress(pct, status) {
  flushLogs();
  self.postMessage({ type: 'progress', pct: pct, status: status });
}

function postLog(line) {
  lastLogLine = String(line);
  pendingLogs.push(lastLogLine);
  if (pendingLogs.length >= 64) flushLogs();
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
  return clean && !/^\.+$/.test(clean) ? clean : 'game';
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

function collectFiles(FS, root, relativeRoot, out) {
  FS.readdir(root).forEach(function(name) {
    if (name === '.' || name === '..') return;
    var path = root + '/' + name;
    var relativePath = relativeRoot ? relativeRoot + '/' + name : name;
    var stat = FS.stat(path);
    if (FS.isDir(stat.mode)) {
      collectFiles(FS, path, relativePath, out);
    } else {
      out.push({ name: relativePath, generatedPath: path, size: stat.size });
    }
  });
}

async function runConversion(data) {
  if (context) throw new Error('A conversion is already running.');
  const started = performance.now();
  postProgress(3, 'Loading WASM preprocessor...');
  const module = await createPreprocessor({
    thisProgram: 'cinnamon-preprocessor',
    locateFile: path => wasmAssetUrl(path).href,
    preprocessProgress: postProgress,
    print: postLog,
    printErr: postLog
  });
  const FS = module.FS;
  const cache = new FileCache();
  context = { module, FS, cache, temporary: null, zipTemporary: null };
  await loadPreprocessorResources(FS);
  ensureDir(FS, '/work');
  ensureDir(FS, '/out');
  postProgress(8, 'Opening selected game files...');
  mountFileSystem(FS, '/work/game', { entries: data.files || [], cache });

  try {
    context.temporary = await openTemporaryFile('scratch');
  } catch (error) {
    const inputBytes = (data.files || []).reduce((sum, entry) => sum + (entry.file ? entry.file.size : entry.bytes.byteLength), 0);
    if (inputBytes > 128 * 1024 * 1024) {
      throw new Error('Temporary browser storage is unavailable for this game. Enable site storage or try a regular browser window.');
    }
    postLog('Temporary browser storage is unavailable; using memory for generated files.');
  }
  if (context.temporary) {
    const output = mountFileSystem(FS, '/out', { cache, temporary: context.temporary });
    context.output = output;
    module.preprocessCopyFile = (source, destination) => output.cloneFile(source, destination);
    module.preprocessFilesEqual = (a, b) => output.sameFile(a, b);
    postLog('Using disk-backed temporary output; original game files are referenced without copying.');
  }

  const target = data.target === 'wii' ? 'wii' : '3ds';
  const zipRoot = target === '3ds' ? '3ds/cinnamon/' + safeOutputFolderName(data.gameFolderName) : '';
  const outputDir = target === 'wii'
    ? '/out/' + (data.wiiGameInstallPath || 'apps/cinnamon').replace(/^[/]+/, '') : '/out';
  postProgress(45, 'Running ' + target.toUpperCase() + ' asset preprocessor...');
  const rc = module.callMain([getPreprocessorInputPath(data.inputDataPath), '--output', outputDir, '--target', target]);
  if (rc !== 0) throw new Error('cinnamon-preprocessor exited with code ' + rc);
  const files = [];
  collectFiles(FS, '/out', zipRoot, files);
  if (!files.length) throw new Error('No output files were generated.');
  postLog('Conversion completed in ' + ((performance.now() - started) / 1000).toFixed(1) + ' seconds.');
  postLog('WASM heap: ' + (module.HEAPU8.length / 1048576).toFixed(1) + ' MiB; input cache: ' + (cache.peakBytes / 1048576).toFixed(1) + ' MiB.');
  if (context.output) postLog('Temporary output: ' + (context.output.allocatedBytes / 1048576).toFixed(1) + ' MiB on disk.');
  postProgress(88, 'Preparing download...');
  self.postMessage({ type: 'processed', files });
}

async function packageConversion(files) {
  if (!context) throw new Error('No conversion output is available.');
  const { FS, cache } = context;
  const generatedFiles = [];
  collectFiles(FS, '/out', '', generatedFiles);
  const generated = new Set(generatedFiles.map(file => file.generatedPath));
  const started = performance.now();
  postProgress(90, 'Creating ZIP...');
  let writer;
  try {
    context.zipTemporary = await openTemporaryFile('zip');
    let position = 0;
    writer = { write(bytes) {
      let done = 0;
      while (done < bytes.length) {
        const count = context.zipTemporary.handle.write(bytes.subarray(done), { at: position + done });
        if (!count) throw new Error('Temporary browser storage could not accept the ZIP. Check available disk space and site storage permissions.');
        done += count;
      }
      position += done;
    }};
  } catch (error) {
    await discardTemporaryFile(context.zipTemporary);
    context.zipTemporary = null;
    const total = files.reduce((sum, file) => sum + (file.generatedPath ? file.size : file.file ? file.file.size : file.bytes.byteLength), 0);
    if (total > 128 * 1024 * 1024) {
      throw new Error('Could not open temporary browser storage for this ZIP. Check available disk space and site storage permissions.');
    }
    const parts = [];
    writer = { write: bytes => parts.push(new Blob([bytes])), finish: () => new Blob(parts, { type: 'application/zip' }) };
    postLog('Creating ZIP in bounded Blob chunks because temporary browser storage is unavailable.');
  }

  const entries = files.map(file => ({ ...file,
    size: file.generatedPath ? file.size : file.file ? file.file.size : file.bytes.byteLength }));
  let lastProgress = 0;
  const size = writeZip(entries, writer, file => {
    if (file.generatedPath) {
      if (!generated.has(file.generatedPath)) throw new Error('Unknown generated file: ' + file.name);
      const stream = FS.open(file.generatedPath, 'r');
      return { read: (target, position) => FS.read(stream, target, 0, target.length, position), close() {
        FS.close(stream);
        // The ZIP owns the copied contents now. Reclaim scratch blocks as we
        // proceed so scratch output and the complete ZIP need not coexist.
        FS.unlink(file.generatedPath);
      } };
    }
    if (file.file) return { read: (target, position) => cache.read(file.file, target, position) };
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    return { read(target, position) { target.set(bytes.subarray(position, position + target.length)); return target.length; } };
  }, (done, total) => {
    if (performance.now() - lastProgress < 150 && done !== total) return;
    lastProgress = performance.now();
    postProgress(90 + (total ? Math.floor(done / total * 9) : 9), 'Creating ZIP... ' + (done / 1048576).toFixed(0) + ' / ' + (total / 1048576).toFixed(0) + ' MiB');
  });

  let zip;
  if (context.zipTemporary) {
    context.zipTemporary.handle.flush();
    context.zipTemporary.handle.close();
    context.zipTemporary.handle = null;
    zip = await context.zipTemporary.file.getFile();
  } else zip = writer.finish();
  await discardTemporaryFile(context.temporary);
  context.temporary = null;
  postLog('ZIP completed in ' + ((performance.now() - started) / 1000).toFixed(1) + ' seconds (' + (size / 1048576).toFixed(1) + ' MiB).');
  flushLogs();
  self.postMessage({ type: 'done', zip });
  context = null;
}

self.onmessage = async function(event) {
  try {
    if (event.data.type === 'run') {
      await cleanOldTemporaryFiles();
      await runConversion(event.data);
    } else if (event.data.type === 'package') {
      await packageConversion(event.data.files);
    }
  } catch (error) {
    if (context) {
      await discardTemporaryFile(context.temporary);
      await discardTemporaryFile(context.zipTemporary);
      context = null;
    }
    flushLogs();
    let message = error && error.message ? error.message : String(error);
    if (lastLogLine) message += '\nLast log: ' + lastLogLine;
    self.postMessage({ type: 'error', message });
  }
};
