const BLOCK_SIZE = 64 * 1024;
const READ_SIZE = 256 * 1024;
const CACHE_LIMIT = 16 * 1024 * 1024;
const errno = { NOENT: 44, INVAL: 28, NOTEMPTY: 55, ROFS: 69, IO: 29 };

export class FileCache {
  constructor(reader = new FileReaderSync()) {
    this.reader = reader;
    this.ids = new WeakMap();
    this.nextId = 0;
    this.blocks = new Map();
    this.bytes = 0;
    this.peakBytes = 0;
  }

  read(file, target, position, length = target.length) {
    length = Math.min(length, Math.max(0, file.size - position));
    let done = 0;
    if (!this.ids.has(file)) this.ids.set(file, this.nextId++);
    const id = this.ids.get(file);
    while (done < length) {
      const index = Math.floor((position + done) / READ_SIZE);
      const key = id + ':' + index;
      let data = this.blocks.get(key);
      if (data) {
        this.blocks.delete(key);
      } else {
        data = new Uint8Array(this.reader.readAsArrayBuffer(file.slice(index * READ_SIZE, (index + 1) * READ_SIZE)));
        while (this.bytes + data.length > CACHE_LIMIT && this.blocks.size) {
          const oldest = this.blocks.keys().next().value;
          this.bytes -= this.blocks.get(oldest).length;
          this.blocks.delete(oldest);
        }
        this.bytes += data.length;
        this.peakBytes = Math.max(this.peakBytes, this.bytes);
      }
      this.blocks.set(key, data);
      const offset = (position + done) % READ_SIZE;
      const count = Math.min(data.length - offset, length - done);
      if (count <= 0) throw new Error('The selected file changed or could not be read.');
      target.set(data.subarray(offset, offset + count), done);
      done += count;
    }
    return done;
  }
}

export async function openTemporaryFile(kind) {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle('cinnamon-preprocessor-cache', { create: true });
  const name = kind + '-' + Date.now() + '-' + crypto.randomUUID();
  const file = await directory.getFileHandle(name, { create: true });
  try {
    const handle = await file.createSyncAccessHandle();
    return { directory, name, file, handle };
  } catch (error) {
    await directory.removeEntry(name).catch(() => {});
    throw error;
  }
}

export async function discardTemporaryFile(temp) {
  if (!temp) return;
  if (temp.handle) {
    try { temp.handle.close(); } catch (_) {}
    temp.handle = null;
  }
  await temp.directory.removeEntry(temp.name).catch(() => {});
}

export async function cleanOldTemporaryFiles() {
  try {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('cinnamon-preprocessor-cache', { create: true });
    for await (const [name] of directory.entries()) {
      const match = /^(?:scratch|zip)-(\d+)-/.exec(name);
      if (match && Date.now() - Number(match[1]) > 24 * 60 * 60 * 1000) {
        await directory.removeEntry(name).catch(() => {});
      }
    }
  } catch (_) {}
}

