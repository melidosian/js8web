import axios from 'axios'
import InboxMessage from './inbox-message.mjs'

export default {
    components: { InboxMessage },
    emits: ['toast'],
    data() {
        return {
            messages: [],
            loading: true,
            newCallsign: '',
            newMessage: '',
            sending: false,
        }
    },
    created() {
        this.load()
        window.addEventListener('event', this.onWsEvent)
    },
    unmounted() {
        window.removeEventListener('event', this.onWsEvent)
    },
    methods: {
        load() {
            this.loading = true
            axios.get('/api/inbox')
                .then(r => { this.messages = r.data || [] })
                .catch(() => { this.$emit('toast', { type: 'error', message: 'Failed to load inbox' }) })
                .finally(() => { this.loading = false })
        },
        onWsEvent(evt) {
            const e = evt.detail
            if (e.EventType === 'object' && e.WsType === 'INBOX.MESSAGE') {
                if (!this.messages.find(m => m.Id === e.Event.Id)) {
                    this.messages.unshift(e.Event)
                    // Match the backend's SQL_INBOX_LIST cap so a long-running tab doesn't
                    // accumulate inbox messages in memory/DOM without bound.
                    if (this.messages.length > 200) this.messages.length = 200
                }
            }
        },
        send() {
            const callsign = this.newCallsign.trim().toUpperCase()
            const message = this.newMessage.trim()
            if (!callsign || !message || this.sending) return
            this.sending = true
            axios.post('/api/inbox', { callsign, message })
                .then(() => {
                    this.newCallsign = ''
                    this.newMessage = ''
                    this.$emit('toast', { type: 'success', message: 'Message stored in JS8Call inbox' })
                })
                .catch(err => {
                    const msg = err.response?.data?.error || 'Failed to send message'
                    this.$emit('toast', { type: 'error', message: msg })
                })
                .finally(() => { this.sending = false })
        },
        handleKeydown(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault()
                this.send()
            }
        },
    },
    template: `
        <div class="inbox-panel">
            <div class="inbox-compose" v-if="$root.authenticated && ($root.authUser?.role === 'admin' || $root.authUser?.role === 'operator')">
                <div class="d-flex gap-2 mb-2">
                    <input type="text" class="form-control form-control-sm inbox-callsign-input"
                        v-model="newCallsign" placeholder="Callsign" autocapitalize="characters" autocomplete="off">
                    <button class="btn btn-primary btn-sm" @click="send"
                        :disabled="sending || !newCallsign.trim() || !newMessage.trim()">
                        <i class="bi" :class="sending ? 'bi-hourglass-split' : 'bi-send'"></i> Send
                    </button>
                </div>
                <textarea class="form-control form-control-sm" rows="2"
                    v-model="newMessage" placeholder="Message text... (Ctrl+Enter to send)"
                    @keydown="handleKeydown"></textarea>
            </div>
            <div class="inbox-list">
                <div v-if="loading" class="text-center text-muted p-4">
                    <div class="spinner-border spinner-border-sm"></div> Loading inbox…
                </div>
                <div v-else-if="!messages.length" class="text-center text-muted p-4">
                    <i class="bi bi-inbox"></i> Inbox is empty
                </div>
                <InboxMessage v-else v-for="msg in messages" :key="msg.Id" :message="msg" />
            </div>
        </div>
    `
}
