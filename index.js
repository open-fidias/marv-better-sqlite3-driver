
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const debug = require('debug')('marv:better-sqlite3-driver')
const marv = require('marv')
const pkg = require('./package.json')
const format = require('util').format
const supportedDirectives = ['audit', 'comment', 'skip']

module.exports = function(options) {

    const config = _.merge({ table: 'migrations', connection: {} }, _.omit(options, 'logger'))
    const logger = options.logger || console
    const SQL = {
        ensureMigrationsTables: load('ensure-migrations-tables.sql'),
        retrieveMigrations: load('retrieve-migrations.sql'),
        dropMigrationsTables: load('drop-migrations-tables.sql'),
        lockMigrationsLockTable: load('lock-migrations-lock-table.sql'),
        unlockMigrationsLockTable: load('unlock-migrations-lock-table.sql'),
        insertMigration: load('insert-migration.sql')
    }

    const sqlite3 = config.sqlite3 || require('better-sqlite3')
    let lockClient
    let migrationClient
    let userClient

    function connect(cb) {
        const { path, options } = config.connection
        lockClient = new sqlite3(path, options)
        migrationClient = new sqlite3(path, options)
        userClient = new sqlite3(path, options)
        debug('Connecting to %s', getLoggableUrl())
        attachDatabases(cb)
    }

    function disconnect(cb) {
        debug('Disconnecting from %s', getLoggableUrl())
        detachDatabases()
        lockClient.close(),
        migrationClient.close(),
        userClient.close()
        cb()
    }

    function attachDatabases(cb) {
        const { databases } = config.connection
        if (databases && _.isArray(databases)) {
            for (let db of databases) {
                const { path, as } = db
                userClient.exec(`ATTACH DATABASE '${path}' as "${as}";`)
            }
        }
        cb()
    }

    function detachDatabases(cb) {
        const { databases } = config.connection
        if (databases && _.isArray(databases)) {
            for (let db of databases) {
                const { as } = db
                userClient.exec(`DETACH DATABASE "${as}";`)
            }
        }

        if (cb) {
            cb()
        }
    }

    function dropMigrations(cb) {
        try {
            debug('Drop migrations ...')
            migrationClient.exec(SQL.dropMigrationsTables)
            cb(null)
        } catch (err) {
            return cb(err)
        }
    }

    function ensureMigrations(cb) {
        try {
            debug('Ensure migrations ...')
            migrationClient.exec(SQL.ensureMigrationsTables)
            cb(null)
        } catch (err) {
            cb(err)
        }
    }

    function lockMigrations(cb) {
        try {
            debug('Lock migrations ...')
            lockClient.exec(SQL.lockMigrationsLockTable)
            cb(null)
        } catch (err) {
            cb(err)
        }
    }

    function unlockMigrations(cb) {
        try {
            debug('Unlock migrations ...')
            lockClient.exec(SQL.unlockMigrationsLockTable)
            setTimeout(() => {
                cb()
            }, 0)
        } catch (err) {
            cb(err)
        }
    }

    function getMigrations(cb) {
        try {
            const rows = migrationClient.prepare(SQL.retrieveMigrations).all();
            const result = rows.map(item => {
                return {
                    ...item,
                    timestamp: new Date(item.timestamp)
                };
            });
            cb(null, result)
        } catch (err) {
            return cb(err)
        }
    }

    function runMigration(migration, cb) {
        _.defaults(migration, { directives: {}  });

        checkDirectives(migration.directives)

        if (/^true$/i.test(migration.directives.skip)) {
            debug('Skipping migration %s: %s\n%s', migration.level, migration.comment, migration.script)
            return cb()
        }

        debug('Run migration %s: %s\n%s', migration.level, migration.comment, migration.script)
        try {
            userClient.exec(migration.script)
            if (auditable(migration)) {
                const stmt = migrationClient.prepare(SQL.insertMigration);
                stmt.run(
                    migration.level,
                    migration.directives.comment || migration.comment,
                    migration.timestamp.getTime(),
                    migration.checksum,
                    migration.namespace || 'default'
                );
            }
            cb()
        } catch (err) {
            cb(decorate(err, migration))
        }
    }

    function checkDirectives(directives) {
        var unsupportedDirectives = _.chain(directives).keys().difference(supportedDirectives).value()
        if (unsupportedDirectives.length === 0) return
        if (!config.quiet) {
            logger.warn('Ignoring unsupported directives: %s. Try upgrading %s.', unsupportedDirectives, pkg.name)
        }
    }

    function auditable(migration) {
        if (migration.hasOwnProperty('directives')) return !/^false$/i.test(migration.directives.audit)
        if (migration.hasOwnProperty('audit')) {
            if (!config.quiet) logger.warn("The 'audit' option is deprecated. Please use 'directives.audit' instead.")
            return migration.audit !== false
        }
        return true
    }

    function load(filename) {
        return fs.readFileSync(path.join(__dirname, 'sql', filename), 'utf-8').replace(/migrations/g, config.table)
    }

    function decorate(err, migration) {
        return _.merge(err, { migration: migration })
    }

    function getLoggableUrl() {
        return format('sqlite3:%s', userClient.memory ? ':memory:' : userClient.name)
    }

    return {
        connect,
        disconnect,
        dropMigrations,
        ensureMigrations,
        lockMigrations,
        unlockMigrations,
        getMigrations,
        runMigration
    }
}
