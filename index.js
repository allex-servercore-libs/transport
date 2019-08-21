function createTalkerFactory (lib) {
  'use strict';
  var TalkerBase = require('./talkerbasecreator')(lib),
    PingingTalker = require('./pingingtalkercreator')(lib, TalkerBase),
    InProcTalker = require('./inproc/talkercreator')(lib, TalkerBase),
    tcpTalkerFactory = require('./socket/factorycreator')(lib, PingingTalker),
    WSTalker = require('./ws/talkercreator')(lib, PingingTalker),
    ProcessTalker = require('./process/talkercreator')(lib, TalkerBase),
    HttpTalker = require('./http/talkercreator')(lib);

  function TalkerFactory(){
  }
  TalkerFactory.prototype.newInProcTalker = function (gate) {
    return new InProcTalker(gate);
  };
  TalkerFactory.prototype.newProcessTalker = function (jstofork, options) {
    return new ProcessTalker(jstofork, options);
  };
  TalkerFactory.prototype.newTcpTalker = function (socketoraddress, cborport, acceptor) {
    return tcpTalkerFactory(socketoraddress, cborport, acceptor);
  };
  TalkerFactory.prototype.newWSTalker = function (connectionstring, address, port, defer) {
    return new WSTalker(connectionstring, address, port, defer);
  };
  TalkerFactory.prototype.HttpTalker = HttpTalker;

  return TalkerFactory;
}

module.exports = createTalkerFactory;
