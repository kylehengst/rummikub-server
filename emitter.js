class Emitter {
  constructor() {
    this.onListeners = {};
  }

  on(name, callback) {
    if (!this.onListeners[name]) {
      this.onListeners[name] = [];
    }
    this.onListeners[name].push(callback);
  }

  off(name, callback) {
    if (!this.onListeners[name]) {
      return;
    }
    let i = this.onListeners[name].indexOf(callback);
    if (i > -1) {
      this.onListeners[name].splice(i, 1);
    }
  }

  emit(name, args) {
    // this.listeners.forEach((cb) => {
    //   cb(name, args);
    // });
    if (this.onListeners[name]) {
      let length = this.onListeners[name].length * 1;
      for (let i = 0; i < length; i++) {
        if (this.onListeners[name] && this.onListeners[name][i]) {
          this.onListeners[name][i](args);
        }
      }
    }
  }

  reset() {
    this.onListeners = {};
  }
}
module.export = Emitter;
