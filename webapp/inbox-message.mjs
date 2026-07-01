export default {
    props: ['message'],
    template: `
        <div class="inbox-msg">
            <div class="inbox-msg-header">
                <span class="inbox-from">{{ message.Callsign }}</span>
                <span class="inbox-time">{{ new Date(message.Timestamp).toLocaleString() }}</span>
            </div>
            <div class="inbox-msg-body">{{ message.Message }}</div>
        </div>
    `
}
