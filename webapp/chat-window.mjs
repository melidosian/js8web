import Chat from './chat.mjs'
import AdminUsers from './admin-users.mjs'
import QuickReplySettings from './quick-reply-settings.mjs'
import { loadQuickReplies, saveQuickReplies } from './quick-replies.mjs'
import Inbox from './inbox.mjs'
import Rig from './rig.mjs'
import StationDetails from './station-details.mjs'

function uidGenerator() {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

export default {
    components: {
        Chat,
        AdminUsers,
        QuickReplySettings,
        Inbox,
        Rig,
        StationDetails,
    },
    emits: ['toast'],
    data() {
        return {
            activeTab: 'all',
            chats: [
                {
                    id: 'all',
                    label: 'All messages',
                    filter: {},
                },
            ],
            uid: uidGenerator(),
            settingsShowRawPackets: true,
            settingsHideHeartbeat: false,
            quickReplies: loadQuickReplies(),
        }
    },
    watch: {
        quickReplies: {
            deep: true,
            handler(val) { saveQuickReplies(val) }
        }
    },
    methods: {
        activateTab(selected) {
            this.activeTab = selected
        },
        closeTab(id) {
            this.chats = this.chats.filter(e => e.id != id)
        },
        newTab(label, filter) {
            const id = uidGenerator()
            this.chats.push({
                id,
                label,
                filter
            })
            return id
        },
        callsignSelected(callsign) {
            const existing = this.chats.find(c => c.filter.Callsign === callsign)
            if (existing) {
                this.activateTab(existing.id)
                return
            }
            this.activateTab(this.newTab(callsign, { Callsign: callsign }))
        },
        frequencySelected(frequency) {
            const from = Math.floor((frequency - 25) / 50) * 50
            const to = from + 50
            const existing = this.chats.find(c => c.filter.Freq && c.filter.Freq.From === from && c.filter.Freq.To === to)
            if (existing) {
                this.activateTab(existing.id)
                return
            }
            this.activateTab(this.newTab(from + 'Hz', { Freq: { From: from, To: to } }))
        },
    },
    template: `
    <ul class="nav nav-tabs">
        <template v-for="chat in chats" :id="chat.id">
            <li class="nav-item" :class="{active: activeTab == chat.id}">
                <a class="nav-link" :class="{active: activeTab == chat.id}" @click="activateTab(chat.id)" href="#">
                    <span class="nav-label">{{ chat.label }}</span>
                    <span class="tab-close" v-if="chat.id != 'all'" @click.stop.prevent="closeTab(chat.id)" title="Close tab"><i class="bi bi-x"></i></span>
                </a>
            </li>
        </template>
        <li class="nav-item" :class="{active: activeTab == 'inbox'}">
            <a class="nav-link" :class="{active: activeTab == 'inbox'}" @click="activateTab('inbox')" href="#"><i class="bi bi-inbox"></i> Inbox</a>
        </li>
        <li class="nav-item" :class="{active: activeTab == 'rig'}">
            <a class="nav-link" :class="{active: activeTab == 'rig'}" @click="activateTab('rig')" href="#"><i class="bi bi-broadcast"></i> Rig</a>
        </li>
        <li class="nav-item" :class="{active: activeTab == 'settings'}">
            <a class="nav-link" :class="{active: activeTab == 'settings'}" @click="activateTab('settings')" href="#"><i class="bi bi-gear"></i></a>
        </li>
        <li class="nav-item" v-if="$root.authUser?.role === 'admin'" :class="{active: activeTab == 'admin'}">
            <a class="nav-link" :class="{active: activeTab == 'admin'}" @click="activateTab('admin')" href="#"><i class="bi bi-shield-lock"></i> Admin</a>
        </li>
    </ul>
    <template v-for="chat in chats">
        <Chat v-show="activeTab == chat.id" :filter="chat.filter" :showRawPackets="this.settingsShowRawPackets" :hideHeartbeat="this.settingsHideHeartbeat" :quickReplies="quickReplies" @callsignSelected="this.callsignSelected" @frequencySelected="this.frequencySelected" @toast="e => $emit('toast', e)" />
    </template>
    <div v-show="activeTab == 'settings'" class="settings-panel">
        <div class="row">
            <div class="col-12">
                <div class="form-check form-switch settings">
                    <input class="form-check-input" type="checkbox" role="switch" :id="this.uid+'-show-raw-packets'" v-model="this.settingsShowRawPackets">
                    <label class="form-check-label" :for="this.uid+'-show-raw-packets'">Show raw packets</label>
                </div>
                <div class="form-check form-switch settings">
                    <input class="form-check-input" type="checkbox" role="switch" :id="this.uid+'-hide-heartbeat'" v-model="this.settingsHideHeartbeat">
                    <label class="form-check-label" :for="this.uid+'-hide-heartbeat'">Hide incoming heartbeat messages</label>
                </div>
            </div>
        </div>
        <hr>
        <StationDetails @toast="e => $emit('toast', e)" />
        <hr>
        <QuickReplySettings v-model="quickReplies" />
    </div>
    <Inbox v-if="activeTab == 'inbox'" v-show="activeTab == 'inbox'" @toast="e => $emit('toast', e)" />
    <Rig v-if="activeTab == 'rig'" v-show="activeTab == 'rig'" @toast="e => $emit('toast', e)" />
    <AdminUsers v-if="$root.authUser?.role === 'admin'" v-show="activeTab == 'admin'" @toast="e => $emit('toast', e)" />
    `
}