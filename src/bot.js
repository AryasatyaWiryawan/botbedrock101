const { createClient } = require('bedrock-protocol')
const { Framer } = require('bedrock-protocol/src/transforms/framer')
const { types: protoTypes } = require('protodef')
const { v4: uuidv4 } = require('uuid')
const EventEmitter = require('events')
const InputHandler = require('./input')
const CommandHandler = require('./commands/commandHandler')

const [readVarInt] = protoTypes.varint

class Bot extends EventEmitter {
    constructor(config) {
        super()
        this.config = config
        this.client = null
        this.connecting = false
        this.connected = false
        this.shuttingDown = false

        // State
        this.lastPos = { x: 0, y: 0, z: 0 }
        this.lastRot = { pitch: 0, yaw: 0, headYaw: 0 }
        this.runtimeEntityId = 0n
        this.commandsEnabled = null

        // Command Queue
        this.commandQueue = []
        this.processingQueue = false
        this.lastCommandSentAt = 0
        this.queueTimer = null

        // Modules
        this.input = new InputHandler(this)
        this.commandHandler = new CommandHandler(this)

        // NBT Warning Logic
        this.warnCount = 0
        this.dropPacketIds = new Set()
        if (this.config.dropBlockEntities) {
            this.dropPacketIds.add(56) // block_entity_data packet id
        }
    }

    connect() {
        if (this.connecting || this.connected) {
            console.log(this.connected ? 'Already connected.' : 'Already connecting...')
            return
        }

        this.connecting = true
        this.warnCount = 0

        if (!this.config.host) {
            console.log('Error: MC_HOST not specified in .env or accounts.json.')
            this.connecting = false
            return
        }

        this.client = createClient({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            offline: this.config.offline,
            version: this.config.version,
            viewDistance: this.config.viewDistance > 0 ? this.config.viewDistance : undefined,
            connectTimeout: 15000,
            profilesFolder: this.config.profilesFolder,
            onMsaCode: (data) => {
                console.log('Microsoft sign-in required:')
                console.log(`1) Open ${data.verification_uri}`)
                console.log(`2) Enter code: ${data.user_code}`)
            }
        })

        this.patchPacketDropper(this.client)
        this.attachHandlers(this.client)
    }

    patchPacketDropper(c) {
        if (!this.dropPacketIds.size) return
        c.onDecryptedPacket = (buf) => {
            const packets = Framer.getPackets(buf)
            for (const packet of packets) {
                const { value: pid } = readVarInt(packet, 0)
                if (this.dropPacketIds.has(pid)) continue
                c.readPacket(packet)
            }
        }
    }

    attachHandlers(c) {
        c.on('connect', () => {
            console.log(`Connecting to ${this.config.host}:${this.config.port} as ${this.config.username} (${this.config.offline ? 'offline' : 'online'}).`)
        })

        c.on('login', () => {
            console.log('Authenticated, finishing join...')
            const displayName = c.profile?.name ?? c.username ?? this.config.username
            console.log(`Microsoft account profile: ${displayName}`)
        })

        c.on('join', () => console.log('Joined. Waiting for spawn...'))

        c.on('start_game', (packet) => {
            this.updatePosition(packet?.player_position)
            if (packet?.rotation) {
                const [yaw, pitch] = Array.isArray(packet.rotation) ? packet.rotation : [packet.rotation?.x, packet.rotation?.y]
                this.updateRotation(pitch ?? 0, yaw ?? 0, yaw ?? 0)
            }
            if (packet?.runtime_entity_id != null) {
                this.runtimeEntityId = BigInt(packet.runtime_entity_id)
            }
        })

        c.on('move_player', (packet) => {
            this.updatePosition(packet?.position)
            this.updateRotation(packet?.pitch, packet?.yaw, packet?.head_yaw)
            if (packet?.runtime_id != null) {
                this.runtimeEntityId = BigInt(packet.runtime_id)
            }
        })

        c.on('spawn', () => {
            this.connected = true
            this.connecting = false
            console.log('Spawned in world. Type commands to run them (Ctrl+C to quit).')
            this.emit('spawn') // Emit for Manager
            if (this.config.startCommand) {
                this.queueCommand(this.config.startCommand)
            }
        })

        c.on('set_commands_enabled', (packet) => {
            this.commandsEnabled = !!packet.enabled
            console.log(`[server] commands ${this.commandsEnabled ? 'enabled' : 'disabled'}`)
        })

        c.on('text', (packet) => {
            if (this.config.logLevel === 'error') return

            const content = packet.message
                ?? packet.raw
                ?? packet.whisper
                ?? packet.announcement
                ?? (Array.isArray(packet.parameters) ? packet.parameters.join(' ') : undefined)
                ?? packet.translate
            const author = packet.source_name ? `${packet.source_name}: ` : ''
            console.log(`[${this.config.username}] ${author}${content ?? JSON.stringify(packet)}`)
        })

        c.on('command_output', (packet) => {
            const lines = (packet.output ?? []).map((entry) => {
                const body = entry.parameters?.join(' ') || entry.message_id
                return `${entry.success ? 'OK' : 'ERR'} ${body}`
            })
            const info = lines.length ? `\n${lines.join('\n')}` : ''
            if (this.config.logLevel !== 'error') {
                console.log(`[${this.config.username}] [command output] type=${packet.output_type} success=${packet.success_count}${info}`)
            }
        })

        c.on('kick', (reason) => {
            console.error('Kicked:', reason)
            this.cleanup(1)
        })

        c.on('close', (reason) => {
            console.log('Connection closed:', reason)
            this.connected = false
            this.connecting = false
            console.log('Type "join" to connect to the MC host.')
            this.emit('close') // Emit for Manager
        })

        c.on('error', (err) => {
            const msg = String(err?.message ?? err)
            if (this.shouldIgnoreError(msg, err)) {
                return
            }
            console.error('Error:', err)
            this.disconnect(1)
        })
    }

