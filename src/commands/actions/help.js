module.exports = (bot, args) => {
    console.log('--- Functional Commands ---')
    console.log('.sneak [on|off|toggle] - Toggle sneak state')
    console.log('.help - Show this help message')
    console.log('---------------------------')

    if (bot.connected) {
        console.log('You can also type standard Minecraft commands starting with /')
    }
}
