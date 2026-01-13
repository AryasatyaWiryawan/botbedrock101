const fs = require('fs')
const path = require('path')

class CommandHandler {
    constructor(bot) {
        this.bot = bot
        this.actions = new Map()
        this.loadActions()
    }

    loadActions() {
        const actionsDir = path.join(__dirname, 'actions')
        if (fs.existsSync(actionsDir)) {
            const files = fs.readdirSync(actionsDir)
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const name = path.basename(file, '.js')
                    const action = require(path.join(actionsDir, file))
                    this.actions.set(name, action)
                }
            }
        }
    }

    handle(line) {
        const trimmed = line.trim()
        if (!trimmed) return

        // 1. Functional Commands (Dot Commands)
        if (trimmed.startsWith('.')) {
            this.handleDotCommand(trimmed)
            return
        }

        // 2. Server Commands (starts with /)
        if (trimmed.startsWith('/')) {
            this.bot.queueCommand(trimmed)
            return
        }

        // 3. Chat (default) - Unless it looks like a legacy "cmd" prefix
        if (trimmed.toLowerCase().startsWith('cmd ') || trimmed.toLowerCase().startsWith('command ')) {
            const commandText = trimmed.replace(/^(cmd|command)\s+/i, '')
            this.bot.queueCommand(commandText)
        } else {
            this.bot.sendChat(trimmed)
        }
    }

    handleDotCommand(line) {
        const parts = line.slice(1).split(' ')
        const commandName = parts[0].toLowerCase()
        const args = parts.slice(1)

        if (this.actions.has(commandName)) {
            try {
                this.actions.get(commandName)(this.bot, args)
            } catch (err) {
                console.error(`Error executing .${commandName}:`, err)
            }
        } else {
            console.log(`Unknown functional command: .${commandName}`)
        }
    }
}

module.exports = CommandHandler
