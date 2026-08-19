package com.cleansweep.app.ui.common

import kotlin.math.ln
import kotlin.math.pow

fun Long.toHumanReadableSize(): String {
    if (this <= 0) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB", "TB")
    val digitGroups = (ln(this.toDouble()) / ln(1024.0)).toInt().coerceIn(0, units.lastIndex)
    val value = this / 1024.0.pow(digitGroups)
    return if (digitGroups == 0) "$this B" else "%.1f %s".format(value, units[digitGroups])
}
