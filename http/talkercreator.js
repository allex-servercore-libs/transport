function createHttpTalker (hers, q) {
  'use strict';
  function HTTPTalker(host,port,options){
    hers.Destroyable.call(this);
    this.host = host;
    this.port = port;
    this.jsonizer = (options && options.json)||false;
    this.defer = null;
    this.data = null;
    this.established = false;
  };
  hers.inherit(HTTPTalker,hers.Destroyable);
  HTTPTalker.prototype.__cleanUp = function(){
    if(this.defer && this.data){
      this.defer.resolve(this.data);
    }
    this.established = null;
    this.data = null;
    this.defer = null;
    this.jsonizer = null;
    this.port = null;
    this.host = null;
    hers.Destroyable.prototype.__cleanUp.call(this);
  };
  HTTPTalker.prototype.queryize = function(obj){
    var q = '';
    for(var i in obj){
      if(q){
        q+='&';
      }
      q+=i+'='+encodeURIComponent(obj[i]);
    }
    return q ? '?'+q : '';
  };
  HTTPTalker.prototype.onData = function(chunk){
    if(this.data!==null){
      this.data += chunk;
    }
  };
  HTTPTalker.prototype.onResponseEnd = function(){
    if(this.jsonizer){
      try{
        this.data = JSON.parse(this.data);
      }
      catch(e){
        console.log('JSON parse error:',e,'for',this.data);
        this.defer.reject(e);
        this.defer = null;
      }
    }
    if(this.defer){
      this.defer.resolve(this.data);
      this.defer = null;
      this.data = null;
    }
  };
  HTTPTalker.prototype.onResponse = function(page,res){
    if(!this.established){
      this.established = true;
    }
    if(!this.defer){
      return;
    }
    this.data = '';
    if(res.statusCode!='200'){
      this.defer.reject(res.statusCode);
      this.defer = null;
      return;
    }else{
      res.setEncoding('utf8');
      res.on('data',this.onData.bind(this));
      res.on('end',this.onResponseEnd.bind(this));
    }
  };
  HTTPTalker.prototype.onError = function(page,obj,e){
    if(this.established){
      this.destroy();
    }
    if(!this.host){
      return;
    }
    //console.log('HTTPTalker error',e.code ? e.code : '', this.host, this.port, page);
    setTimeout(this.sendRequest.bind(this,page,obj),1000);
  };
  HTTPTalker.prototype.tell = function(page,obj){
    if(this.defer){
      throw 'Telling already in progress';
    }
    this.defer = q.defer();
    this.sendRequest(page,obj);
    return this.defer.promise;
  };

  return HTTPTalker;

}
module.exports = createHttpTalker;

