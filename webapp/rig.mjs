import axios from 'axios'

const PRESETS = [
    { label: '3.578', dial: 3578000 },
    { label: '7.078', dial: 7078000 },
    { label: '10.130', dial: 10130000 },
    { label: '14.078', dial: 14078000 },
    { label: '21.078', dial: 21078000 },
]

const SPEEDS = [
    { label: 'Slow',   code: 4, name: 'slow' },
    { label: 'Normal', code: 0, name: 'normal' },
    { label: 'Fast',   code: 1, name: 'fast' },
    { label: 'Turbo',  code: 2, name: 'turbo' },
]

export default {
    emits: ['toast'],
    data() {
        return {
            presets: PRESETS,
            speeds: SPEEDS,
            inputMHz: '',
            inputOffset: 1500,
            settingFreq: false,
            settingSpeed: false,
        }
    },
    computed: {
        rigStatus() { return this.$root.rigStatus || {} },
        dialMHz() {
            const dial = this.rigStatus.Dial
            return dial ? (dial / 1e6).toFixed(3) : '—'
        },
        currentSpeed() { return this.rigStatus.Speed || '' },
        canControl() {
            const role = this.$root.authUser?.role
            return role === 'admin' || role === 'operator'
        },
    },
    methods: {
        setPreset(preset) {
            this.inputMHz = (preset.dial / 1e6).toFixed(3)
            this.inputOffset = this.rigStatus.Offset || 1500
            this.setFreq()
        },
        setFreq() {
            const dial = Math.round(parseFloat(this.inputMHz) * 1e6)
            const offset = parseInt(this.inputOffset) || 1500
            if (!dial || isNaN(dial)) {
                this.$emit('toast', { type: 'error', message: 'Enter a valid frequency in MHz' })
                return
            }
            this.settingFreq = true
            axios.post('/api/rig/freq', { dial, offset })
                .then(() => this.$emit('toast', { type: 'success', message: 'Frequency set' }))
                .catch(err => {
                    const msg = err.response?.data?.error || 'Failed to set frequency'
                    this.$emit('toast', { type: 'error', message: msg })
                })
                .finally(() => { this.settingFreq = false })
        },
        setSpeed(code) {
            this.settingSpeed = true
            axios.post('/api/rig/speed', { speed: code })
                .then(() => this.$emit('toast', { type: 'success', message: 'Speed set' }))
                .catch(err => {
                    const msg = err.response?.data?.error || 'Failed to set speed'
                    this.$emit('toast', { type: 'error', message: msg })
                })
                .finally(() => { this.settingSpeed = false })
        },
    },
    template: `
        <div class="rig-panel">
            <div v-if="!canControl" class="alert alert-info m-3">
                <i class="bi bi-info-circle"></i> Rig control requires operator or admin role.
            </div>

            <!-- Frequency -->
            <div class="rig-section">
                <div class="rig-section-label">Frequency</div>
                <div class="rig-current">
                    <span class="rig-value">{{ dialMHz }}</span>
                    <span class="rig-unit">MHz</span>
                    <span class="rig-sub" v-if="rigStatus.Offset"> &nbsp;+{{ rigStatus.Offset }} Hz offset</span>
                </div>
                <div class="rig-presets" v-if="canControl">
                    <button v-for="p in presets" :key="p.dial"
                        class="btn btn-outline-secondary rig-preset-btn"
                        @click="setPreset(p)" :disabled="settingFreq">
                        {{ p.label }}
                    </button>
                </div>
                <div class="d-flex gap-2 flex-wrap" v-if="canControl">
                    <div class="input-group" style="max-width:220px">
                        <input type="number" class="form-control" v-model="inputMHz"
                            step="0.001" placeholder="MHz" @keydown.enter="setFreq">
                        <span class="input-group-text">MHz</span>
                    </div>
                    <div class="input-group" style="max-width:180px">
                        <input type="number" class="form-control" v-model="inputOffset"
                            placeholder="Offset" @keydown.enter="setFreq">
                        <span class="input-group-text">Hz</span>
                    </div>
                    <button class="btn btn-primary" @click="setFreq" :disabled="settingFreq">
                        <i class="bi" :class="settingFreq ? 'bi-hourglass-split' : 'bi-arrow-right-circle'"></i> Set
                    </button>
                </div>
            </div>

            <!-- Speed -->
            <div class="rig-section">
                <div class="rig-section-label">TX Speed</div>
                <div class="rig-current mb-3">
                    <span class="rig-value rig-speed-display" :class="'speed-' + currentSpeed">
                        {{ currentSpeed || '—' }}
                    </span>
                </div>
                <div class="rig-speed-btns" v-if="canControl">
                    <button v-for="s in speeds" :key="s.code"
                        class="btn rig-speed-btn"
                        :class="currentSpeed === s.name ? 'btn-primary' : 'btn-outline-secondary'"
                        @click="setSpeed(s.code)" :disabled="settingSpeed">
                        {{ s.label }}
                    </button>
                </div>
            </div>
        </div>
    `
}
