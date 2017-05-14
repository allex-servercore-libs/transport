function createSocketTalkerFactory(lib, TalkerBase) {
  var SocketTalkerBase = require('./talkercreator')(lib, TalkerBase),
    InetTalker = require('./inettalkercreator')(lib, SocketTalkerBase),
    UnixTalker = require('./unixtalkercreator')(lib, SocketTalkerBase);

  function factory(socket, cb, acceptor) {
    if (!(acceptor === true || acceptor === false)) {
      console.trace();
      process.exit(0);
    }
    if (!socket.remoteAddress) {
      return new UnixTalker(socket, cb, acceptor);
    } else {
      return new InetTalker(socket, cb, acceptor);
    }
  }

  return factory;
}

module.exports = createSocketTalkerFactory;
