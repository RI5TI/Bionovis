<template>
    <div class="container">
        <div class="logo"></div>
        <div class="terminal-wrapper" v-if=" ! connected || ! dbConnected">
            <!-- <div class="settings-wrapper">
                <button type="button" class="waves-effect waves-light btn" v-on:click="openSettings()">
                    <i class="material-icons">settings</i>
                </button>
            </div> -->
            <div id="terminal">
                <p v-bind:class="['log-message', log.type]" v-for="(log, k) in logMessages" v-bind:key="k">
                    {{ consoleLog(log.message) }}
                </p>
            </div>
        </div>
        <div v-else class="main-data-wrapper">

            <div v-if="currentData">

                <div class="tag-overview">
                    <div class="tag-name"><strong>TAG:</strong> {{ currentData.tag }}</div>
                    <div v-for="(channel, k) in currentData.channels" v-bind:key="k" class="value-row">
                        <div class="magnitude">{{ channel.magnitude }}</div>
                        <div v-bind:class="['value', {'green': channel.light == 1, 'yellow': channel.light == 2, 'red': channel.light == 3}]">{{ channel.value }}</div>
                    </div>
                    <div class="date">{{ maxDate }}</div>
                </div>

                <div class="channel-overview">
                    <div v-for="(channel, k) in currentData.channels" v-bind:key="k">
                        <div class="tag-name"><strong>TAG:</strong> {{ channel.name }}</div>
                        <div class="value-row">
                            <div class="magnitude">{{ channel.magnitude }}</div>
                            <div v-bind:class="['value', {'green': channel.light == 1, 'yellow': channel.light == 2, 'red': channel.light == 3}]">{{ channel.value }}</div>
                        </div>
                        <div class="date">{{ formatDate(channel.date) }}</div>
                    </div>
                </div>

            </div>

            <div v-else>
                Aguardando atualização...
            </div>

        </div>
        <div id="settingsModal" class="modal">
            <div class="modal-content">
                <h4>Settings</h4>
                <div class="row">
                    <div class="input-field col s12">
                        <input id="inputTag" type="text" v-model="settings.tag">
                        <label for="inputTag">TAG</label>
                        <!-- <div class="input-error" v-if="inputerrors.title">{{ errors.title }}</div> -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-close waves-effect waves-green btn-flat">Cancel</button>
                <button class="waves-effect waves-green btn-flat" v-on:click="saveSettings()">Save</button>
            </div>
        </div>
    </div>
</template>

<script>
import M from 'materialize-css'

