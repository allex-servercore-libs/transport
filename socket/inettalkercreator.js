function createInetTalker(lib, PingingTalker) {
  'use strict';
  function InetTalker(socket, cb, acceptor) {
    PingingTalker.call(this, socket, cb, acceptor);
    this.endSent = false;
    this.ender = this.onOtherSideClosed.bind(this);
    if (!acceptor) {
      this.socket.setKeepAlive(true, this.KEEP_ALIVE_INTERVAL);
    }
    socket.on('end',this.ender);
  }
  lib.inherit(InetTalker, PingingTalker);
  InetTalker.prototype.__cleanUp = function () {
    this.endSent = false;
    PingingTalker.prototype.__cleanUp.call(this);
  };
  InetTalker.prototype.detachFromSocket = function () {
    if (this.socket) {
      this.socket.removeListener('end',this.ender);
    }
    this.ender = null;
    PingingTalker.prototype.detachFromSocket.call(this);
  };
  InetTalker.prototype.disposeOfSocket = function () {
    if (this.socket && this.endSent === false) {
      this.endSent = true;
      this.log('will dispose of the socket on', this.socket.address());
      this.socket.end();
    }
  };
  InetTalker.prototype.onOtherSideClosed = function () {
    this.log('onOtherSideClosed');
    this.socket.destroy();
  };
  InetTalker.prototype.subType = 'inet';

  return InetTalker;
}

module.exports = createInetTalker;
