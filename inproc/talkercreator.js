function createInProcTalker(lib, TalkerBase) {
  'use strict';

  function InProcTalker(inprocgate) {
    TalkerBase.call(this);
    this.gate = inprocgate;
    this.incomer = this.onIncoming.bind(this);
    this.gate.service.destroyed.attachForSingleShot(this.onServiceDown.bind(this));
  }
  lib.inherit(InProcTalker, TalkerBase);
  InProcTalker.prototype.__cleanUp = function () {
    this.incomer = null;
    this.gate = null;
    TalkerBase.prototype.__cleanUp.call(this);
  };
  InProcTalker.prototype.onServiceDown = function () {
    if (this.gate) {
      this.destroy();
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
