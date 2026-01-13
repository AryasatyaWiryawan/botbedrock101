const readline = require('readline')
const BotManager = require('./src/botManager')

const manager = new BotManager()

function startConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })

    console.log('Bot Bedrock 2.0 (Multi-Account)')
    console.log('Type "join" to connect all bots.')
    console.log('Type ".help" for list of local functional commands.')
    console.log('Target specific bots with "@BotName command".')

    rl.prompt()

    rl.on('line', (line) => {
        const trimmed = line.trim()
        if (!trimmed) {
            rl.prompt()
            return
        }

        const lower = trimmed.toLowerCase()

        // Global CLI metadata commands
        if (lower === 'exit' || lower === '.exit') {
            manager.stopAll()
            process.exit(0)
        }
        if (lower === 'join' || lower === '.join') {
            manager.startAll()
            rl.prompt()
            return
        }
        if (['logout', 'disconnect', '.logout', '.disconnect'].includes(lower)) {
            manager.stopAll()
            rl.prompt()
            return
        }

        // Delegate to BotManager
        manager.handleInput(trimmed)
        rl.prompt()
    })

    process.on('SIGINT', () => {
        manager.stopAll()
        process.exit(0)
    })
}

startConsole()
