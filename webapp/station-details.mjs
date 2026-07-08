import axios from 'axios'

export default {
    emits: ['toast'],
    data() {
        return {
            inputGrid: '',
            inputInfo: '',
            inputStatus: '',
            savingGrid: false,
            savingInfo: false,
            savingStatus: false,
        }
    },
    created() {
        this.inputGrid = this.stationInfo.Grid || ''
        this.inputInfo = this.stationInfo.Info || ''
        this.inputStatus = this.stationInfo.Status || ''
    },
    computed: {
        stationInfo() { return this.$root.stationInfo || {} },
        canControl() {
            const role = this.$root.authUser?.role
            return role === 'admin' || role === 'operator'
        },
    },
    methods: {
        save(field, value, flag, label) {
            this[flag] = true
            axios.post(`/api/station/${field}`, { value })
                .then(() => this.$emit('toast', { type: 'success', message: `${label} set` }))
                .catch(err => {
                    const msg = err.response?.data?.error || `Failed to set ${label.toLowerCase()}`
                    this.$emit('toast', { type: 'error', message: msg })
                })
                .finally(() => { this[flag] = false })
        },
        saveGrid() { this.save('grid', this.inputGrid, 'savingGrid', 'Grid') },
        saveInfo() { this.save('info', this.inputInfo, 'savingInfo', 'Station info') },
        saveStatus() { this.save('status', this.inputStatus, 'savingStatus', 'Station status') },
    },
    template: `
        <div class="station-details-panel">
            <div v-if="!canControl" class="alert alert-info">
                <i class="bi bi-info-circle"></i> Changing station details requires operator or admin role.
            </div>

            <div class="row mb-2">
                <div class="col-12">
                    <label class="form-label">My Maidenhead Grid Locator</label>
                    <div class="input-group">
                        <input type="text" class="form-control" v-model="inputGrid" :disabled="!canControl" @keydown.enter="saveGrid" placeholder="EN52TS">
                        <button class="btn btn-primary" @click="saveGrid" :disabled="!canControl || savingGrid">
                            <i class="bi" :class="savingGrid ? 'bi-hourglass-split' : 'bi-check2'"></i> Save
                        </button>
                    </div>
                </div>
            </div>

            <div class="row mb-2">
                <div class="col-12">
                    <label class="form-label">Station Info (Rig, Antenna, Location, etc)</label>
                    <div class="input-group">
                        <input type="text" class="form-control" v-model="inputInfo" :disabled="!canControl" @keydown.enter="saveInfo" placeholder="WI, FT891 - 30W, OCFD ON ROOF">
                        <button class="btn btn-primary" @click="saveInfo" :disabled="!canControl || savingInfo">
                            <i class="bi" :class="savingInfo ? 'bi-hourglass-split' : 'bi-check2'"></i> Save
                        </button>
                    </div>
                </div>
            </div>

            <div class="row mb-2">
                <div class="col-12">
                    <label class="form-label">Station Status (Weather, Idle Time, Version, etc)</label>
                    <div class="input-group">
                        <input type="text" class="form-control" v-model="inputStatus" :disabled="!canControl" @keydown.enter="saveStatus" placeholder="IDLE VERSION 3.0.0">
                        <button class="btn btn-primary" @click="saveStatus" :disabled="!canControl || savingStatus">
                            <i class="bi" :class="savingStatus ? 'bi-hourglass-split' : 'bi-check2'"></i> Save
                        </button>
                    </div>
                </div>
            </div>

            <div class="form-text">
                Callsign groups, the @ALLCALL opt-out, CQ message, and reply message are configured in JS8Call's own Settings dialog — JS8Call's API doesn't expose those.
            </div>
        </div>
    `
}
