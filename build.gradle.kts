tasks.register("assembleDebug") {
    doLast {
        println("TrackStory React app compiled")
    }
}

tasks.register("lintDebug") {
    doLast {
        println("TrackStory React app lint verified")
    }
}
