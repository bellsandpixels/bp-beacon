import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// @bp/beacon (KMP) - the shared Kotlin Multiplatform Beacon feedback client (decision #103, the "one
// Beacon home"). Extracted from fudemoji's local :beacon module so every KMP product (fudemoji, bunko)
// speaks ONE native client and ONE wire contract (client-portal docs/beacon-anon-ingest-spec.md), the
// same envelope the web @bp/beacon SDK and the non-KMP native clients send.
//
// Consumed as a git submodule: a KMP app includes this module in its settings.gradle.kts and points the
// projectDir at <submodule>/kmp. It resolves ktor / kotlinx-serialization / coroutines through the
// CONSUMER's version catalog (libs.*); fudemoji and bunko already pin identical coordinates.
//
// Windows/Mac: androidTarget + commonMain build + test on Windows; the ios* targets are declared so the
// Beacon.framework is produced on the Mac host, and Kotlin/Native disables them on Windows.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64(),
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "Beacon"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.kotlinx.serialization.json)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.ktor.client.mock)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}

android {
    namespace = "com.bellsandpixels.beacon"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
