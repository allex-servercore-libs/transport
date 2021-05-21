var cp = require('child_process');

function createProcessTalker(lib, TalkerBase, mylib) {
  'use strict';

  function ForkedProcessTalker(jstofork, options) {
    TalkerBase.call(this);
    mylib.ProcessTalkerMixin.call(this, jstofork, options);
  }
  lib.inherit(ForkedProcessTalker, TalkerBase);
  mylib.ProcessTalkerMixin.addMethods(ForkedProcessTalker);
  ForkedProcessTalker.prototype.__cleanUp = function () {
    mylib.ProcessTalkerMixin.prototype.destroy.call(this);
    TalkerBase.prototype.__cleanUp.call(this);
  };
  ForkedProcessTalker.prototype.onIncoming = function (message) {
    if (!mylib.ProcessTalkerMixin.prototype.onIncoming.call(this, message)) {
      return;
    }
    TalkerBase.prototype.onIncoming.call(this, message);
  };
  ForkedProcessTalker.prototype.cleanProcListeners = function () {
    if (this.destroyer) {
      this.proc.removeListener('exit', this.destroyer);
    }
    if (this.incomer) {
      this.proc.removeListener('message', this.incomer);
    }
  };
  ForkedProcessTalker.prototype.additionalMakeupOnExecArgv = function (execargs, options) {
    if (options.debug_brk) {
      execargs.push('--inspect-brk=' + options.debug_brk);
    } else if (options.debug) {
      execargs.push('--inspect');
    } else if (options.prof) {
      execargs.push('--prof');
    }
  };
  ForkedProcessTalker.prototype.doTheCreation = function (jstofork, args, forkoptions) {
    this.proc = cp.fork(jstofork, args, forkoptions);
    this.proc.on('message', this.incomer);
    this.proc.on('exit', this.destroyer);
  };
  ForkedProcessTalker.prototype.tryToSendToProcess = function (data) {
    if (!this.proc.connected) {
      return false;
    }
    //console.log('successfully');
    this.dump();
    this.proc.send(data);
    return true;
  };
  ForkedProcessTalker.prototype.dump = function () {
    this.procq.drain(this.proc.send.bind(this.proc));
    //this.procq.drain(this.drainer.bind(this));
  };
  ForkedProcessTalker.prototype.drainer = function (item) {
    console.log('need to send', arguments);
    this.proc.send(item);
  };

  mylib.ProcessTalker = ForkedProcessTalker;
}

module.exports = createProcessTalker;
