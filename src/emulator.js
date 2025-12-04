import { DiskPager } from './diskPager.js';

// v86 from CDN (unpkg). We dynamically import the JS and point to the WASM.
const V86_JS_URL = 'https://unpkg.com/v86/build/v86.js';
const V86_WASM_URL = 'https://unpkg.com/v86/build/v86.wasm';

export class Emulator {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.memoryMB = opts.memoryMB ?? 512;
    this.onLog = opts.onLog ?? (() => {});
    this.onStatus = opts.onStatus ?? (() => {});
    this.onBootOrder = opts.onBootOrder ?? (() => {});
    this.v86 = null;

    this.cdromBlob = null;
    this.hddBytes = (opts.hddGB ?? 8) * 1024 * 1024 * 1024;
    this.diskPager = new DiskPager({});
  }

  async #loadV86() {
    // Dynamic import via blob to allow module semantics
    const res = await fetch(V86_JS_URL);
    const src = await res.text();
    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const mod = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);
    return mod;
  }

  async start() {
    this.onStatus('Initializing emulator...');
    const V86 = await this.#loadV86();

    const hda = this.diskPager.asBlockDevice(this.hddBytes);

    let cdromImage = null;
    if (this.cdromBlob) cdromImage = await this.cdromBlob.arrayBuffer();

    // Boot order: 0x132 → Floppy, CD-ROM, HDD (favor CD first)
    const bootOrderHex = 0x132;
    this.onBootOrder('CD → HDD');

    this.v86 = new V86.V86({
      wasm_path: V86_WASM_URL,
      memory_size: this.memoryMB * 1024 * 1024,
      screen_container: this.canvas,
      hda,
      cdrom: cdromImage ? { buffer: cdromImage } : undefined,
      boot_order: bootOrderHex,
      autostart: true,
    });

    this.v86.add_listener('emulator-started', () => this.onStatus('Booting from CD…'));
    this.v86.add_listener('download-progress', (p) => this.onStatus(`Emulator progress: ${Math.floor(p * 100)}%`));
    this.v86.add_listener('screen-set-mode', () => this.onLog('Screen mode changed'));
    this.v86.add_listener('screen-update', () => {/* dirty-rect handled internally by v86 */});

    this.onLog('Emulator started. Expect long load times for Windows Setup.');
  }

  async attachCdrom(blob) {
    this.cdromBlob = blob;
    if (!this.v86) {
      this.onStatus('ISO attached. It will boot from CD on start.');
      this.onBootOrder('CD → HDD');
      return;
    }
    const buf = await blob.arrayBuffer();
    this.v86.set_cdrom_image(buf);
    this.v86.set_boot_order(0x132);
    this.onBootOrder('CD → HDD');
    this.onStatus('ISO mounted. Reset to boot from CD.');
  }

  async setHddFirst() {
    if (!this.v86) return;
    this.v86.set_boot_order(0x123); // Floppy, HDD, CD
    this.onBootOrder('HDD → CD');
    this.onStatus('Boot order set to HDD first.');
  }

  async reset() {
    if (!this.v86) return;
    this.v86.restart();
    this.onStatus('Resetting emulator…');
  }

  async stop() {
    if (!this.v86) return;
    this.v86.stop();
    this.onStatus('Powered off.');
  }
}
