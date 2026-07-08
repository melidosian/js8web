import axios from 'axios'
import ChatMessage from './chat-message.mjs'
import QuickReplyBar from './quick-reply-bar.mjs'
const EXPECTED_MESSAGES_COUNT = 100

export default {
    props: ['filter', 'showRawPackets', 'hideHeartbeat', 'quickReplies'],
    emits: ['callsignSelected', 'frequencySelected', 'toast'],
    components: {
        ChatMessage,
        QuickReplyBar,
    },
    created() {
        this.fetchNewestMessages().then(messages => {
            this.messages = messages.filter(this.filterMessage)
            this.atBottom = true;
            this.$nextTick(_ => {
                this.scrollToBottom()
            })
        })

        this.$nextTick(_ => window.addEventListener('event', this.event))
    },
    unmounted() {
        window.removeEventListener('event', this.event)
    },
    data() {
        return {
            messages: [],
            atTop: false,
            atBottom: false,
            scrolledToBottom: true,
            newMessagesWaiting: false,
            loadingBefore: false,
            loadingAfter: false,
            txText: '',
            txSending: false,
            savedSelection: null,
        }
    },
    methods: {
        chatScroll(evt) {
            const el = evt.target
            const pos = el.scrollTop / el.scrollHeight
            this.scrolledToBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 40
            if (this.scrolledToBottom) {
                this.newMessagesWaiting = false
            }
            if (pos < 0.2 && !this.atTop && !this.loadingBefore) {
                this.loadingBefore = true
                this.fetchMessagesBefore()
            } else if (pos > 0.8 && !this.atBottom && !this.loadingAfter) {
                this.loadingAfter = true
                this.fetchMessagesAfter()
            }
        },
        fetchMessages(startTime, direction = 'before') {
            return axios.get('/api/chat-messages', {
                params: {
                    startTime: startTime,
                    direction: direction,
                    filter: JSON.stringify(this.filter),
                }
            }).then(response => response.data)
        },
        fetchNewestMessages() {
            return this.fetchMessages(new Date(Date.now()).toISOString())
        },
        fetchMessagesBefore() {
            if (this.messages.length < 1) {
                return
            }
            const from = this.messages[0].Timestamp
            this.fetchMessages(from, 'before').then(result => {
                const existingIds = this.messages.map(e => e.Id)
                const filteredResult = result.filter(e => !existingIds.includes(e.Id) && this.filterMessage(e))
                this.messages = filteredResult.concat(this.messages)
                this.loadingBefore = false
                this.atBottom = false
                if (result.length < EXPECTED_MESSAGES_COUNT) {
                    this.atTop = true
                }
            })
        },
        fetchMessagesAfter() {
            if (this.messages.length < 1) {
                return
            }
            const from = this.messages[this.messages.length - 1].Timestamp
            this.fetchMessages(from, 'after').then(result => {
                const existingIds = this.messages.map(e => e.Id)
                const filteredResult = result.filter(e => !existingIds.includes(e.Id) && this.filterMessage(e))
                this.messages = this.messages.slice(-2 * EXPECTED_MESSAGES_COUNT).concat(filteredResult)
                this.loadingAfter = false
                this.atTop = false
                if (result.length < EXPECTED_MESSAGES_COUNT) {
                    this.atBottom = true
                }
            })
        },
        scrollToBottom() {
            this.$refs.chatHistory.scrollTop = this.$refs.chatHistory.scrollHeight
        },
        filterMessage(message) {
            var ret = true;
            if (this.hideHeartbeat && message.Type !== 'TX.FRAME') {
                ret &&= !(message.Text || '').toUpperCase().includes('HEARTBEAT')
            }
            if (this.filter) {
                if (this.filter.Callsign) {
                    const needle = this.filter.Callsign.toLowerCase()
                    if (message.Type === 'TX.FRAME') {
                        const selected = (message.Selected || '').toLowerCase()
                        ret &&= selected.includes(needle)
                    } else {
                        const heap = ((message.From || '') + ':' + (message.To || '')).toLocaleLowerCase()
                        ret &&= heap.includes(needle)
                    }
                }

                if (this.filter.Freq && this.filter.Freq.From && this.filter.Freq.To) {
                    ret &&= message.Freq >= this.filter.Freq.From
                    ret &&= message.Freq <= this.filter.Freq.To
                }
            }
            return ret
        },
        newMessage(message) {
            if (!this.filterMessage(message)) {
                return
            }

            if (this.atBottom) {
                this.messages.push(message)
                if (this.scrolledToBottom) {
                    this.$nextTick(_ => this.scrollToBottom())
                } else {
                    this.newMessagesWaiting = true
                }
            }
        },
        jumpToBottom() {
            this.newMessagesWaiting = false
            this.fetchNewestMessages().then(messages => {
                this.messages = messages.filter(this.filterMessage)
                this.atTop = false
                this.atBottom = true
                this.$nextTick(_ => this.scrollToBottom())
            })
        },
        event(evt) {
            const event = evt.detail;
            if (event.EventType == "object" && (event.WsType == "RX.PACKET" || event.WsType == "TX.FRAME")) {
                const message = { ...event.Event }
                // Ensure TX.FRAME events have a Type field for chat-message routing
                if (event.WsType == "TX.FRAME" && !message.Type) {
                    message.Type = "TX.FRAME"
                }
                this.newMessage(message)
            }
        },
        sendMessage() {
            const text = this.txText.trim()
            if (!text || this.txSending) return

            this.txSending = true
            const body = this.filter?.Callsign ? `@${this.filter.Callsign} ${text}` : text
            axios.post('/api/tx-message', { text: body })
                .then(() => {
                    this.txText = ''
                    this.$emit('toast', { type: 'success', message: 'Message queued for transmission' })
                })
                .catch(err => {
                    const msg = err.response?.data?.error || 'Failed to send message'
                    this.$emit('toast', { type: 'error', message: msg })
                })
                .finally(() => {
                    this.txSending = false
                    this.$nextTick(() => this.$refs.txInput?.focus())
                })
        },
        handleTxKeydown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                this.sendMessage()
            }
        },
        saveCursorPosition() {
            const input = this.$refs.txInput
            if (input) this.savedSelection = { start: input.selectionStart, end: input.selectionEnd }
        },
        insertQuickReply(text) {
            const len = this.txText.length
            const start = this.savedSelection ? this.savedSelection.start : len
            const end   = this.savedSelection ? this.savedSelection.end   : len
            this.txText = this.txText.slice(0, start) + text + this.txText.slice(end)
            const newPos = start + text.length
            this.savedSelection = { start: newPos, end: newPos }
            this.$nextTick(() => {
                const input = this.$refs.txInput
                if (!input) return
                input.focus()
                input.setSelectionRange(newPos, newPos)
            })
        },
    },
    template: `
    <div class="chat">
        <div class="chat-history" @scroll=chatScroll ref="chatHistory">
            <div class="history-top" v-if="atTop">(No more messages)</div>
            <div class="loader" v-if="loadingBefore">LOADING</div>
            <ul class="m-b-0">
                <ChatMessage v-for="message in messages" :key=message.Id :message=message :showRawPackets=showRawPackets @callsignSelected="e => $emit('callsignSelected', e)" @frequencySelected="e => $emit('frequencySelected', e)" />
            </ul>
            <div class="loader" v-if="loadingAfter">LOADING</div>
            <div class="history-bottom" v-if="atBottom"><i class="bi bi-broadcast"></i> receiving <i class="bi bi-broadcast"></i></div>
        </div>
        <button class="jump-to-bottom-btn" v-if="newMessagesWaiting || !atBottom" @click="jumpToBottom" :title="newMessagesWaiting ? 'New messages' : 'Back to latest'">
            <i class="bi bi-arrow-down-circle-fill"></i>
        </button>
        <div class="chat-input" v-if="$root.authenticated && ($root.authUser?.role === 'admin' || $root.authUser?.role === 'operator')">
            <QuickReplyBar :quickReplies="quickReplies" @insert="insertQuickReply" />
            <div class="input-group">
                <span class="input-group-text" v-if="filter && filter.Callsign">@{{ filter.Callsign }}</span>
                <input type="text" class="form-control" :placeholder="filter && filter.Callsign ? 'Type reply...' : 'Type message to send via JS8Call...'" v-model="txText" @keydown="handleTxKeydown" @blur="saveCursorPosition" ref="txInput" :disabled="txSending">
                <button class="btn btn-primary" @click="sendMessage" :disabled="!txText.trim() || txSending">
                    <i class="bi" :class="txSending ? 'bi-hourglass-split' : 'bi-send'"></i> Send
                </button>
            </div>
        </div>
    </div>`
}
