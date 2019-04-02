// npx cross-env DEBUG='demo' node demo/attach-databases.js

const fs = require('fs')
const path = require('path')
var marv = require('marv')
var sqlite3 = require('better-sqlite3')
var Driver = require('../index')
const debug = require('debug')('demo:attach-databases')

var config = {
    connection: {
        path: 'main.sqlite',
        options: {
            memory: false
        },
        databases: [
            {
                path: 'aux.sqlite',
                as: 'aux'
            }
        ]
    }
}
const driver = Driver(config)

try {
    const dropTables = load('drop-tables.sql')
    const aux = new sqlite3('aux.sqlite');
    const client = new sqlite3(config.connection.path, config.connection.options)
    client.exec(dropTables)
    aux.exec('DROP TABLE IF EXISTS baz;')
    marv.scan(path.join(__dirname, '../test/attach-databases'), function (err, migrations) {
        if (err) throw err
        marv.migrate(migrations, driver, function (err) {
            if (err) throw err

            client.exec(`ATTACH DATABASE 'aux.sqlite' as "aux";`)
            const result_baz = client.prepare('SELECT * FROM aux.baz').all()
            for (let row of result_baz) {
                debug(row)
            }
            aux.close()
            client.close()
        })
    })
} catch (err) {
    debug(err)
}

function load(filename) {
    return fs.readFileSync(path.join(__dirname, '../test/sql', filename), 'utf-8')
}
