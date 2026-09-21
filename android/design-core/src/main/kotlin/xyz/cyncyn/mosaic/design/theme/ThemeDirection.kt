package xyz.cyncyn.mosaic.design.theme

/**
 * The four candidate design directions for Mosaic.
 * Each direction is a full palette (light + dark); semantic roles and
 * components are shared, so switching direction only swaps palette data.
 */
enum class ThemeDirection(val label: String) {
    Terracotta("陶土"),
    Ink("墨与宣"),
    Sage("苔绿"),
    Indigo("靛蓝"),
}
