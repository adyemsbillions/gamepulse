package expo.modules.gamepulsemedia

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

/**
 * GamePulse's own media tools (Android), built on Media3 Transformer:
 *   compress(uri)            shrink a clip to 720p H.264 before upload (much faster uploads)
 *   saveWatermarked(opts)    download a Moment, add the GamePulse badge + @username and an end
 *                            card, and save it to the gallery (Movies/GamePulse)
 * Progress for both arrives as "onProgress" events: { job, stage, progress 0–1 }.
 */
class GamePulseMediaModule : Module() {
  private val io = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No Android context" }

  override fun definition() = ModuleDefinition {
    Name("GamePulseMedia")
    Events("onProgress")

    AsyncFunction("compress") { uri: String, job: String, promise: Promise ->
      val ctx = context
      io.execute {
        try {
          val plan = Compressor.plan(ctx, uri)
          if (plan == null) {
            // Already small enough (or unreadable): upload the original as it is.
            promise.resolve(null)
            return@execute
          }
          main.post {
            Compressor.run(ctx, uri, plan, main,
              onProgress = { p -> emit(job, "compressing", p) },
              onDone = { path -> promise.resolve(path) },
              onError = { e -> promise.reject("E_COMPRESS", e.message ?: "Compression failed", e) },
            )
          }
        } catch (e: Exception) {
          promise.reject("E_COMPRESS", e.message ?: "Compression failed", e)
        }
      }
    }

    AsyncFunction("saveWatermarked") { options: Map<String, Any?>, promise: Promise ->
      val ctx = context
      val job = options["job"] as? String ?: "download"
      io.execute {
        try {
          val request = Watermark.Request.from(options)
          val source = Downloader.fetch(ctx, request.urls, request.referer) { p -> emit(job, "downloading", p) }
          main.post {
            Watermark.export(ctx, source, request, main,
              onProgress = { p -> emit(job, "branding", p) },
              onDone = { output ->
                io.execute {
                  try {
                    val saved = Gallery.saveVideo(ctx, output, request.fileName)
                    output.delete()
                    source.delete()
                    promise.resolve(saved)
                  } catch (e: Exception) {
                    promise.reject("E_SAVE", e.message ?: "Couldn't save to the gallery", e)
                  }
                }
              },
              onError = { e ->
                source.delete()
                promise.reject("E_BRAND", e.message ?: "Couldn't prepare the video", e)
              },
            )
          }
        } catch (e: Exception) {
          promise.reject("E_DOWNLOAD", e.message ?: "Download failed", e)
        }
      }
    }
  }

  private fun emit(job: String, stage: String, progress: Float) {
    sendEvent(
      "onProgress",
      Bundle().apply {
        putString("job", job)
        putString("stage", stage)
        putDouble("progress", progress.coerceIn(0f, 1f).toDouble())
      },
    )
  }
}
