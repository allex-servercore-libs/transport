var http = require('http');

function addSendRequest(HTTPTalker){
  'use strict';
  HTTPTalker.prototype.sendRequest = function(page,obj){
    http.request({
      host:this.host,
      port:this.port,
      path:page+this.queryize(obj)
    },this.onResponse.bind(this,page))
      .on('error',this.onError.bind(this,page,obj))
      .end();
  };
}

module.exports = addSendRequest;
