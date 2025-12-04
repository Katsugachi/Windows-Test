// Sparse paged disk backed by IndexedDB.
// Page size: 64 MB; sector size: 512 bytes.
export class DiskPager {
  constructor({ dbName = 'browser-emulator-db', store = 'disk_pages', pageSize = 64 * 1024 * 1024 }) {
    this.dbName = dbName;
    this.store = store;
    this.pageSize = pageSize;
    this.cache = new Map();
    this.maxCachePages = 8;
  }

  async #db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.store)) db.createObjectStore(this.store);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  #pageKey(i) { return `page:${i}`; }

  async #getPage(db, i) {
    const cached = this.cache.get(i);
    if (cached) return cached;
    const buf = await new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readonly');
      const req = tx.objectStore(this.store).get(this.#pageKey(i));
      req.onsuccess = () => resolve(req.result ? req.result : new ArrayBuffer(this.pageSize));
      req.onerror = () => reject(req.error);
    });
    this.cache.set(i, buf);
    if (this.cache.size > this.maxCachePages) {
      const victim = this.cache.keys().next().value;
      this.cache.delete(victim);
    }
    return buf;
  }

  async #putPage(db, i, buf) {
    this.cache.set(i, buf);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).put(buf, this.#pageKey(i));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async read(offset, target) {
    const db = await this.#db();
    let remaining = target.byteLength, tOff = 0;
    while (remaining > 0) {
      const pageIndex = Math.floor(offset / this.pageSize);
      const pageOffset = offset % this.pageSize;
      const chunk = Math.min(remaining, this.pageSize - pageOffset);
      const pageBuf = await this.#getPage(db, pageIndex);
      const pageView = new Uint8Array(pageBuf, pageOffset, chunk);
      target.set(pageView, tOff);
      remaining -= chunk;
      tOff += chunk;
      offset += chunk;
    }
  }

  async write(offset, source) {
    const db = await this.#db();
    let remaining = source.byteLength, sOff = 0;
    while (remaining > 0) {
      const pageIndex = Math.floor(offset / this.pageSize);
      const pageOffset = offset % this.pageSize;
      const chunk = Math.min(remaining, this.pageSize - pageOffset);
      const pageBuf = await this.#getPage(db, pageIndex);
      const pageView = new Uint8Array(pageBuf);
      pageView.set(source.subarray(sOff, sOff + chunk), pageOffset);
      await this.#putPage(db, pageIndex, pageBuf);
      remaining -= chunk;
      sOff += chunk;
      offset += chunk;
    }
  }

  asBlockDevice(totalBytes) {
    const sectorSize = 512;
    const sectors = Math.floor(totalBytes / sectorSize);
    return {
      sector_size: sectorSize,
      nb_sectors: sectors,
      read: async (sector, num, buffer) => {
        const offset = sector * sectorSize;
        const bytes = num * sectorSize;
        await this.read(offset, new Uint8Array(buffer, 0, bytes));
      },
      write: async (sector, num, buffer) => {
        const offset = sector * sectorSize;
        const bytes = num * sectorSize;
        await this.write(offset, new Uint8Array(buffer, 0, bytes));
      },
    };
  }
}
