// Converts a Maidenhead grid locator (4 or 6 characters, e.g. "EN52" or "EN52ts")
// to the approximate lat/lon of the center of that grid square.
export function gridToLatLon(grid) {
    if (!grid || grid.length < 4) return null
    const g = grid.trim().toUpperCase()
    if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(g)) return null

    let lon = (g.charCodeAt(0) - 65) * 20 - 180
    let lat = (g.charCodeAt(1) - 65) * 10 - 90
    lon += Number(g[2]) * 2
    lat += Number(g[3]) * 1

    if (g.length >= 6) {
        // Subsquare: refine within the 2°x1° square instead of just centering on it.
        lon += (g.charCodeAt(4) - 65) * (2 / 24)
        lat += (g.charCodeAt(5) - 65) * (1 / 24)
        lon += 1 / 24
        lat += 1 / 48
    } else {
        // No subsquare — center of the 2°x1° square.
        lon += 1
        lat += 0.5
    }

    return { lat, lon }
}
