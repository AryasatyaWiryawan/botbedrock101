const Bot = require('./bot')
const { loadConfig } = require('./config')
const fs = require('fs')
const path = require('path')

class BotManager {
    constructor() {
        this.bots = new Map() // username -> Bot instance
        this.loadBots()
    }

    loadBots() {
        const mainConfig = loadConfig()
        let accounts = []

        const accountsPath = path.join(process.cwd(), 'accounts.json')
        if (fs.existsSync(accountsPath)) {
            try {
                const data = fs.readFileSync(accountsPath, 'utf8')
                accounts = JSON.parse(data)
            } catch (e) {
                console.error('Error reading accounts.json:', e)
            }
        } else {
            // Fallback to .env single bot
            accounts.push({})
        }

        for (const acc of accounts) {
            // Merge global config with account overrides
            const config = loadConfig(acc)

            // Ensure unique profiles folder if not manually specified
            if (!config.profilesFolder) {
                config.profilesFolder = path.join(process.cwd(), 'auth_cache', config.username)
            }

            const bot = new Bot(config)

            // Append unique identifier if needed, or just use username
            // We assume username is unique for now
            this.bots.set(config.username.toLowerCase(), bot)
        }

        console.log(`Loaded ${this.bots.size} bot(s).`)
    }

    async startAll() {
        console.log('Starting bots sequentially...')
        for (const [name, bot] of this.bots) {
            if (bot.connected || bot.connecting) continue

            console.log(`Starting ${name}...`)
            try {
                await this.startBotAndWait(bot)
            } catch (err) {
                console.error(`Failed to start ${name}:`, err)
            }
        }
        console.log('All bots processed.')
    }

    startBotAndWait(bot) {
        return new Promise((resolve, reject) => {
            if (!bot.config.offline) {
                console.log(`[${bot.config.username}] Waiting for authentication/spawn... Check console for Microsoft login code if needed.`)
            }
            // Listen for success or failure
            const onSpawn = () => {
                cleanup()
                resolve()
            }
            const onClose = () => {
                cleanup()
                // checking if it was a kick or legitimate close is hard without more state,
                // but for sequential start purposes, if it closes, we move to next.
                resolve()
            }

            const cleanup = () => {
                bot.removeListener('spawn', onSpawn)
                bot.removeListener('close', onClose)
            }

            // We need to support the Bot class emitting these events.
            // Currently Bot class wraps the client but might not emit 'spawn' itself 
            // unless we forward it or attach to the internal client.
            // Let's modify the Bot class to emit events or attach to its client if visible.
            // But Bot.client is null until connect() is called.

            // Workaround: We hook into the connect() side effects or we modify Bot to extend EventEmitter.
            // For least disruption, let's attach a temporary listener mechanism in Bot or just poll?
            // No, polling is bad.

            // Let's rely on the fact that we can modify Bot.js to emit events, 
            // OR we can just wrap the start logic here if we assume Bot.client becomes available synchronously?
            // No, createClient is sync but connection is async.

            bot.connect()

            // After connect(), bot.client should exist
            if (bot.client) {
                bot.client.on('spawn', onSpawn)
                bot.client.on('close', onClose)
                // If we get kicked during login (e.g. auth fail), close fires.
            } else {
                reject(new Error('Failed to create client'))
            }
        })
    }

    stopAll() {
        for (const bot of this.bots.values()) {
            bot.cleanup()
        }
    }

    handleInput(line) {
        const trimmed = line.trim()
        if (!trimmed) return

        // 1. Check for targeted command: @BotName command...
        if (trimmed.startsWith('@')) {
            const split = trimmed.split(' ')
            const targetName = split[0].substring(1).toLowerCase()
            const command = split.slice(1).join(' ')

            const targetBot = this.bots.get(targetName)
            if (targetBot) {
                console.log(`[Targeting ${targetName}]`)

                const lowerCmd = command.toLowerCase()

                // Allow both .join and join for targeted commands
                if (['.join', 'join', '.connect', 'connect'].includes(lowerCmd)) {
                    if (targetBot.connected || targetBot.connecting) {
                        console.log(`${targetName} is already connected/connecting.`)
                    } else {
                        console.log(`Starting ${targetName}...`)
                        targetBot.connect()
                    }
                    return
                }

                if (['.logout', 'logout', '.disconnect', 'disconnect', '.quit', 'quit'].includes(lowerCmd)) {
                    console.log(`Disconnecting ${targetName}...`)
                    targetBot.disconnect()
                    return
                }

                targetBot.commandHandler.handle(command)
            } else {
                console.log(`Bot '${targetName}' not found. Available: ${Array.from(this.bots.keys()).join(', ')}`)
            }
            return
        }

        // 2. Broadcast to all (default)
        if (this.bots.size > 1) {
            console.log(`[Broadcasting to ${this.bots.size} bots]`)
        }
        for (const bot of this.bots.values()) {
            bot.commandHandler.handle(trimmed)
        }
    }
}

module.exports = BotManager
