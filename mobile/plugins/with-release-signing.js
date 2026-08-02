const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Config plugin: real signing for release builds.
 *
 * `expo prebuild` generates an android/app/build.gradle whose release build type
 * is signed with Android's shared **debug** key. That is fine for testing and
 * completely unsuitable for the APK the client installs — a debug-signed build
 * cannot be updated by a properly signed one later, and anybody can produce an
 * APK that Android considers the same app.
 *
 * This is a plugin rather than a hand-edit because android/ is generated: any
 * manual change is silently lost the next time someone runs prebuild, and it
 * would be lost right before a release build, which is the worst possible time.
 *
 * Credentials are read from Gradle properties (or the matching environment
 * variables), so the keystore and its passwords never enter the repository.
 * When they are absent the build falls back to the debug key and says so, so a
 * misconfigured release fails loudly in the log rather than silently shipping.
 */

const SIGNING_CONFIG = `
    release {
        // Set these in android/gradle.properties or as environment variables.
        // See mobile/README.md → "Release signing".
        if (project.hasProperty('DAIRY_UPLOAD_STORE_FILE')) {
            storeFile file(DAIRY_UPLOAD_STORE_FILE)
            storePassword DAIRY_UPLOAD_STORE_PASSWORD
            keyAlias DAIRY_UPLOAD_KEY_ALIAS
            keyPassword DAIRY_UPLOAD_KEY_PASSWORD
        } else if (System.getenv('DAIRY_UPLOAD_STORE_FILE')) {
            storeFile file(System.getenv('DAIRY_UPLOAD_STORE_FILE'))
            storePassword System.getenv('DAIRY_UPLOAD_STORE_PASSWORD')
            keyAlias System.getenv('DAIRY_UPLOAD_KEY_ALIAS')
            keyPassword System.getenv('DAIRY_UPLOAD_KEY_PASSWORD')
        }
    }
`;

const RELEASE_SIGNING_SELECTION = `
            // Use the real signing key when one is configured; otherwise fall
            // back to debug so local release builds still work, with a warning
            // loud enough to notice before handing the APK to anyone.
            if (project.hasProperty('DAIRY_UPLOAD_STORE_FILE') || System.getenv('DAIRY_UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn('WARNING: no release keystore configured — signing with the DEBUG key. Do not distribute this APK.')
                signingConfig signingConfigs.debug
            }
`;

/**
 * Ship only the ABIs real phones use.
 *
 * A default build bundles four: arm64-v8a and armeabi-v7a (actual devices) plus
 * x86 and x86_64, which exist for emulators. Those two add ~43 MB to an APK that
 * is delivered by hand over WhatsApp or Drive — where 100 MB is an obstacle and
 * 57 MB is not.
 *
 * armeabi-v7a is kept deliberately: 32-bit budget phones are still in use, and
 * an APK that silently will not install on one is worse than a larger download.
 *
 * The dev workflow is unaffected — `expo start` serves JS to a device over the
 * network and does not need an x86 build unless an emulator is used, in which
 * case add it back here.
 */
function withDeviceAbisOnly(config) {
  return withGradleProperties(config, (mod) => {
    const key = "reactNativeArchitectures";
    const value = "armeabi-v7a,arm64-v8a";

    const existing = mod.modResults.find(
      (item) => item.type === "property" && item.key === key
    );
    if (existing) {
      existing.value = value;
    } else {
      mod.modResults.push({ type: "property", key, value });
    }
    return mod;
  });
}

function withSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;

    // Guard against double-application (prebuild runs plugins on an existing
    // file when --clean is not passed).
    if (gradle.includes("DAIRY_UPLOAD_STORE_FILE")) return mod;

    // 1. Add a `release` signing config alongside the generated `debug` one.
    const signingConfigsMatch = gradle.match(/signingConfigs\s*\{/);
    if (!signingConfigsMatch) {
      throw new Error(
        "with-release-signing: could not find a signingConfigs block in app/build.gradle."
      );
    }
    const insertAt = signingConfigsMatch.index + signingConfigsMatch[0].length;
    gradle = gradle.slice(0, insertAt) + SIGNING_CONFIG + gradle.slice(insertAt);

    // 2. Point the release build type at it.
    const releaseSigning = /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/;
    if (!releaseSigning.test(gradle)) {
      throw new Error(
        "with-release-signing: the release build type no longer defaults to signingConfigs.debug; " +
          "check what expo prebuild generated before changing this plugin."
      );
    }
    gradle = gradle.replace(
      releaseSigning,
      (match) => match.replace(/signingConfig signingConfigs\.debug$/, RELEASE_SIGNING_SELECTION.trim())
    );

    mod.modResults.contents = gradle;
    return mod;
  });
}

module.exports = function withReleaseSigning(config) {
  return withDeviceAbisOnly(withSigning(config));
};
