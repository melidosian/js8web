import axios from 'axios'
import { map as createMap, tileLayer, circleMarker, layerGroup } from 'leaflet'
import { snrColor } from './snr-color.mjs'
import { gridToLatLon } from './grid-to-latlon.mjs'
import { hzToMHz } from './format-freq.mjs'

export default {
    emits: ['callsignSelected', 'frequencySelected'],
    data() {
        return {
            spots: [],
            loading: true,
        }
    },
    computed: {
        // One marker per callsign (most recent spot) so the map doesn't stack duplicates
        // for stations heard repeatedly.
        markers() {
            const seen = new Map()
            for (const s of this.spots) {
                if (s.Grid && !seen.has(s.Call)) seen.set(s.Call, s)
            }
            return Array.from(seen.values())
                .map(spot => ({ spot, pos: gridToLatLon(spot.Grid) }))
                .filter(m => m.pos)
        },
    },
    watch: {
        markers() {
            this.renderMarkers()
        },
    },
    created() {
        this.load()
        window.addEventListener('event', this.onWsEvent)
    },
    mounted() {
        this.map = createMap(this.$refs.mapEl).setView([20, 0], 2)
        tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
        }).addTo(this.map)
        this.markerLayer = layerGroup().addTo(this.map)
        this.renderMarkers()
    },
    unmounted() {
        window.removeEventListener('event', this.onWsEvent)
        if (this.map) this.map.remove()
    },
    methods: {
        snrColor,
        hzToMHz,
        load() {
            this.loading = true
            axios.get('/api/rx-spots')
                .then(r => { this.spots = r.data || [] })
                .catch(() => {})
                .finally(() => { this.loading = false })
        },
        onWsEvent(evt) {
            const e = evt.detail
            if (e.EventType === 'object' && e.WsType === 'RX.SPOT') {
                this.spots.unshift(e.Event)
                if (this.spots.length > 200) this.spots.length = 200
            }
        },
        renderMarkers() {
            if (!this.markerLayer) return
            this.markerLayer.clearLayers()
            for (const m of this.markers) {
                const color = this.snrColor(m.spot.Snr)
                const marker = circleMarker([m.pos.lat, m.pos.lon], {
                    radius: 6,
                    color,
                    fillColor: color,
                    fillOpacity: 0.8,
                })
                marker.bindTooltip(`${m.spot.Call} (${m.spot.Grid}) SNR ${m.spot.Snr}`)
                marker.on('click', () => this.$emit('callsignSelected', m.spot.Call))
                marker.addTo(this.markerLayer)
            }
        },
        formatTime(ts) {
            const d = new Date(ts)
            return d.getFullYear() > 1971 ? d.toLocaleTimeString() : '—'
        },
    },
    template: `
        <div class="spots-panel">
            <div ref="mapEl" class="spots-map"></div>
            <div class="spots-list">
                <div v-if="loading" class="text-center text-muted p-4">
                    <div class="spinner-border spinner-border-sm"></div> Loading spots…
                </div>
                <div v-else-if="!spots.length" class="text-center text-muted p-4">
                    <i class="bi bi-geo-alt"></i> No spots yet
                </div>
                <table v-else class="table table-sm activity-table">
                    <thead>
                        <tr>
                            <th>Callsign</th>
                            <th>Grid</th>
                            <th>SNR</th>
                            <th>Freq</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="spot in spots" :key="spot.Id">
                            <td>
                                <a href="#" @click.prevent="$emit('callsignSelected', spot.Call)">
                                    <i class="bi bi-search"></i> {{ spot.Call }}
                                </a>
                            </td>
                            <td>{{ spot.Grid || '—' }}</td>
                            <td :style="'color: ' + snrColor(spot.Snr)">{{ spot.Snr > 0 ? '+' : '' }}{{ spot.Snr }}</td>
                            <td>
                                <a href="#" @click.prevent="$emit('frequencySelected', spot.Freq)">
                                    <i class="bi bi-broadcast-pin"></i> {{ hzToMHz(spot.Freq, 6) }}
                                </a>
                            </td>
                            <td>{{ formatTime(spot.Timestamp) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `
}
