package expo.modules.gamepulsemedia

import android.content.Context
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Downloads a Moment's MP4 (Bunny "MP4 fallback") into the cache, best quality first. */
object Downloader {
  /** Tries each URL in order (e.g. 720p, 480p, 360p) and keeps the first that exists. */
  fun fetch(context: Context, urls: List<String>, referer: String?, onProgress: (Float) -> Unit): File {
    var lastError: Exception? = null
    for (url in urls) {
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 20_000
        readTimeout = 30_000
        instanceFollowRedirects = true
        // Bunny blocks requests without a Referer when "Block direct URL file access" is on.
        referer?.let { setRequestProperty("Referer", it) }
      }
      try {
        val code = connection.responseCode
        if (code == 404 || code == 403) {
          lastError = IOException("HTTP $code for $url")
          continue
        }
        if (code !in 200..299) throw IOException("HTTP $code")
        val total = connection.contentLengthLong
        val out = File(context.cacheDir, "gp-download-${System.currentTimeMillis()}.mp4")
        connection.inputStream.use { input ->
          out.outputStream().use { output ->
            val buffer = ByteArray(64 * 1024)
            var done = 0L
            var lastReport = 0L
            while (true) {
              val n = input.read(buffer)
              if (n < 0) break
              output.write(buffer, 0, n)
              done += n
              if (total > 0 && done - lastReport > 256 * 1024) {
                lastReport = done
                onProgress(done.toFloat() / total)
              }
            }
          }
        }
        onProgress(1f)
        return out
      } catch (e: Exception) {
        lastError = e
      } finally {
        connection.disconnect()
      }
    }
    throw IOException(
      "This Moment isn't available to download yet. (${lastError?.message ?: "no file"})",
      lastError,
    )
  }
}
