import java.security.MessageDigest

plugins {
    id("com.android.application")
}

android {
    namespace = "com.jamescampbelliscool.kidgames"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.jamescampbelliscool.kidgames"
        // Wireless debugging, which is how this reaches a phone, starts at Android 11.
        minSdk = 30
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

// The app carries a snapshot of the site so it works offline from the first
// launch: index.html and games/, copied straight from the repo, plus a list of
// each file's git blob hash so that Sync can tell which ones main has changed
// since. Sync filters GitHub's file list the same way (Sync.inSite), so the
// two have to agree on what counts as the site.
val bundleSite = tasks.register<BundleSite>("bundleSite") {
    val repo = rootProject.layout.projectDirectory.asFile.parentFile
    repoRoot.set(repo)
    siteFiles.from(File(repo, "index.html"))
    siteFiles.from(fileTree(File(repo, "games")) {
        exclude("**/Thumbs.db", "**/ehthumbs.db", "**/Desktop.ini", "**/.DS_Store")
    })
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(bundleSite, BundleSite::outputDir)
    }
}

abstract class BundleSite : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val siteFiles: ConfigurableFileCollection

    @get:Internal
    abstract val repoRoot: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun bundle() {
        val root = repoRoot.get().asFile
        val out = outputDir.get().asFile
        out.deleteRecursively()
        val hashes = sortedMapOf<String, String>()
        for (file in siteFiles.files) {
            val path = file.relativeTo(root).invariantSeparatorsPath
            var bytes = file.readBytes()
            // Stored as git stores it (.gitattributes asks for LF), whatever
            // an editor has left on disk, so the hashes match main's.
            if (path.substringAfterLast('.') in TEXT) {
                bytes = String(bytes, Charsets.UTF_8).replace("\r\n", "\n").toByteArray(Charsets.UTF_8)
            }
            File(out, "site/$path").apply { parentFile.mkdirs() }.writeBytes(bytes)
            hashes[path] = blobSha(bytes)
        }
        File(out, "site.json").writeText(
            hashes.entries.joinToString(",\n", "{\n", "\n}\n") { (path, sha) -> "  \"$path\": \"$sha\"" }
        )
    }

    private val TEXT = setOf("html", "htm", "js", "mjs", "css", "json", "jsonc", "svg", "txt", "md")

    // What git names a file by: the SHA-1 of a short header and its bytes.
    private fun blobSha(bytes: ByteArray): String {
        val md = MessageDigest.getInstance("SHA-1")
        md.update("blob ${bytes.size}\u0000".toByteArray())
        return md.digest(bytes).joinToString("") { "%02x".format(it) }
    }
}
