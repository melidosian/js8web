import { textColorForBg } from './quick-replies.mjs'

export default {
    props: ['quickReplies'],
    emits: ['insert'],
    methods: {
        textColor(hex) { return textColorForBg(hex) },
    },
    template: `
        <div class="quick-reply-bar" v-if="quickReplies && quickReplies.length">
            <button
                v-for="btn in quickReplies"
                :key="btn.id"
                type="button"
                class="btn btn-sm quick-reply-btn"
                :style="{ backgroundColor: btn.color, color: textColor(btn.color), borderColor: btn.color }"
                @click="$emit('insert', btn.message)"
            >{{ btn.label }}</button>
        </div>
    `
}
