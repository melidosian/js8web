export const DEFAULT_QUICK_REPLIES = [
    { id: 1, label: 'CQ',      color: '#1a6fa8', message: '@ALLCALL CQ CQ CQ' },
    { id: 6, label: 'HB',      color: '#16a085', message: '@HB HEARTBEAT' },
    { id: 2, label: 'INFO',    color: '#27ae60', message: 'INFO' },
    { id: 3, label: 'HOW CPY', color: '#7d3c98', message: 'HOW CPY?' },
    { id: 4, label: 'QSL',     color: '#b7770d', message: 'QSL' },
    { id: 5, label: '73',      color: '#c0392b', message: '73' },
]

export function textColorForBg(hex) {
    if (!hex || hex.length < 7) return '#ffffff'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff'
}

export function loadQuickReplies() {
    try {
        const stored = localStorage.getItem('quickReplies')
        if (stored) return JSON.parse(stored)
    } catch (e) {}
    return DEFAULT_QUICK_REPLIES.map(r => ({ ...r }))
}

export function saveQuickReplies(replies) {
    try {
        localStorage.setItem('quickReplies', JSON.stringify(replies))
    } catch (e) {}
}
