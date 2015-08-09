var assert = require("assert");
var config = require("../lib/config");
var path = require('path');
var redis = config.redis;
var RedisProcess = require("../lib/redis-process");

describe("client authentication", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        }, path.resolve(__dirname, '../conf/password.conf'));
    })

    function allTests(parser, ip) {
        describe("using " + parser + " and " + ip, function () {
            var args = config.configureClient(parser, ip);
            var auth = 'porkchopsandwiches';
            var client = null;

            afterEach(function () {
                client.end();
            });

            it("allows auth to be provided with 'auth' method", function (done) {
                client = redis.createClient.apply(redis.createClient, args);
                client.auth(auth, function (err, res) {
                    assert.strictEqual(null, err);
                    assert.strictEqual("OK", res.toString());
                    return done(err);
                });
            });

            if (ip === 'IPv4')
            it('allows auth to be provided as config option for client', function (done) {
                client = redis.createClient('redis://foo:' + auth + '@' + config.HOST[ip] + ':' + config.PORT);
                client.on("ready", function () {
                    return done();
                });
            });

            it('allows auth to be provided as part of redis url', function (done) {
                var args = config.configureClient(parser, ip, {
                    auth_pass: auth
                });
                client = redis.createClient.apply(redis.createClient, args);
                client.on("ready", function () {
                    return done();
                });
            });

            it('reconnects with appropriate authentication', function (done) {
                var readyCount = 0;
                client = redis.createClient.apply(redis.createClient, args);
                client.auth(auth);
                client.on("ready", function () {
                    readyCount++;
                    if (readyCount === 1) {
                        client.stream.destroy();
                    } else {
                        return done();
                    }
                });
            });
        });
    }

    ['javascript', 'hiredis'].forEach(function (parser) {
        allTests(parser, "/tmp/redis.sock");
        ['IPv4', 'IPv6'].forEach(function (ip) {
            allTests(parser, ip);
        })
    });

    after(function (done) {
      if (rp) rp.stop(done);
    });
});
