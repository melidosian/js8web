import axios from 'axios'
import { snrColor } from './snr-color.mjs'

export default {
    emits: ['frequencySelected'],
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
            return Object.values(this.entries).sort((a, b) => a.OFFSET - b.OFFSET)
        },
    },
    methods: {
        snrColor,
        load() {
            this.loading = true
            axios.get('/api/band-activity')
                .then(r => { this.entries = r.data || {} })
                .catch(() => {})
                .finally(() => { this.loading = false })
        },
        onWsEvent(evt) {
            const e = evt.detail
            if (e.EventType === 'event' && e.WsType === 'RX.BAND_ACTIVITY') {
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
                <div class="spinner-border spinner-border-sm"></div> Loading band activity…
            </div>
            <div v-else-if="!rows.length" class="text-center text-muted p-4">
                <i class="bi bi-bar-chart-steps"></i> No band activity yet
            </div>
            <table v-else class="table table-sm activity-table">
                <thead>
                    <tr>
                        <th>Offset</th>
                        <th>SNR</th>
                        <th>Text</th>
                        <th>Last Heard</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.OFFSET">
                        <td>
                            <a href="#" @click.prevent="$emit('frequencySelected', row.FREQ)">
                                <i class="bi bi-broadcast-pin"></i> {{ row.OFFSET }}Hz
                            </a>
                        </td>
                        <td :style="'color: ' + snrColor(row.SNR)">{{ row.SNR > 0 ? '+' : '' }}{{ row.SNR }}</td>
                        <td class="activity-text">{{ row.TEXT }}</td>
                        <td>{{ lastHeard(row.UTC) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `
}
