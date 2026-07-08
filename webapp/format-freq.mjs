// Formats a frequency in Hz as MHz. Defaults to 3 decimals (kHz resolution), which is
// all that's meaningful for a dial/tuned frequency. Pass more decimals when the sub-kHz
// offset itself is the interesting part (e.g. distinguishing spots on the same dial).
export function hzToMHz(hz, decimals = 3) {
    return (hz / 1e6).toFixed(decimals)
}