export function mountFileSystem(FS, mountpoint, { entries, cache, temporary } = {}) {
  const readonly = !!entries;
  const freeBlocks = new Set();
  let allocated = 0;
  const scratch = new Uint8Array(BLOCK_SIZE);
  const fail = code => { throw new FS.ErrnoError(code); };
  const checkWritable = () => { if (readonly) fail(errno.ROFS); };
  const backend = { mount: () => createNode(null, '/', 0o40777) };

  function trimStorage() {
    const previous = allocated;
    while (allocated >= BLOCK_SIZE && freeBlocks.has(allocated - BLOCK_SIZE)) {
      allocated -= BLOCK_SIZE;
      freeBlocks.delete(allocated);
    }
    if (allocated !== previous) temporary.handle.truncate(allocated);
  }

  function release(node) {
    if (node.blocks) {
      for (const offset of node.blocks.values()) freeBlocks.add(offset);
      node.blocks.clear();
      if (temporary) trimStorage();
    }
    node.sourceFile = null;
    node.sourceSize = 0;
  }

  function unlinkNode(node) {
    node.deleted = true;
    if (!node.openCount) release(node);
  }

  function diskRead(target, at) {
    let done = 0;
    while (done < target.length) {
      const count = temporary.handle.read(target.subarray(done), { at: at + done });
      if (!count) fail(errno.IO);
      done += count;
    }
  }

  function diskWrite(source, at) {
    let done = 0;
    while (done < source.length) {
      const count = temporary.handle.write(source.subarray(done), { at: at + done });
      if (!count) fail(errno.IO);
      done += count;
    }
  }

  function createNode(parent, name, mode) {
    const node = FS.createNode(parent, name, mode, 0);
    node.node_ops = nodeOps;
    node.stream_ops = streamOps;
    node.atime = node.mtime = node.ctime = Date.now();
    node.size = 0;
    node.backend = backend;
    if (FS.isDir(mode)) node.contents = Object.create(null);
    else node.blocks = new Map();
    if (parent) parent.contents[name] = node;
    return node;
  }

  function read(node, target, position) {
    const length = Math.min(target.length, Math.max(0, node.size - position));
    let done = 0;
    while (done < length) {
      const index = Math.floor((position + done) / BLOCK_SIZE);
      const offset = (position + done) % BLOCK_SIZE;
      const count = Math.min(BLOCK_SIZE - offset, length - done);
      const part = target.subarray(done, done + count);
      const stored = node.blocks.get(index);
      if (stored !== undefined) {
        diskRead(part, stored + offset);
      } else {
        part.fill(0);
        if (node.sourceFile && position + done < node.sourceSize) {
          cache.read(node.sourceFile, part, position + done, Math.min(count, node.sourceSize - position - done));
        }
      }
      done += count;
    }
    return length;
  }

  function write(node, source, position) {
    if (!source.length) return 0;
    let done = 0;
    while (done < source.length) {
      const index = Math.floor((position + done) / BLOCK_SIZE);
      const offset = (position + done) % BLOCK_SIZE;
      const count = Math.min(BLOCK_SIZE - offset, source.length - done);
      let stored = node.blocks.get(index);
      if (stored === undefined) {
        stored = freeBlocks.size ? freeBlocks.values().next().value : allocated;
        freeBlocks.delete(stored);
        if (stored === allocated) allocated += BLOCK_SIZE;
        if (offset !== 0 || count !== BLOCK_SIZE) {
          scratch.fill(0);
          if (node.sourceFile && index * BLOCK_SIZE < node.sourceSize) {
            cache.read(node.sourceFile, scratch, index * BLOCK_SIZE, Math.min(BLOCK_SIZE, node.sourceSize - index * BLOCK_SIZE));
          }
          diskWrite(scratch, stored);
        }
        node.blocks.set(index, stored);
      }
      diskWrite(source.subarray(done, done + count), stored + offset);
      done += count;
    }
    node.size = Math.max(node.size, position + done);
    node.mtime = node.ctime = Date.now();
    return done;
  }

  const nodeOps = {
    getattr(node) {
      return { dev: 1, ino: node.id, mode: node.mode, nlink: 1, uid: 0, gid: 0, rdev: 0,
        size: FS.isDir(node.mode) ? 4096 : node.size, atime: new Date(node.atime),
        mtime: new Date(node.mtime), ctime: new Date(node.ctime), blksize: BLOCK_SIZE,
        blocks: Math.ceil(node.size / 512) };
    },
    setattr(node, attributes) {
      checkWritable();
      if (attributes.size !== undefined) {
        const size = attributes.size;
        if (size < 0) fail(errno.INVAL);
        if (size === 0) release(node);
        else if (size < node.size) {
          for (const [index, offset] of node.blocks) {
            if (index * BLOCK_SIZE >= size) {
              freeBlocks.add(offset);
              node.blocks.delete(index);
            }
          }
          const end = size % BLOCK_SIZE;
          const last = node.blocks.get(Math.floor(size / BLOCK_SIZE));
          if (end && last !== undefined) {
            scratch.fill(0);
            diskWrite(scratch.subarray(end), last + end);
          }
          node.sourceSize = Math.min(node.sourceSize || 0, size);
          trimStorage();
        }
        node.size = size;
      }
      for (const key of ['mode', 'atime', 'mtime', 'ctime']) {
        if (attributes[key] !== undefined) node[key] = attributes[key];
      }
    },
    lookup(parent, name) { return parent.contents[name] || fail(errno.NOENT); },
    mknod(parent, name, mode) { checkWritable(); return createNode(parent, name, mode); },
    rename(node, parent, name) {
      checkWritable();
      const replaced = parent.contents[name];
      if (replaced) {
        if (FS.isDir(replaced.mode) && Object.keys(replaced.contents).length) fail(errno.NOTEMPTY);
        unlinkNode(replaced);
        FS.hashRemoveNode(replaced);
      }
      delete node.parent.contents[node.name];
      parent.contents[name] = node;
      node.name = name;
      parent.mtime = parent.ctime = Date.now();
    },
    unlink(parent, name) { checkWritable(); unlinkNode(parent.contents[name]); delete parent.contents[name]; },
    rmdir(parent, name) {
      checkWritable();
      if (Object.keys(parent.contents[name].contents).length) fail(errno.NOTEMPTY);
      delete parent.contents[name];
    },
    readdir(node) { return ['.', '..', ...Object.keys(node.contents)]; },
  };
  const streamOps = {
    open(stream) { stream.node.openCount = (stream.node.openCount || 0) + 1; },
    dup(stream) { stream.node.openCount = (stream.node.openCount || 0) + 1; },
    close(stream) {
      const node = stream.node;
      node.openCount--;
      if (!node.openCount && node.deleted) release(node);
    },
    read(stream, buffer, offset, length, position) { return read(stream.node, buffer.subarray(offset, offset + length), position); },
    write(stream, buffer, offset, length, position) { checkWritable(); return write(stream.node, buffer.subarray(offset, offset + length), position); },
    llseek(stream, offset, whence) {
      const position = offset + (whence === 1 ? stream.position : whence === 2 ? stream.node.size : 0);
      if (!Number.isSafeInteger(position) || position < 0) fail(errno.INVAL);
      return position;
    },
  };

  FS.mkdirTree(mountpoint);
  const root = FS.mount(backend, {}, mountpoint);
  if (entries) {
    for (const entry of entries) {
      const path = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
      const parts = path.split('/');
      if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid input path: ' + path);
      let parent = root;
      for (const name of parts.slice(0, -1)) {
        parent = parent.contents[name] || createNode(parent, name, 0o40777);
        if (!FS.isDir(parent.mode)) throw new Error('Conflicting input paths: ' + path);
      }
      if (!entry.file && !entry.bytes) throw new Error('Could not read ' + path + '.');
      const file = entry.file || new Blob([entry.bytes]);
      const node = createNode(parent, parts[parts.length - 1], 0o100444);
      node.sourceFile = file;
      node.sourceSize = node.size = file.size;
    }
  }

  return {
    cloneFile(source, destination) {
      const original = FS.lookupPath(source).node;
      if (!original.sourceFile || original.blocks.size) return false;
      if (FS.lookupPath(destination, { parent: true }).node.backend !== backend) return false;
      const stream = FS.open(destination, 'w');
      const node = stream.node;
      node.sourceFile = original.sourceFile;
      node.sourceSize = Math.min(original.sourceSize, original.size);
      node.size = original.size;
      FS.close(stream);
      return true;
    },
    sameFile(a, b) {
      const left = FS.lookupPath(a).node, right = FS.lookupPath(b).node;
      return left.sourceFile && left.sourceFile === right.sourceFile &&
        left.size === right.size && left.sourceSize === right.sourceSize &&
        !left.blocks.size && !right.blocks.size;
    },
    get allocatedBytes() { return allocated; },
  };
}
