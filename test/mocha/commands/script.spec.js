var assert = require("assert");
var config = require("../../lib/config");
var crypto = require("crypto");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'script' method", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        });
    })

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);
        var command = "return 99";
        var commandSha = crypto.createHash('sha1').update(command).digest('hex');

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, args);
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(function (err) {
                        if (!nodeAssert.serverVersionAtLeast(client, [2, 6, 0])) {
                          err = Error('script not supported in redis <= 2.6.0')
                        }
                        return done(err);

                    })
                });
            });

            afterEach(function () {
                client.end();
            });

            it("loads script with client.script('load')", function (done) {
                client.script("load", command, function(err, result) {
                    assert.strictEqual(result, commandSha);
                    return done();
                });
            });

            it('allows a loaded script to be evaluated', function (done) {
                client.evalsha(commandSha, 0, nodeAssert.isString('99', done));
            })

            it('allows a script to be loaded as part of a chained transaction', function (done) {
                client.multi().script("load", command).exec(function(err, result) {
                    assert.strictEqual(result[0], commandSha);
                    return done()
                })
            })

            it("allows a script to be loaded using a transaction's array syntax", function (done) {
                client.multi([['script', 'load', command]]).exec(function(err, result) {
                    assert.strictEqual(result[0], commandSha);
                    return done()
                })
            })
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
