function createPingingTalker(lib, TalkerBase) {
  'use strict';

  var q = lib.q,
    PING_PERIOD = 10*lib.intervals.Second;

  function PingingTalker(initiator) {
    if ('boolean' !== typeof initiator) {
      console.trace();
      process.exit(0);
      return;
    }
    TalkerBase.call(this);
    this.lastping = null;
    this.destroyer = this.destroy.bind(this);
    this.pinger = this.ping.bind(this);
    this.pingfailer = this.onPingFailed.bind(this);
    this.pingWaiter = null;
    this.pingSender = null;
    if (initiator) {
      this.processPong(Date.now()-5);
    } else {
      this.processPing();
    }
  }
  lib.inherit(PingingTalker, TalkerBase);
  PingingTalker.prototype.__cleanUp = function () {
    if (this.pingSender) {
      lib.clearTimeout(this.pingSender);
    }
    this.pingSender = null;
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    this.pingWaiter = null;
    this.pingfailer = null;
    this.pinger = null;
    this.destroyer = null;
    this.lastping = null;
    TalkerBase.prototype.__cleanUp.call(this);
  }
  PingingTalker.prototype.ping = function () {
    this.lastping = Date.now();
    this.send(['?', this.lastping]);
  };
  PingingTalker.prototype.processPing = function (ping) {
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    this.pingWaiter = lib.runNext(this.pingfailer, PING_PERIOD*2);
    if (ping) {
      this.send(['!', ping]);
    }
  };
  PingingTalker.prototype.onPingFailed = function () {
    console.error(new Date(), 'Ping miss!', this.type);
    this.destroy();
  };
  PingingTalker.prototype.processPong = function (pong) {
    var lag = Date.now()-pong,
      next = PING_PERIOD-lag;
    if (next < 0) {
      this.ping();
      return;
    }
    this.pingSender = lib.runNext(this.pinger, next);
  };
  return PingingTalker;
}

module.exports = createPingingTalker;
