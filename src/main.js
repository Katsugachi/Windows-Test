import { UI } from './ui.js';
import { Emulator } from './emulator.js';

const ui = new UI({
  screen: document.getElementById('screen'),
  status: document.getElementById('status'),
  log: document.getElementById('log'),
  diskSizeInput: document.getElementById('diskSize'),
  ramSizeInput: document.getElementById('ramSize'),
  buttons: {
    boot: document.getElementById('btnBoot'),
    reset: document.getElementById('btnReset'),
    powerOff: document.getElementById('btnPowerOff'),
  },
  isoInput: document.getElementById('isoInput'),
  bootOrderLabel: document.getElementById('bootOrder'),
  dbNameLabel: document.getElementById('dbName'),
});

ui.setStatus('Ready. Load an ISO, set disk/RAM, then Boot.');

let emu = null;

function ensureEmu() {
  if (emu) return emu;
  const diskGB = Math.max(4, Math.min(32, Number(ui.diskSizeInput.value || 8)));
  const ramMB = Math.max(256, Math.min(1024, Number(ui.ramSizeInput.value || 512)));
  emu = new Emulator({
    canvas: ui.screen,
    memoryMB: ramMB,
    hddGB: diskGB,
    onLog: msg => ui.log(msg),
    onStatus: s => ui.setStatus(s),
    onBootOrder: order => ui.bootOrderLabel.textContent = order,
  });
  return emu;
}

ui.onIsoFile(async (file) => {
  const e = ensureEmu();
  ui.setStatus(`ISO selected: ${file.name}`);
  await e.attachCdrom(file);
  ui.setStatus('ISO attached. Click Boot to start from CD.');
});

ui.onBoot(async () => {
  const e = ensureEmu();
  ui.setStatus('Starting emulator...');
  await e.start();
});

ui.onReset(() => {
  emu?.reset();
});

ui.onPowerOff(() => {
  emu?.stop();
  emu = null;
  ui.setStatus('Powered off. Reload ISO and Boot to start again.');
});

// Helpful logging for quota issues
window.addEventListener('error', (ev) => ui.log(`Error: ${ev.message}`));
window.addEventListener('unhandledrejection', (ev) => ui.log(`Unhandled: ${ev.reason}`));