    shouldIgnoreError(msg, err) {
        if (
            msg.includes('Invalid tag') ||
            msg.includes('packet_block_entity_data') ||
            err?.partialReadError === true ||
            msg.includes('PartialReadError') ||
            msg.includes('Missing characters in string')
        ) {
            this.warnCount += 1
            if (this.warnCount <= this.config.warnLimit) {
                console.warn('Warning: ignoring malformed/unsupported NBT from server.')
                if (this.warnCount === this.config.warnLimit) {
                    console.warn('Muting further NBT warnings.')
                }
            }
            return true
        }
        return false
    }

    disconnect(code = 0) {
        if (this.client) {
            try { this.client.disconnect() } catch (_) { }
            try { this.client.close() } catch (_) { }
        }
        this.client = null
        this.connected = false
        this.connecting = false
        this.input.cleanup()

        console.log('Disconnected.')
        if (code !== 0 && !this.shuttingDown) process.exit(code)
    }

    cleanup(code = 0) {
        this.shuttingDown = true
        if (this.queueTimer) clearTimeout(this.queueTimer)
        this.disconnect(code)
    }

    updatePosition(pos) {
        if (!pos) return
        if (Array.isArray(pos)) {
            const [x, y, z] = pos
            if ([x, y, z].every((v) => typeof v === 'number')) {
                this.lastPos = { x, y, z }
            }
            return
        }
        const { x, y, z } = pos
        if ([x, y, z].every((v) => typeof v === 'number')) {
            this.lastPos = { x, y, z }
        }
    }

    updateRotation(pitch, yaw, headYaw) {
        if (typeof pitch === 'number') this.lastRot.pitch = pitch
        if (typeof yaw === 'number') this.lastRot.yaw = yaw
        if (typeof headYaw === 'number') this.lastRot.headYaw = headYaw
    }

    blockCoords() {
        return {
            x: Math.floor(this.lastPos.x ?? 0),
            y: Math.floor(this.lastPos.y ?? 0),
            z: Math.floor(this.lastPos.z ?? 0)
        }
    }

    // --- Command Queue Logic ---

    queueCommand(input) {
        // Ensure command starts with /
        const command = input.startsWith('/') ? input : `/${input}`
        this.commandQueue.push(command)
        this.processQueue()
    }

    processQueue() {
        if (this.processingQueue) return
        this.processingQueue = true
        const loop = () => {
            const next = this.commandQueue.shift()
            if (!next) {
                this.processingQueue = false
                return
            }

            this.sendCommandNow(next)
            this.lastCommandSentAt = Date.now()
            const delay = this.config.minIntervalMs + Math.floor(Math.random() * this.config.jitterMs)
            this.queueTimer = setTimeout(loop, delay)
        }

        const elapsed = Date.now() - this.lastCommandSentAt
        const delay = Math.max(0, this.config.minIntervalMs - elapsed)
        this.queueTimer = setTimeout(loop, delay)
    }

    sendCommandNow(command) {
        if (!this.client || !this.connected) {
            console.log('Not connected; command skipped.')
            return
        }
        if (this.config.requireCommandsEnabled && this.commandsEnabled === false) {
            console.log('Commands are disabled by the server.')
            return
        }
        const normalized = command.startsWith('/') ? command : `/${command}`
        if (this.config.commandMode === 'chat') {
            this.sendChat(normalized)
            return
        }
        const payload = {
            command: normalized,
            origin: {
                type: 'player',
                uuid: this.client.profile?.uuid ?? '00000000-0000-0000-0000-000000000000',
                request_id: uuidv4(),
                player_entity_id: this.client.entityId ?? 0n
            },
            internal: false,
            version: this.config.commandVersion
        }

        this.client.queue('command_request', payload)
        console.log(`[sent] ${normalized}`)
    }

    sendChat(message) {
        if (!this.client || !this.connected) {
            console.log('Not connected; chat skipped.')
            return
        }
        const sourceName = this.client.profile?.name ?? this.client.username ?? this.config.username
        const xuid = this.client.profile?.xuid ?? ''
        this.client.queue('text', {
            needs_translation: false,
            category: 'authored',
            chat: message,
            whisper: '',
            announcement: '',
            type: 'chat',
            source_name: sourceName,
            message,
            xuid,
            platform_chat_id: '',
            has_filtered_message: false
        })
        console.log(`[chat] ${message}`)
    }
}

module.exports = Bot
