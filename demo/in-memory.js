// npx cross-env DEBUG='demo*' node demo/in-memory.js

const fs = require('fs')
const path = require('path')
var marv = require('marv')
var sqlite3 = require('better-sqlite3')
var Driver = require('..')
const debug = require('debug')('demo:in-memory')

var config = {
    connection: {
        path: 'demo.sqlite',
        options: {
            memory: true
        }
    }
}
const driver = Driver(config)

try {
    const dropTables = load('drop-tables.sql')
    const client = new sqlite3(config.connection.path, config.connection.options);
    client.exec(dropTables)
    marv.scan(path.join(__dirname, '../test/migrations'), function (err, migrations) {
        if (err) throw err
        marv.migrate(migrations, driver, function (err) {
            if (err) throw err
            const result_foo = client.prepare('SELECT * FROM foo').all();
            debug(result_foo)
            debug(result_foo[0].id)
            debug(result_foo[0].value)

            const result_bar = client.prepare('SELECT * FROM bar').all();
            debug(result_bar)
            debug(result_bar[0].id)
            debug(result_bar[0].value)
            client.close()
        })
    })
} catch (err) {
    debug(err)
}

function load(filename) {
    return fs.readFileSync(path.join(__dirname, '../test/sql', filename), 'utf-8')
}
