require('dotenv').config()

const defaultEnv = {
    host: process.env.MC_HOST,
    port: Number(process.env.MC_PORT ?? 19132),
    username: process.env.MC_USERNAME ?? 'BedrockBot',
    offline: process.env.MC_OFFLINE ? process.env.MC_OFFLINE === 'true' : false,
    version: process.env.MC_VERSION || undefined,
    profilesFolder: process.env.MC_PROFILES_FOLDER || undefined,
    startCommand: process.env.MC_START_COMMAND,
    minIntervalMs: Number(process.env.MC_COMMAND_MIN_INTERVAL_MS ?? 1200),
    jitterMs: Number(process.env.MC_COMMAND_JITTER_MS ?? 300),
    dropBlockEntities: process.env.MC_DROP_BLOCK_ENTITIES
        ? process.env.MC_DROP_BLOCK_ENTITIES === 'true'
        : true,
    warnLimit: Number(process.env.MC_NBT_WARN_LIMIT ?? 5),
    commandMode: (process.env.MC_COMMAND_MODE ?? 'request').toLowerCase(),
    requireCommandsEnabled: process.env.MC_REQUIRE_COMMANDS_ENABLED
        ? process.env.MC_REQUIRE_COMMANDS_ENABLED === 'true'
        : true,
    sneakToggleMode: process.env.MC_SNEAK_TOGGLE
        ? process.env.MC_SNEAK_TOGGLE === 'true'
        : true,
    sendAuthInputSneak: process.env.MC_SEND_AUTH_INPUT_SNEAK
        ? process.env.MC_SEND_AUTH_INPUT_SNEAK === 'true'
        : true,
    authInputLoop: process.env.MC_AUTH_INPUT_LOOP
        ? process.env.MC_AUTH_INPUT_LOOP === 'true'
        : !process.env.MC_SNEAK_TOGGLE,
    authInputIntervalMs: Number(process.env.MC_AUTH_INPUT_INTERVAL_MS ?? 50),
    commandVersion: process.env.MC_COMMAND_VERSION || process.env.MC_VERSION || '1.0'
}

function loadConfig(overrides = {}) {
    return { ...defaultEnv, ...overrides }
}

module.exports = { loadConfig, defaultEnv }
