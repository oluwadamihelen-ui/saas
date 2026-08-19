package com.cleansweep.app.ui.navigation

enum class Destination(val route: String, val label: String) {
    Dashboard("dashboard", "Dashboard"),
    Duplicates("duplicates", "Duplicate Photos & Videos"),
    LargeFiles("large_files", "Large & Old Files"),
    AppManager("app_manager", "App Manager"),
    Junk("junk", "Junk Cleaner"),
}
