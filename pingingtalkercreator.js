function createPingingTalker(lib, TalkerBase) {
  'use strict';

  var q = lib.q,
    PING_PERIOD = 10*lib.intervals.Second;

  function pingponginitiator (pt, initiator) {
    if (!pt) {
      pt = null;
      return;
    }
    if (initiator) {
      pt.startNewSelfDestruction();
      pt.processPong(lib.now()-5);
      pt = null;
      return;
    }
    pt.processPing();
    pt = null;
  }
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
    this.whenPingFailerWasSet = null;
    lib.runNext(pingponginitiator.bind(null, this, initiator));
  }
  lib.inherit(PingingTalker, TalkerBase);
  PingingTalker.prototype.__cleanUp = function () {
    this.whenPingFailerWasSet = null;
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
    if (!this.isUsable()) {
      return;
    }
    //console.log(this.id, this.constructor.name, 'pinging with', this.clients.count, 'clients');
    this.lastping = lib.now();
    this.send(['?', this.lastping]);
  };
  PingingTalker.prototype.processPing = function (ping) {
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    this.whenPingFailerWasSet = lib.now();
    this.pingWaiter = lib.runNext(this.pingfailer, PING_PERIOD*2);
    if (ping) {
      this.send(['!', ping]);
    }
  };
  PingingTalker.prototype.onPingFailed = function () {
    console.error(new Date(), 'Ping miss!', lib.now()-this.whenPingFailerWasSet, this.type);
    this.destroy();
  };
  PingingTalker.prototype.processPong = function (pong) {
    var lag = lib.now()-pong,
      next = PING_PERIOD-lag;
    if (!this.isUsable()) {
      return;
    }
    //console.log(this.id, this.constructor.name, 'got pong with', this.clients.count, 'clients');
    if (next < 0) {
      this.ping();
      return;
    }
    this.pingSender = lib.runNext(this.pinger, next);
  };
  return PingingTalker;
}

module.exports = createPingingTalker;
