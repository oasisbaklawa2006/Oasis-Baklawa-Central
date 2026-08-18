import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Central TV surface -> allowed origin + department code, one config source for
// Kotlin (AllowlistPolicy) and the manifest via BuildConfig. See DEPARTMENTS.md.
val centralWebOrigin: String =
    (project.findProperty("CENTRAL_WEB_ORIGIN") as String?)
        ?: System.getenv("CENTRAL_WEB_ORIGIN")
        ?: "https://app.oasisbaklawacentral.com"

android {
    namespace = "com.oasisbaklawa.centraltv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.oasisbaklawa.centraltv"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "CENTRAL_WEB_ORIGIN", "\"$centralWebOrigin\"")
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Release signing is intentionally NOT configured here -- no keystore
            // secrets are committed to the repo. See RELEASE_SIGNING.md for the
            // owner-side signing setup required before a distributable APK/AAB
            // can be produced. CI builds an unsigned release artifact only.
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
        disable += "MissingTranslation"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.leanback:leanback:1.0.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-process:2.8.4")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
