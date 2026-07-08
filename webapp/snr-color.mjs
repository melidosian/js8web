const SNR_COLOR_1 = { red: 0, green: 0, blue: 125 }
const SNR_COLOR_2 = { red: 255, green: 255, blue: 0 }
const SNR_COLOR_3 = { red: 255, green: 0, blue: 0 }

export function snrColor(snr) {
    let snrAligned = Math.max(-30, Math.min(20, snr)) + 30
    let fade = snrAligned / 50.0

    let color1 = SNR_COLOR_1
    let color2 = SNR_COLOR_2

    fade = fade * 2
    if (fade >= 1) {
        fade -= 1
        color1 = SNR_COLOR_2
        color2 = SNR_COLOR_3
    }

    const diffRed = color2.red - color1.red
    const diffGreen = color2.green - color1.green
    const diffBlue = color2.blue - color1.blue

    const gradient = {
        red: parseInt(Math.floor(color1.red + (diffRed * fade)), 10),
        green: parseInt(Math.floor(color1.green + (diffGreen * fade)), 10),
        blue: parseInt(Math.floor(color1.blue + (diffBlue * fade)), 10),
    }

    return 'rgb(' + gradient.red + ',' + gradient.green + ',' + gradient.blue + ')'
}
