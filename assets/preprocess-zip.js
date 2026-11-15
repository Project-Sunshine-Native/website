// Stored ZIP entries are written in bounded chunks. ZIP64 is used when an entry,
// archive offset or file count exceeds the classic ZIP limits.
const CHUNK_SIZE = 1024 * 1024;
const MAX32 = 0xFFFFFFFF;
const crcTables = Array.from({ length: 8 }, () => new Uint32Array(256));
for (let i = 0; i < 256; ++i) {
  let crc = i;
  for (let bit = 0; bit < 8; ++bit) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  crcTables[0][i] = crc >>> 0;
}
for (let table = 1; table < 8; ++table) {
  for (let i = 0; i < 256; ++i) {
    const crc = crcTables[table - 1][i];
    crcTables[table][i] = (crc >>> 8) ^ crcTables[0][crc & 255];
  }
}

export function updateCrc32(crc, bytes) {
  let i = 0;
  for (; i + 8 <= bytes.length; i += 8) {
    crc ^= bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    crc = crcTables[7][crc & 255] ^ crcTables[6][(crc >>> 8) & 255] ^
      crcTables[5][(crc >>> 16) & 255] ^ crcTables[4][crc >>> 24] ^
      crcTables[3][bytes[i + 4]] ^ crcTables[2][bytes[i + 5]] ^
      crcTables[1][bytes[i + 6]] ^ crcTables[0][bytes[i + 7]];
  }
  for (; i < bytes.length; ++i) crc = (crc >>> 8) ^ crcTables[0][(crc ^ bytes[i]) & 255];
  return crc >>> 0;
}

function u16(bytes, offset, value) { new DataView(bytes.buffer, bytes.byteOffset).setUint16(offset, value, true); }
function u32(bytes, offset, value) { new DataView(bytes.buffer, bytes.byteOffset).setUint32(offset, value, true); }
function u64(bytes, offset, value) {
  u32(bytes, offset, value % 0x100000000);
  u32(bytes, offset + 4, Math.floor(value / 0x100000000));
}

function stamp(date) {
  return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1),
    day: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
}

export function writeZip(files, writer, openEntry, onProgress = () => {}, date = new Date()) {
  const encoder = new TextEncoder();
  const timestamp = stamp(date);
  const buffer = new Uint8Array(CHUNK_SIZE);
  const central = [];
  let position = 0, completed = 0;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  function write(bytes) { writer.write(bytes); position += bytes.length; }

  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error('Invalid ZIP file size: ' + file.name);
    const name = encoder.encode(file.name.replace(/\\/g, '/'));
    if (!name.length || name.length > 65535) throw new Error('ZIP file name is too long: ' + file.name);
    const size64 = file.size >= MAX32;
    const offset64 = position >= MAX32;
    const local = new Uint8Array(30 + name.length + (size64 ? 20 : 0));
    u32(local, 0, 0x04034B50);
    u16(local, 4, size64 ? 45 : 20);
    u16(local, 6, 0x0808); // UTF-8 names, trailing CRC/size data descriptor.
    u16(local, 10, timestamp.time);
    u16(local, 12, timestamp.day);
    u32(local, 18, size64 ? MAX32 : 0);
    u32(local, 22, size64 ? MAX32 : 0);
    u16(local, 26, name.length);
    u16(local, 28, size64 ? 20 : 0);
    local.set(name, 30);
    if (size64) {
      const extra = 30 + name.length;
      u16(local, extra, 1); u16(local, extra + 2, 16);
      u64(local, extra + 4, file.size); u64(local, extra + 12, file.size);
    }
    const start = position;
    write(local);
    const reader = openEntry(file);
    let offset = 0, crc = 0xFFFFFFFF;
    try {
      while (offset < file.size) {
        const part = buffer.subarray(0, Math.min(buffer.length, file.size - offset));
        const count = reader.read(part, offset);
        if (count !== part.length) throw new Error('Incomplete file while creating ZIP: ' + file.name);
        crc = updateCrc32(crc, part);
        write(part);
        offset += count;
        completed += count;
        onProgress(completed, total, file.name);
      }
    } finally { reader.close?.(); }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const descriptor = new Uint8Array(size64 ? 24 : 16);
    u32(descriptor, 0, 0x08074B50); u32(descriptor, 4, crc);
    if (size64) { u64(descriptor, 8, file.size); u64(descriptor, 16, file.size); }
    else { u32(descriptor, 8, file.size); u32(descriptor, 12, file.size); }
    write(descriptor);

    const extraLength = (size64 ? 16 : 0) + (offset64 ? 8 : 0);
    const row = new Uint8Array(46 + name.length + (extraLength ? extraLength + 4 : 0));
    u32(row, 0, 0x02014B50);
    u16(row, 4, size64 || offset64 ? 45 : 20);
    u16(row, 6, size64 || offset64 ? 45 : 20);
    u16(row, 8, 0x0808);
    u16(row, 12, timestamp.time); u16(row, 14, timestamp.day);
    u32(row, 16, crc); u32(row, 20, size64 ? MAX32 : file.size); u32(row, 24, size64 ? MAX32 : file.size);
    u16(row, 28, name.length); u16(row, 30, extraLength ? extraLength + 4 : 0);
    u32(row, 42, offset64 ? MAX32 : start);
    row.set(name, 46);
    if (extraLength) {
      let at = 46 + name.length;
      u16(row, at, 1); u16(row, at + 2, extraLength); at += 4;
      if (size64) { u64(row, at, file.size); u64(row, at + 8, file.size); at += 16; }
      if (offset64) u64(row, at, start);
    }
    central.push(row);
  }

  const directoryStart = position;
  for (const row of central) write(row);
  const directorySize = position - directoryStart;
  const zip64 = files.length >= 65535 || directoryStart >= MAX32 || directorySize >= MAX32 || files.some(file => file.size >= MAX32);
  if (zip64) {
    const end64 = new Uint8Array(56);
    u32(end64, 0, 0x06064B50); u64(end64, 4, 44);
    u16(end64, 12, 45); u16(end64, 14, 45);
    u64(end64, 24, files.length); u64(end64, 32, files.length);
    u64(end64, 40, directorySize); u64(end64, 48, directoryStart);
    const end64Start = position;
    write(end64);
    const locator = new Uint8Array(20);
    u32(locator, 0, 0x07064B50); u64(locator, 8, end64Start); u32(locator, 16, 1);
    write(locator);
  }
  const end = new Uint8Array(22);
  u32(end, 0, 0x06054B50);
  u16(end, 8, Math.min(files.length, 65535)); u16(end, 10, Math.min(files.length, 65535));
  u32(end, 12, Math.min(directorySize, MAX32)); u32(end, 16, Math.min(directoryStart, MAX32));
  write(end);
  onProgress(total, total, '');
  return position;
}
