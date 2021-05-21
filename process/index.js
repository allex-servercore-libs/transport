function createProcessTalkerLib (lib, TalkerBase, PingingTalker, tcpTalkerFactory) {
  'use strict';

  var mylib = { };

  require('./talkermixincreator.js')(lib, TalkerBase, mylib);
  require('./talkercreator')(lib, TalkerBase, mylib);
  require('./externaltalkercreator')(lib, PingingTalker, mylib, tcpTalkerFactory);

  return mylib;
}
module.exports = createProcessTalkerLib;
