import { DEFAULT_QUICK_REPLIES, textColorForBg } from './quick-replies.mjs'

export default {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    data() {
        return { editingId: null }
    },
    computed: {
        replies() { return this.modelValue || [] }
    },
    methods: {
        textColor(hex) { return textColorForBg(hex) },
        emit(newReplies) { this.$emit('update:modelValue', newReplies) },
        toggleEdit(id) { this.editingId = this.editingId === id ? null : id },
        addNew() {
            const maxId = this.replies.reduce((m, r) => Math.max(m, r.id || 0), 0)
            const newItem = { id: maxId + 1, label: 'NEW', color: '#607d8b', message: '' }
            const next = [...this.replies, newItem]
            this.emit(next)
            this.editingId = newItem.id
        },
        remove(id) {
            if (this.editingId === id) this.editingId = null
            this.emit(this.replies.filter(r => r.id !== id))
        },
        move(id, dir) {
            const idx = this.replies.findIndex(r => r.id === id)
            if (idx < 0) return
            const next = [...this.replies]
            const swap = idx + dir
            if (swap < 0 || swap >= next.length) return
            ;[next[idx], next[swap]] = [next[swap], next[idx]]
            this.emit(next)
        },
        updateField(id, field, value) {
            this.emit(this.replies.map(r => r.id === id ? { ...r, [field]: value } : r))
        },
        resetDefaults() {
            this.editingId = null
            this.emit(DEFAULT_QUICK_REPLIES.map(r => ({ ...r })))
        },
    },
    template: `
        <div class="quick-reply-settings">
            <div class="d-flex align-items-center mb-2">
                <strong class="me-auto">Quick Reply Buttons</strong>
                <button class="btn btn-sm btn-outline-secondary me-1" @click="resetDefaults">Reset defaults</button>
                <button class="btn btn-sm btn-outline-primary" @click="addNew"><i class="bi bi-plus-lg"></i> Add</button>
            </div>
            <p v-if="!replies.length" class="text-muted small mb-0">No quick reply buttons configured.</p>
            <div v-for="btn in replies" :key="btn.id" class="qr-item">
                <div class="d-flex align-items-center gap-1">
                    <button
                        class="btn btn-sm qr-preview-btn"
                        :style="{ backgroundColor: btn.color, color: textColor(btn.color), borderColor: btn.color }"
                        @click="toggleEdit(btn.id)"
                    >{{ btn.label }}</button>
                    <span class="text-muted small flex-fill text-truncate">{{ btn.message }}</span>
                    <button class="btn btn-sm btn-outline-secondary qr-ctrl" @click="move(btn.id, -1)" :disabled="replies.indexOf(btn) === 0"><i class="bi bi-chevron-up"></i></button>
                    <button class="btn btn-sm btn-outline-secondary qr-ctrl" @click="move(btn.id, 1)" :disabled="replies.indexOf(btn) >= replies.length - 1"><i class="bi bi-chevron-down"></i></button>
                    <button class="btn btn-sm btn-outline-danger qr-ctrl" @click="remove(btn.id)"><i class="bi bi-trash"></i></button>
                </div>
                <div v-if="editingId === btn.id" class="qr-edit p-2 mt-1 border rounded">
                    <div class="row g-2">
                        <div class="col-5">
                            <label class="form-label small mb-0">Label</label>
                            <input type="text" class="form-control form-control-sm" :value="btn.label" @input="updateField(btn.id, 'label', $event.target.value)">
                        </div>
                        <div class="col-3">
                            <label class="form-label small mb-0">Color</label>
                            <input type="color" class="form-control form-control-sm form-control-color w-100" :value="btn.color" @input="updateField(btn.id, 'color', $event.target.value)">
                        </div>
                        <div class="col-4 d-flex align-items-end">
                            <button class="btn btn-sm" :style="{ backgroundColor: btn.color, color: textColor(btn.color), borderColor: btn.color, width: '100%' }">{{ btn.label }}</button>
                        </div>
                        <div class="col-12">
                            <label class="form-label small mb-0">Message text</label>
                            <input type="text" class="form-control form-control-sm" :value="btn.message" @input="updateField(btn.id, 'message', $event.target.value)" placeholder="Text inserted into compose field">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}
