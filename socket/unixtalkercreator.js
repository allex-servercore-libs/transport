function createUnixTalker(lib, PingingTalker) {
  'use strict';
  function UnixTalker(socket, cb, acceptor) {
    PingingTalker.call(this, socket, cb, acceptor);
    this.endSent = false;
  }
  lib.inherit(UnixTalker, PingingTalker);
  UnixTalker.prototype.__cleanUp = function () {
    this.endSent = null;
    PingingTalker.prototype.__cleanUp.call(this);
  };
  UnixTalker.prototype.disposeOfSocket = lib.dummyFunc;
  UnixTalker.prototype.parsePDU = function (result, item) {
    if (lib.isString(item) && item === '-') {
      if (this.invalidator) {
        this.invalidator();
      }
      return result;
    }
    return PingingTalker.prototype.parsePDU.call(this, result, item);
  };
  UnixTalker.prototype.detachFromSocket = function () {
    if (this.socket) {
      if (this.endSent === false) {
        this.endSent = true;
        this.send('-');
      }
    }
    PingingTalker.prototype.detachFromSocket.call(this);
  };
  UnixTalker.prototype.subType = 'unix';
  return UnixTalker;
}

module.exports = createUnixTalker;
