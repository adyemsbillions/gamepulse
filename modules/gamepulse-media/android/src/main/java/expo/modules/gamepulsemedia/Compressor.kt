package expo.modules.gamepulsemedia

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import java.io.File

/** Shrinks clips to 720p H.264 before upload. Bunny re-encodes anyway, so nothing visible is lost. */
object Compressor {
  private const val TARGET_SHORT_SIDE = 720
  private const val TARGET_BITRATE = 3_000_000
  /** Leave clips that are already this small alone. */
  private const val SKIP_BELOW_BYTES = 12L * 1024 * 1024

  data class Plan(val shortSide: Int)

  /** Null when compressing wouldn't help (already small, or not a readable video). */
  fun plan(context: Context, uri: String): Plan? {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(context, Uri.parse(uri))
      val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: return null
      val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: return null
      val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toLongOrNull() ?: 0L
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val estimatedBytes = bitrate * durationMs / 8000
      val small = minOf(w, h) <= TARGET_SHORT_SIDE && bitrate in 1..(TARGET_BITRATE * 3 / 2)
      if (small || (estimatedBytes in 1 until SKIP_BELOW_BYTES)) null else Plan(TARGET_SHORT_SIDE)
    } catch (e: Exception) {
      null
    } finally {
      retriever.release()
    }
  }

  /** Must be called on the main thread (Transformer's looper). */
  fun run(
    context: Context,
    uri: String,
    plan: Plan,
    main: Handler,
    onProgress: (Float) -> Unit,
    onDone: (String) -> Unit,
    onError: (Exception) -> Unit,
  ) {
    val output = File(context.cacheDir, "gp-upload-${System.currentTimeMillis()}.mp4")
    val item = EditedMediaItem.Builder(MediaItem.fromUri(uri))
      .setEffects(Effects(listOf(), listOf(Presentation.createForShortSide(plan.shortSide))))
      .build()

    val encoders = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(TARGET_BITRATE).build())
      .setEnableFallback(true)
      .build()

    lateinit var transformer: Transformer
    val holder = ProgressHolder()
    var finished = false
    val poll = object : Runnable {
      override fun run() {
        if (finished) return
        if (transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) onProgress(holder.progress / 100f)
        main.postDelayed(this, 400)
      }
    }

    transformer = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setEncoderFactory(encoders)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          finished = true
          onProgress(1f)
          onDone("file://${output.absolutePath}")
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          finished = true
          output.delete()
          onError(exportException)
        }
      })
      .build()

    transformer.start(item, output.absolutePath)
    main.post(poll)
  }
}
