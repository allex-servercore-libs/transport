function createTalkerFactory (lib, signalR) {
  'use strict';
  var TalkerBase = require('./talkerbasecreator')(lib),
    PingingTalker = require('./pingingtalkercreator')(lib, TalkerBase),
    OuterClientBoundTalkerMixin = require('./outerclientboundtalkermixincreator')(lib),
    InProcTalker = require('./inproc/talkercreator')(lib, TalkerBase),
    tcpTalkerFactory = require('./socket/factorycreator')(lib, PingingTalker),
    WSTalker = require('./ws/talkercreator')(lib, PingingTalker, OuterClientBoundTalkerMixin),
    processTalkerLib = require('./process')(lib, TalkerBase, PingingTalker, tcpTalkerFactory),
    HttpTalker = require('./http/talkercreator')(lib, PingingTalker, OuterClientBoundTalkerMixin, signalR),
    ProcessTalker = processTalkerLib.ProcessTalker,
    ExternalProcessTalker = processTalkerLib.ExternalProcessTalker
    ;

  function TalkerFactory(){
  }
  TalkerFactory.prototype.newInProcTalker = function (gate) {
    return new InProcTalker(gate);
  };
  TalkerFactory.prototype.newProcessTalker = function (jstofork, options) {
    return new ProcessTalker(jstofork, options);
  };
  TalkerFactory.prototype.newExternalProcessTalker = function (jstofork, options) {
    return new ExternalProcessTalker(jstofork, options);
  };
  TalkerFactory.prototype.newTcpTalker = function (socketoraddress, cborport, acceptor) {
    return tcpTalkerFactory(socketoraddress, cborport, acceptor);
  };
  TalkerFactory.prototype.newWSTalker = function (connectionstring, address, port, defer) {
    return new WSTalker(connectionstring, address, port, defer);
  };
  TalkerFactory.prototype.newHttpTalker = function (connectionstring, address, port, defer) {
    return new HttpTalker(connectionstring, address, port, defer);
  };

  return TalkerFactory;
}

module.exports = createTalkerFactory;