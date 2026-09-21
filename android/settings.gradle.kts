pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // PREFER_PROJECT: a global ~/.gradle/init.gradle injects Aliyun mirrors as project
    // repositories; they must take priority, with google()/mavenCentral() as fallback.
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "mosaic-android"

include(":design-core")
include(":app")
