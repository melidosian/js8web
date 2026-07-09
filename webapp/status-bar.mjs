import { hzToMHz } from './format-freq.mjs'

export default {
    props: ['rigStatus', 'connected', 'authUser'],
    emits: ['logout'],
    template: `
    <div class="status-bar d-flex align-items-center px-3 py-1">
        <div class="status-section me-4 d-flex align-items-center">
            <span class="connection-indicator me-2" :class="connected ? 'connected' : 'disconnected'" :title="connected ? 'Connected' : 'Disconnected'">
                <i class="bi" :class="connected ? 'bi-wifi' : 'bi-wifi-off'"></i>
            </span>
        </div>

        <div class="status-section me-4" v-if="rigStatus.Dial">
            <span class="status-label">Dial</span>
            <span class="status-value">{{ formatFrequency(rigStatus.Dial) }}</span>
        </div>

        <div class="status-section me-4" v-if="rigStatus.Offset">
            <span class="status-label">Offset</span>
            <span class="status-value">{{ rigStatus.Offset }} Hz</span>
        </div>

        <div class="status-section me-3" v-if="rigStatus.Speed">
            <span class="status-label">Speed</span>
            <span class="status-value speed-badge" :class="'speed-' + rigStatus.Speed">{{ rigStatus.Speed }}</span>
        </div>

        <div class="status-section ms-auto d-flex align-items-center" v-if="authUser">
            <span class="status-user me-2"><i class="bi bi-person-circle"></i> {{ authUser.username }}</span>
            <button class="btn btn-sm btn-outline-light status-logout-btn" @click="$emit('logout')" title="Sign out">
                <i class="bi bi-box-arrow-right"></i>
            </button>
        </div>
    </div>
    `,
    methods: {
        formatFrequency(dialHz) {
            return hzToMHz(dialHz) + ' MHz'
        }
    }
}
