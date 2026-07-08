import { snrColor } from './snr-color.mjs'

export default {
    props: ['message'],
    emits: ['frequencySelected'],
    components: {
    },
    methods: {
        snrColor,
    },
    template: `
        <span class="gauges">
            <span class="gauge freq"><a class="btn btn-light btn-sm" href="#" @click="$emit('frequencySelected', message.Freq)"><i class="bi bi-broadcast-pin"></i> {{ message.Offset }}Hz</a></span>
            <span class="gauge snr"><i class="bi bi-speedometer2"></i><span :style="'color: ' + snrColor(message.Snr)">{{ message.Snr > 0 ? '+' : '' }} {{ message.Snr }}</span></span>
            <span class="gauge speed" v-if="message.Speed"><i class="bi bi-skip-end"></i><span :class="message.Speed"> {{ message.Speed[0].toUpperCase() }}</span></span>
            <span class="gauge timedritft"><i class="bi bi-stopwatch"></i> {{ message.TimeDrift > 0 ? '+' : '' }}{{ message.TimeDrift }}ms</span>
        </span>
    `
}

