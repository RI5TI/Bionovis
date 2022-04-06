const { app, BrowserWindow } = require('electron')
const WebSocket = require('ws');
const express = require('express');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const Connection = require('tedious').Connection;
const Request = require('tedious').Request;
const isMac = process.platform === 'darwin'

if(isMac) {
    app.dock.hide()                                     // - 1 - 
}

let config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json')));

const dbOptions = {
    server: config.db_host,
    authentication: {
        type: 'default',
        options: {
            userName: config.db_user,
            password: config.db_pass
        }
    },
    options: {
        database: config.db_name,
        port: parseInt(config.db_port)
    }
};
const TYPES = require('tedious').TYPES;

let request = null;
let connection = null;
let dbUpdateInterval = null;
let currentRows = [];

const expressApp = express();

const port = 3000;

expressApp.use(express.json());

const server = expressApp.listen(port);

let conn = null;

function printMessage(message, type) {
    const currDate = moment().format('DD/MM/YYYY HH:mm');
    let logFn = console.log;
    if (type === 'error') {
        logFn = console.error;
    }
    // logFn(`[${currDate}] ${message}`);
    if (conn) {
        conn.send(JSON.stringify({
            type: 'log',
            data: message
        }))
    } else {
        logFn(`[${currDate}] ${message}`);
    }
}

function onError(ws, err) {

    console.error(`onError: ${err.message}`);

}

function formatData(rows) {

    let data = {};

    rows.map(function (row) {

        let channelData = {
            name: row.NomeCanal,
            date: moment(row.datetime).format('YYYY-MM-DD HH:mm:00'),
            value: row.value.replace('.', '').replace(',', '.'),
            magnitude: row.Regra_Grandeza,
            light: row.Farol
        };

        if ( ! data.tag) {
            data.tag = row.TAG;
            data.channels = [channelData];
        } else {
            data.channels.push(channelData);
        }

    });

    return data;

}

function dbConnect(ws) {

    printMessage('Trying to connect to DB...');

    connection = new Connection(dbOptions);

    connection.on('end', function () {
        
        if (dbUpdateInterval) {
            clearInterval(dbUpdateInterval)
        }
        conn.send(JSON.stringify({
            type: 'dbDisconnected',
            data: null
        }))
        printMessage('DB connection closed...')
        printMessage('Waiting 5 secs to retry...');
        setTimeout(() => {
            dbConnect(ws);
        }, 5000)

    })

    connection.on('error', function (err) {

        if (dbUpdateInterval) {
            clearInterval(dbUpdateInterval)
        }
        conn.send(JSON.stringify({
            type: 'dbDisconnected',
            data: null
        }))
        printMessage('DB connection closed due to an error... ' + err.toString())
        
    });

    connection.on('connect', function (err) {

        if (err) {
            printMessage('Error while connecting to DB ' + err.toString(), 'error');
            return;
        }

        conn.send(JSON.stringify({
            type: 'dbConnected',
            data: null
        }))
        
        printMessage('Successfully connected to database!');
    
        printMessage('Setting up DB request.');

        request = new Request(`SELECT * FROM ODS_TAB_TABLET WHERE TAG = @Tag ORDER BY NomeCanal ASC`, function (err) {
            if (err) {
                console.log('Error while creating DB request ' + err.toString());
            }
        });

        request.addParameter('Tag', TYPES.NVarChar, ws.tag);
    
        request.on('row', function(columns) { 
    
            let row = {};

            columns.map(function (column) {
                const colName = column.metadata.colName;
                row[colName] = column.value !== null && colName !== 'datetime' ? column.value.toString().replace(/[\n\r]/, '').trim() : column.value;
            });

            currentRows.push(row);
            
        });

        request.on('requestCompleted', function (rowCount) {

            const data = formatData(currentRows);
            let message = {
                type: 'data',
                data: data
            }

            conn.send(JSON.stringify(message))

        });
    
        printMessage('Starting DB reading interval...');
    
        dbUpdateInterval = setInterval(() => {
    
            currentRows = [];

            connection.execSql(request);
    
        }, 5000);
    
    });

    connection.connect();

}

function onMessage(ws, data) {
    
    const dataJson = JSON.parse(data.toString());

    switch (dataJson.type) {
        case 'tagReceived':
            
            printMessage(`Connection successfully associated to TAG ${ws.tag}.`);

            dbConnect(ws)

            break;
        default:
            ws.send('Unknown message received.');
            break;
    }

}

function onConnection(ws, req) {

    conn = ws;

    ws.tag = config.tag;

    ws.on('message', data => onMessage(ws, data));
    
    ws.on('error', err => onError(ws, err));

    ws.on('close', () => {
        if (connection !== null) {
            printMessage('Closing DB connection.');
            if (dbUpdateInterval) {
                clearInterval(dbUpdateInterval);
            }
            connection.close();
        }
        printMessage('Client has disconnected.');
    });
    
    printMessage(`New connection accepted.`);

    if (ws.tag.length) {
        ws.send(JSON.stringify({
            type: 'tag',
            data: ws.tag
        }))
    } else {
        printMessage("No tag was set at config.json file...")
    }

}

const wss = new WebSocket.Server({
    server
});

const createWindow = (width, height, frame, kiosk) => {
    
    const win = new BrowserWindow({
        width,
        height,
        frame,
        kiosk,
        show: false,
        autoHideMenuBar: true
    })

    win.loadFile('index.html')

    // win.setAlwaysOnTop(true, "screen-saver")
    // win.setVisibleOnAllWorkspaces(true)

    win.on('close', _ => {
        // win = null
        // app.quit()
    })

    win.show()

}


wss.on('connection', onConnection);

printMessage(`Socket server is running at ws://localhost:${port}.`);

app.whenReady().then(() => {

    const configWidth = parseInt(config.win_width)
    const configHeight = parseInt(config.win_height)
    const configFrame = config.win_frame === true || false
    const configKiosk = config.win_kiosk === true || false

    const { screen } = require('electron')

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    createWindow(configWidth || width, configHeight || height, configFrame, configKiosk)

})