export default {
    name: 'App',
    data: function () {
        return {
            initializing: true,
            logMessages: [],
            connected: false,
            dbConnected: false,
            host: 'ws://localhost:3000',
            tag: null,
            settings: {
                tag: ''
            },
            currentData: null
        }
    },
    computed: {
        maxDate: function () {
            if ( ! this.currentData) {
                return ''
            }
            let maxDate = null
            this.currentData.channels.map((channel) => {
                const channelDate = this.$moment(channel.date);
                if (maxDate === null) {
                    maxDate = channelDate
                } else if (channelDate > maxDate) {
                    maxDate = channelDate
                }
            });
            return maxDate.format('DD/MM/YYYY HH:mm')
        }
    },
    mounted: function () {
        M.AutoInit()
        M.Modal.init(document.getElementById('settingsModal'))
        this.settings.tag = localStorage.getItem('settings.tag') || ''
        M.updateTextFields()
        this.pushLogMessage('Initializing...')
        this.connect()
    },
    methods: {
        formatDate(date) {
            return this.$moment(date).format('DD/MM/YYYY HH:mm');
        },
        saveSettings: function () {
            if (this.settings.tag.length) {
                localStorage.setItem('settings.tag', this.settings.tag)
                this.closeSettings()
            }
        },
        openSettings: function () {
            M.Modal.getInstance(document.getElementById('settingsModal')).open()
        },
        closeSettings: function () {
            M.Modal.getInstance(document.getElementById('settingsModal')).close()
        },
        connect: function () {
            setInterval(() => {
                // this.settings.tag = localStorage.getItem('settings.tag') || ''
                // if (this.settings.tag.length === 0) {
                //     this.pushLogMessage('No TAG was set for the application. Please configure it at settings.', 'error');
                //     return
                // }
                if (this.connected) {
                    return
                }
                this.pushLogMessage(`Trying to connect to the Socket Server at ${this.host}`);
                this.socket = new WebSocket(this.host)
                this.socket.onopen = () => {
                    this.connected = true
                    this.pushLogMessage('Successfully connected to the Socket Server')
                    // setTimeout(() => {
                    //     this.initializing = false
                    // }, 5000);
                }
                this.socket.onclose = () => {
                    this.connected = false
                    this.initializing = true
                    this.dbConnected = false
                    this.currentData = null
                    this.settings.tag = ''
                    this.pushLogMessage('Lost connection with the Socket Server', 'error')
                    this.pushLogMessage('Waiting 5 seconds to retry')
                }
                this.socket.onmessage = (event) => {
                    const message = JSON.parse(event.data)
                    if (message.type == 'tag') {
                        this.socket.send(JSON.stringify({
                            type: 'tagReceived'
                        }))
                    } else if (message.type == 'data') {
                        this.currentData = message.data
                    } else if (message.type == 'dbConnected') {
                        this.dbConnected = true
                    } else if (message.type == 'dbDisconnected') {
                        this.dbConnected = false
                        this.currentData = null
                    } else {
                        this.pushLogMessage(message.data)
                    }
                }
            }, 5000);
        },
        pushLogMessage: function (message, type) {
            type = type || 'info'
            if (this.logMessages.length >= 200) {
                this.logMessages = this.logMessages.slice(100, 100);
            }
            this.logMessages.push({
                message,
                type
            })
        },
        consoleLog: function (message) {
            const currDate = this.$moment().format('DD/MM/YYYY HH:mm')
            const terminal = document.getElementById('terminal')
            setTimeout(() => {
                terminal.scrollTop = terminal.scrollHeight
            }, 1000)
            return `[${currDate}] ${message}`
        }
    }
}
</script>

<style>
#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body, .container {
    height: 100%;
}

body {
    background-color: #f9f9f9;
}

.terminal-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

#terminal {
    width: 100%;
    height: 100%;
    background-color: #000;
    padding: 15px 15px 10px;
    max-height: 400px;
    overflow-y: scroll;
    box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
    border-radius: 8px;
}

#terminal .log-message {
    color: greenyellow;
    margin-bottom: 5px;
    margin-top: 0;
}

#terminal .log-message.error {
    color: red;
}

.settings-wrapper {
    margin-bottom: 15px;
    width: 100%;
    text-align: right;
}

.main-data-wrapper {
    display: flex;
    height: 100%;
    width: 100%;
}

.main-data-wrapper > div {
    display: flex;
    height: 100%;
    width: 100%;
    align-items: center;
    justify-content: space-around;
}

.tag-name {
    padding: 10px;
}

.magnitude {
    position: absolute;
    width: 30px;
    height: 30px;
    text-align: center;
    font-weight: bold;
    color: #fff;
    background-color: #000;
    line-height: 30px;
    z-index: 1;
}

.value {
    position: absolute;
    left: 0;
    height: 30px;
    line-height: 30px;
    color: #fff;
    width: 100%;
    padding-left: 40px;
}

.value.green {
    background-color: green;
}

.value.red {
    background-color: red;
}

.value.yellow {
    background-color: yellow;
    color: #000;
}

.date {
    padding: 10px;
    text-align: center;
}

.value-row {
    position: relative;
    height: 30px;
    /* width: 100%; */
    margin: 0 10px;
}

.channel-overview > div {
    margin-bottom: 10px;
}

.tag-overview, .channel-overview > div {
    background-color: #fff;
    border-radius: 8px;
    width: 200px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}

.logo {
    background-image: url(assets/img/logo.png);
    background-repeat: no-repeat;
    width: 100%;
    height: 72px;
    background-position: center;
    position: absolute;
    left: 0;
}
</style>