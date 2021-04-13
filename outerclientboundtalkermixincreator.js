function createOuterClientBoundTalkerMixin (lib) {
  function OuterClientBoundTalkerMixin (address, port, defer) {
    this.address = address;
    this.port = port;
    this.defer = defer;
    this.errorer = this.onBoundClientError.bind(this);
  }
  OuterClientBoundTalkerMixin.prototype.destroy = function () {
    this.errorer = null;
    this.defer = null;
    this.port = null;
    this.address = null;
  };
  OuterClientBoundTalkerMixin.prototype.onBoundClientError = function (error) {
    var err;
    if (!('code' in error)) {
      err = new lib.NoServerError('ws',this.address,this.port);
    } else {
      switch(error.code){
        case 'ENOTFOUND':
          err = new lib.DestinationError('ws',this.address,this.port);
          break;
        case 'ECONNREFUSED':
          err = new lib.NoServerError('ws',this.address,this.port);
          break;
        default:
          //setTimeout(this.connect.bind(this),100);
          err = error;
          break;
      }
    }
    if (this.defer) {
      this.defer.reject(err);
      this.defer = null;
    }
    this.unSetHandlers();
    this.wsock = null;
    if (err) {
      this.destroy(err);
    } else {
      this.destroy();
    }
  };

  OuterClientBoundTalkerMixin.addMethods = function (klass) {
    lib.inheritMethods(klass, OuterClientBoundTalkerMixin, [
      'onBoundClientError'
    ]);
  }

  return OuterClientBoundTalkerMixin;
}
module.exports = createOuterClientBoundTalkerMixin;
