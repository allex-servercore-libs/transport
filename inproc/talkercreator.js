function createInProcTalker(lib, TalkerBase) {
  'use strict';

  function InProcTalker(inprocgate) {
    TalkerBase.call(this);
    this.gate = inprocgate;
    this.gateDestroyedListener = null;
    if (!(this.gate && this.gate.service && this.gate.service.destroyed)) {
      this.destroy();
      return;
    }
    this.gateDestroyedListener = this.gate.service.destroyed.attach(this.onServiceDown.bind(this));
  }
  lib.inherit(InProcTalker, TalkerBase);
  InProcTalker.prototype.__cleanUp = function () {
    if (this.gateDestroyedListener) {
      this.gateDestroyedListener.destroy();
    }
    this.gateDestroyedListener = null;
    this.gate = null;
    TalkerBase.prototype.__cleanUp.call(this);
  };
  InProcTalker.prototype.onServiceDown = function () {
    if (this.gate) {
      this.destroy(new lib.Error('INPROC_SERVICE_DOWN'));
    }
  };
  InProcTalker.prototype.send = function (obj) {
    if (!this.gate) {
      return;
    }
    this.gate.processMessage(obj, this);
  };
  InProcTalker.prototype.type = 'inproc';

  return InProcTalker;
}

module.exports = createInProcTalker;
