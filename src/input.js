// config is not imported, access via this.bot.config

const inputFlagOrder = [
    'ascend', 'descend', 'north_jump', 'jump_down', 'sprint_down', 'change_height',
    'jumping', 'auto_jumping_in_water', 'sneaking', 'sneak_down', 'up', 'down',
    'left', 'right', 'up_left', 'up_right', 'want_up', 'want_down', 'want_down_slow',
    'want_up_slow', 'sprinting', 'ascend_block', 'descend_block', 'sneak_toggle_down',
    'persist_sneak', 'start_sprinting', 'stop_sprinting', 'start_sneaking', 'stop_sneaking',
    'start_swimming', 'stop_swimming', 'start_jumping', 'start_gliding', 'stop_gliding',
    'item_interact', 'block_action', 'item_stack_request', 'handled_teleport', 'emoting',
    'missed_swing', 'start_crawling', 'stop_crawling', 'start_flying', 'stop_flying',
    'received_server_data', 'client_predicted_vehicle', 'paddling_left', 'paddling_right',
    'block_breaking_delay_enabled', 'horizontal_collision', 'vertical_collision', 'down_left',
    'down_right', 'start_using_item', 'camera_relative_movement_enabled',
    'rot_controlled_by_move_direction', 'start_spin_attack', 'stop_spin_attack',
    'hotbar_only_touch', 'jump_released_raw', 'jump_pressed_raw', 'jump_current_raw',
    'sneak_released_raw', 'sneak_pressed_raw', 'sneak_current_raw'
]

class InputHandler {
    constructor(bot) {
        this.bot = bot
        this.isSneaking = false
        this.sneakEdge = null
        this.authInputTick = 1n
        this.authInputTimer = null
    }

    buildInputFlags(on, edge) {
        const setFlags = new Set()
        if (on) {
            ['sneaking', 'persist_sneak', 'sneak_current_raw'].forEach((f) => setFlags.add(f))
            if (edge === 'start' || edge === 'toggle') {
                ['start_sneaking', 'sneak_pressed_raw', 'sneak_toggle_down'].forEach((f) => setFlags.add(f))
            }
        } else {
            if (edge === 'stop' || edge === 'toggle') {
                ['stop_sneaking', 'sneak_released_raw'].forEach((f) => setFlags.add(f))
            }
        }
        let bits = 0n
        inputFlagOrder.forEach((name, idx) => {
            if (setFlags.has(name)) {
                bits |= 1n << BigInt(idx)
            }
        })
        return bits
    }

    startAuthInputLoop() {
        if (this.authInputTimer) return
        this.authInputTimer = setInterval(() => {
            this.sendAuthInputTick()
            if (!this.bot.config.authInputLoop && !this.isSneaking && !this.sneakEdge) {
                this.stopAuthInputLoop()
            }
        }, this.bot.config.authInputIntervalMs)
    }

    stopAuthInputLoop() {
        if (this.authInputTimer) {
            clearInterval(this.authInputTimer)
            this.authInputTimer = null
        }
    }

    sendAuthInputTick() {
        if (!this.bot.client || !this.bot.connected) return
        const flags = this.buildInputFlags(this.isSneaking, this.sneakEdge)

        const { lastRot, lastPos } = this.bot

        this.bot.client.queue('player_auth_input', {
            pitch: lastRot.pitch,
            yaw: lastRot.yaw,
            position: { x: lastPos.x, y: lastPos.y, z: lastPos.z },
            move_vector: { x: 0, y: 0 },
            head_yaw: lastRot.headYaw,
            input_data: flags,
            input_mode: 'mouse',
            play_mode: 'normal',
            interaction_model: 'classic',
            interact_rotation: { x: 0, y: 0 },
            tick: this.authInputTick++,
            delta: { x: 0, y: 0, z: 0 },
            analogue_move_vector: { x: 0, y: 0 },
            camera_orientation: { x: 0, y: 0, z: 0 },
            raw_move_vector: { x: 0, y: 0 }
        })
        if (this.sneakEdge) {
            this.sneakEdge = null
        }
    }

    setSneak(on) {
        this.applySneak(on, 'edge')
    }

    toggleSneak() {
        this.applySneak(!this.isSneaking, 'toggle')
    }

    applySneak(on, mode) {
        if (!this.bot.client || !this.bot.connected) {
            console.log('Not connected; cannot toggle sneak.')
            return
        }
        if (on === this.isSneaking) {
            console.log(on ? 'Already sneaking.' : 'Already not sneaking.')
            return
        }
        this.isSneaking = on
        const action = on ? 'start_sneak' : 'stop_sneak'
        const pos = this.bot.blockCoords()
        const entityId = this.bot.runtimeEntityId || this.bot.client.entityId || 0n

        this.bot.client.queue('player_action', {
            runtime_entity_id: entityId,
            action,
            position: pos,
            result_position: pos,
            face: 0
        })

        if (this.bot.config.sendAuthInputSneak) {
            if (mode === 'toggle') {
                this.sneakEdge = 'toggle'
            } else {
                this.sneakEdge = on ? 'start' : 'stop'
            }
            this.sendAuthInputTick()
            if (this.bot.config.authInputLoop && mode !== 'toggle') {
                this.startAuthInputLoop()
            }
        }

        console.log(on ? 'Sneak enabled.' : 'Sneak disabled.')
    }

    cleanup() {
        this.stopAuthInputLoop()
        this.isSneaking = false
        this.sneakEdge = null
    }
}

module.exports = InputHandler
