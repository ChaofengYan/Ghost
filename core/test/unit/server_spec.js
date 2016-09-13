/*jshint unused:false*/
var should = require('should'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    rewire = require('rewire'),
    config = require('../../server/config'),
    versioning = require(config.get('paths').corePath + '/server/data/schema/versioning'),
    migration = require(config.get('paths').corePath + '/server/data/migration'),
    models = require(config.get('paths').corePath + '/server/models'),
    permissions = require(config.get('paths').corePath + '/server/permissions'),
    api = require(config.get('paths').corePath + '/server/api'),
    apps = require(config.get('paths').corePath + '/server/apps'),
    i18n = require(config.get('paths').corePath + '/server/i18n'),
    xmlrpc = require(config.get('paths').corePath + '/server/data/xml/xmlrpc'),
    slack = require(config.get('paths').corePath + '/server/data/slack'),
    scheduling = require(config.get('paths').corePath + '/server/scheduling'),
    bootstrap = rewire(config.get('paths').corePath + '/server'),
    sandbox = sinon.sandbox.create();

describe('server bootstrap', function () {
    var middlewareStub, resetMiddlewareStub, initDbHashAndFirstRunStub, resetInitDbHashAndFirstRunStub;

    before(function () {
        models.init();
    });

    beforeEach(function () {
        middlewareStub = sandbox.stub();
        initDbHashAndFirstRunStub = sandbox.stub();

        sandbox.stub(migration, 'populate').returns(Promise.resolve());
        sandbox.stub(models.Settings, 'populateDefaults').returns(Promise.resolve());
        sandbox.stub(permissions, 'init').returns(Promise.resolve());
        sandbox.stub(api, 'init').returns(Promise.resolve());
        sandbox.stub(i18n, 'init');
        sandbox.stub(apps, 'init').returns(Promise.resolve());
        sandbox.stub(slack, 'listen').returns(Promise.resolve());
        sandbox.stub(xmlrpc, 'listen').returns(Promise.resolve());
        sandbox.stub(scheduling, 'init').returns(Promise.resolve());

        resetMiddlewareStub = bootstrap.__set__('middleware', middlewareStub);
        resetInitDbHashAndFirstRunStub = bootstrap.__set__('initDbHashAndFirstRun', initDbHashAndFirstRunStub);
    });

    afterEach(function () {
        sandbox.restore();
        resetMiddlewareStub();
        resetInitDbHashAndFirstRunStub();
    });

    describe('migrations', function () {
        it('database does not exist: expect database population', function (done) {
            sandbox.stub(migration.update, 'isDatabaseOutOfDate').returns({migrate:false});

            sandbox.stub(versioning, 'getDatabaseVersion', function () {
                return Promise.reject();
            });

            bootstrap()
                .then(function () {
                    migration.populate.calledOnce.should.eql(true);
                    migration.update.execute.calledOnce.should.eql(false);
                    models.Settings.populateDefaults.callCount.should.eql(1);
                    config.get('maintenance').enabled.should.eql(false);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('database does exist: expect no update', function (done) {
            sandbox.stub(migration.update, 'isDatabaseOutOfDate').returns({migrate:false});
            sandbox.spy(migration.update, 'execute');

            sandbox.stub(versioning, 'getDatabaseVersion', function () {
                return Promise.resolve('006');
            });

            bootstrap()
                .then(function () {
                    migration.update.isDatabaseOutOfDate.calledOnce.should.eql(true);
                    migration.update.execute.called.should.eql(false);
                    models.Settings.populateDefaults.callCount.should.eql(1);
                    migration.populate.calledOnce.should.eql(false);

                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('database does exist: expect update', function (done) {
            sandbox.stub(migration.update, 'isDatabaseOutOfDate').returns({migrate:true});
            sandbox.stub(migration.update, 'execute').returns(Promise.resolve());

            sandbox.stub(versioning, 'getDatabaseVersion', function () {
                return Promise.resolve('006');
            });

            bootstrap()
                .then(function () {
                    migration.update.isDatabaseOutOfDate.calledOnce.should.eql(true);
                    migration.update.execute.calledOnce.should.eql(true);

                    migration.update.execute.calledWith({
                        fromVersion: '006',
                        toVersion: '007',
                        forceMigration: undefined
                    }).should.eql(true);

                    models.Settings.populateDefaults.callCount.should.eql(1);
                    migration.populate.calledOnce.should.eql(false);
                    config.get('maintenance').enabled.should.eql(false);

                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });
    });
});
