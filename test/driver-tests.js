var Hath = require('hath')
var marv = require('marv')
var path = require('path')
var sqlite3 = require('better-sqlite3')
var fs = require('fs')
require('hath-assert')(Hath)

function shouldRunMigration(t, done) {
    const dropTables = load(t, ['sql', 'drop-tables.sql'])
    try {
        const client = new sqlite3(t.locals.config.connection.path, t.locals.config.connection.options);
        client.exec(dropTables)
        marv.scan(path.join(__dirname, 'migrations'), function (err, migrations) {
            if (err) throw err
            marv.migrate(migrations, t.locals.driver, function (err) {
                if (err) throw err
                const result_foo = client.prepare('SELECT * FROM foo').all();
                t.assertEquals(result_foo.length, 1)
                t.assertEquals(result_foo[0].id, 1)
                t.assertEquals(result_foo[0].value, 'foo')

                const result_bar = client.prepare('SELECT * FROM bar').all();
                t.assertEquals(result_bar.length, 1)
                t.assertEquals(result_bar[0].id, 1)
                t.assertEquals(result_bar[0].value, 'bar')
                client.close()
                done()
            })
        })
    } catch (err) {
        throw err
    }
}

function load(t, location) {
    return fs.readFileSync(path.join.apply(null, [__dirname].concat(location)), 'utf-8').replace(/migrations/g, t.locals.config.table)
}

module.exports = Hath.suite('Driver Tests', [
    shouldRunMigration
])
