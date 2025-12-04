export class UI {
  constructor({ screen, status, log, diskSizeInput, ramSizeInput, buttons, isoInput, bootOrderLabel, dbNameLabel }) {
    this.screen = screen;
    this.$status = status;
    this.$log = log;
    this.diskSizeInput = diskSizeInput;
    this.ramSizeInput = ramSizeInput;
    this.buttons = buttons;
    this.isoInput = isoInput;
    this.bootOrderLabel = bootOrderLabel;
    this.dbNameLabel = dbNameLabel;
  }

  setStatus(msg) { this.$status.textContent = msg; }
  log(msg) {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.$log.appendChild(div);
    this.$log.scrollTop = this.$log.scrollHeight;
  }

  onBoot(fn) { this.buttons.boot.addEventListener('click', fn); }
  onReset(fn) { this.buttons.reset.addEventListener('click', fn); }
  onPowerOff(fn) { this.buttons.powerOff.addEventListener('click', fn); }

  onIsoFile(fn) {
    this.isoInput.addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (f) fn(f);
    });
  }
}
