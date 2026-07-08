import axios from 'axios'
import { snrColor } from './snr-color.mjs'

export default {
    emits: ['callsignSelected'],
    data() {
        return {
            entries: {},
            loading: true,
        }
    },
    created() {
        this.load()
        window.addEventListener('event', this.onWsEvent)
    },
    unmounted() {
        window.removeEventListener('event', this.onWsEvent)
    },
    computed: {
        rows() {
            return Object.entries(this.entries)
                .filter(([callsign]) => callsign)
                .map(([callsign, entry]) => ({ callsign, ...entry }))
                .sort((a, b) => b.UTC - a.UTC)
        },
    },
    methods: {
        snrColor,
        load() {
            this.loading = true
            axios.get('/api/call-activity')
                .then(r => { this.entries = r.data || {} })
                .catch(() => {})
                .finally(() => { this.loading = false })
        },
        onWsEvent(evt) {
            const e = evt.detail
            if (e.EventType === 'event' && e.WsType === 'RX.CALL_ACTIVITY') {
                this.entries = e.Event || {}
            }
        },
        lastHeard(utcMs) {
            return utcMs ? new Date(utcMs).toLocaleTimeString() : '—'
        },
    },
    template: `
        <div class="activity-panel">
            <div v-if="loading" class="text-center text-muted p-4">
                <div class="spinner-border spinner-border-sm"></div> Loading call activity…
            </div>
            <div v-else-if="!rows.length" class="text-center text-muted p-4">
                <i class="bi bi-people"></i> No call activity yet
            </div>
            <table v-else class="table table-sm activity-table">
                <thead>
                    <tr>
                        <th>Callsign</th>
                        <th>Grid</th>
                        <th>SNR</th>
                        <th>Last Heard</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.callsign">
                        <td>
                            <a href="#" @click.prevent="$emit('callsignSelected', row.callsign)">
                                <i class="bi bi-search"></i> {{ row.callsign }}
                            </a>
                        </td>
                        <td>{{ row.GRID || '—' }}</td>
                        <td :style="'color: ' + snrColor(row.SNR)">{{ row.SNR > 0 ? '+' : '' }}{{ row.SNR }}</td>
                        <td>{{ lastHeard(row.UTC) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `
}
