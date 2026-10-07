plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing comes from the environment, never the repo. Set
// DEALDEX_KEYSTORE / DEALDEX_KEYSTORE_PASSWORD / DEALDEX_KEY_ALIAS /
// DEALDEX_KEY_PASSWORD in CI. Absent, `assembleRelease` still builds and is
// simply unsigned, which is what happened before this existed.
val keystorePath: String? = System.getenv("DEALDEX_KEYSTORE")
    ?: (project.findProperty("dealdex.keystore") as String?)

android {
    namespace = "me.grok.dealdex"
    // Google Play has required API 35 for new and updated submissions since
    // 31 Aug 2025. At 34 the Play Console rejects the upload before review.
    compileSdk = 35
    defaultConfig {
        applicationId = "me.grok.dealdex"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.0.3"

        // Compile-time DSN only.  Empty when SENTRY_DSN is unset so the SDK stays dark in CI.
        val sentryDsn = (System.getenv("SENTRY_DSN") ?: "")
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
        buildConfigField("String", "SENTRY_DSN", "\"$sentryDsn\"")
    }
    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("DEALDEX_KEYSTORE_PASSWORD")
                    ?: (project.findProperty("dealdex.keystorePassword") as String?)
                keyAlias = System.getenv("DEALDEX_KEY_ALIAS")
                    ?: (project.findProperty("dealdex.keyAlias") as String?)
                keyPassword = System.getenv("DEALDEX_KEY_PASSWORD")
                    ?: (project.findProperty("dealdex.keyPassword") as String?)
            }
        }
    }
    buildTypes {
        release {
            // R8 was off entirely, so the release APK shipped unshrunk and
            // unobfuscated. Keep rules live in proguard-rules.pro.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.15" }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

base {
    archivesName.set("DealDex")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.11.0")
    implementation("androidx.navigation:navigation-compose:2.10.2")
    implementation("androidx.core:core-ktx:1.19.1")
    // Credentials (session token, PKCE verifier, desk API keys) belong in an
    // encrypted store, not a plain SharedPreferences plist.
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")
    // Crash + ANR + profiling + scan spans.  Mapping upload plugin skipped;
    // consumer rules ship with each AAR.
    implementation("io.sentry:sentry-android:8.59.0")
    implementation("io.sentry:sentry-android-okhttp:8.54.0")
    implementation("io.sentry:sentry-android-fragment:8.59.0")
    implementation("io.sentry:sentry-android-compose:8.54.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
