module.exports = (bot, args) => {
    if (!bot.connected) {
        console.log('Not connected. Cannot use sneak.')
        return
    }

    const mode = args[0] ? args[0].toLowerCase() : 'toggle'

    if (mode === 'on') {
        bot.input.setSneak(true)
    } else if (mode === 'off') {
        bot.input.setSneak(false)
    } else if (mode === 'toggle') {
        bot.input.toggleSneak()
    } else {
        console.log('Usage: .sneak [on|off|toggle]')
    }
}
