package expo.modules.gamepulsemedia

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.OverlaySettings
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.StaticOverlaySettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Branded downloads: the GamePulse badge with @username moves from bottom-left to top-right
 * halfway through (so it can't simply be cropped out), then a short end card.
 */
object Watermark {
  private const val PULSE = 0xFFC6FF3D.toInt()
  private const val ROYAL = 0xFF0E2F76.toInt()
  private const val DEEP = 0xFF081D4D.toInt()
  private const val ICE = 0xFFF4FEFF.toInt()
  private const val END_CARD_MS = 1800L

  data class Request(
    val urls: List<String>,
    val referer: String?,
    val username: String,
    val tag: String?,
    val fileName: String,
  ) {
    companion object {
      fun from(options: Map<String, Any?>): Request {
        @Suppress("UNCHECKED_CAST")
        val urls = (options["urls"] as? List<Any?>)?.filterIsInstance<String>().orEmpty()
        require(urls.isNotEmpty()) { "Nothing to download" }
        val username = (options["username"] as? String)?.trim()?.trimStart('@').orEmpty()
        return Request(
          urls = urls,
          referer = options["referer"] as? String,
          username = username.ifEmpty { "gamepulse" },
          tag = (options["tag"] as? String)?.trim()?.trimStart('#')?.takeIf { it.isNotEmpty() },
          fileName = (options["fileName"] as? String) ?: "GamePulse-${System.currentTimeMillis()}",
        )
      }
    }
  }

  /** Must be called on the main thread (Transformer's looper). */
  fun export(
    context: Context,
    source: File,
    request: Request,
    main: Handler,
    onProgress: (Float) -> Unit,
    onDone: (File) -> Unit,
    onError: (Exception) -> Unit,
  ) {
    val (width, height, durationMs) = videoInfo(source)
    val output = File(context.cacheDir, "gp-branded-${System.currentTimeMillis()}.mp4")

    // The moving badge over the clip.
    val badge = MovingBadge(badgeBitmap(width, request.username), switchAtUs = durationMs * 1000L / 2)
    val clip = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(source)))
      .setEffects(Effects(listOf(), listOf(OverlayEffect(listOf(badge)))))
      .build()

    // The end card, as a still image the same size as the video.
    val cardFile = File(context.cacheDir, "gp-endcard-${System.currentTimeMillis()}.png")
    cardFile.outputStream().use { endCard(width, height, request).compress(Bitmap.CompressFormat.PNG, 100, it) }
    val card = EditedMediaItem.Builder(
      MediaItem.Builder().setUri(Uri.fromFile(cardFile)).setImageDurationMs(END_CARD_MS).build(),
    )
      .setFrameRate(30)
      .build()

    // The card has no sound; force a (silent) audio track so the clip's audio carries through.
    val sequence = EditedMediaItemSequence.Builder(listOf(clip, card))
      .experimentalSetForceAudioTrack(true)
      .build()
    val composition = Composition.Builder(sequence).build()

    val encoders = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(5_000_000).build())
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
          cardFile.delete()
          onProgress(1f)
          onDone(output)
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          finished = true
          cardFile.delete()
          output.delete()
          onError(exportException)
        }
      })
      .build()

    transformer.start(composition, output.absolutePath)
    main.post(poll)
  }

  /** Display size (rotation applied) and duration of the downloaded clip. */
  private fun videoInfo(file: File): Triple<Int, Int, Long> {
    val r = MediaMetadataRetriever()
    try {
      r.setDataSource(file.absolutePath)
      val w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 720
      val h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 1280
      val rotation = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val duration = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      return if (rotation == 90 || rotation == 270) Triple(h, w, duration) else Triple(w, h, duration)
    } finally {
      r.release()
    }
  }

  /** Bottom-left for the first half, top-right for the second. */
  private class MovingBadge(private val bitmap: Bitmap, private val switchAtUs: Long) : BitmapOverlay() {
    private val first: OverlaySettings = StaticOverlaySettings.Builder()
      .setOverlayFrameAnchor(-1f, -1f)
      .setBackgroundFrameAnchor(-0.92f, -0.84f)
      .setAlphaScale(0.92f)
      .build()
    private val second: OverlaySettings = StaticOverlaySettings.Builder()
      .setOverlayFrameAnchor(1f, 1f)
      .setBackgroundFrameAnchor(0.92f, 0.86f)
      .setAlphaScale(0.92f)
      .build()

    override fun getBitmap(presentationTimeUs: Long): Bitmap = bitmap

    override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings =
      if (presentationTimeUs < switchAtUs) first else second
  }

  /** The pill: ball icon, GAMEPULSE wordmark, @username. Sized to about 42% of the video width. */
  private fun badgeBitmap(videoWidth: Int, username: String): Bitmap {
    val w = max((videoWidth * 0.42f).roundToInt(), 240)
    val h = (w * 0.28f).roundToInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val pad = h * 0.16f

    val pill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(150, 2, 10, 31) }
    c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), h / 2f, h / 2f, pill)

    // Ball icon: pulse-green disc with a deep-blue ring and a heartbeat stroke.
    val r = (h - pad * 2) / 2f
    val cx = pad + r
    val cy = h / 2f
    c.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PULSE })
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = DEEP
      style = Paint.Style.STROKE
      strokeWidth = r * 0.16f
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    val path = android.graphics.Path().apply {
      moveTo(cx - r * 0.62f, cy)
      lineTo(cx - r * 0.22f, cy)
      lineTo(cx - r * 0.05f, cy - r * 0.45f)
      lineTo(cx + r * 0.15f, cy + r * 0.42f)
      lineTo(cx + r * 0.3f, cy)
      lineTo(cx + r * 0.62f, cy)
    }
    c.drawPath(path, stroke)

    val textX = cx + r + pad * 0.9f
    val word = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = ICE
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      textSize = h * 0.30f
      letterSpacing = 0.12f
    }
    c.drawText("GAMEPULSE", textX, cy - h * 0.02f, word)
    val handle = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = PULSE
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      textSize = h * 0.24f
    }
    c.drawText(ellipsize("@$username", handle, w - textX - pad), textX, cy + h * 0.28f, handle)
    return bmp
  }

  /** Full-frame end card: gradient, big ball, wordmark, @username, the hashtag or tagline. */
  private fun endCard(width: Int, height: Int, request: Request): Bitmap {
    val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val bg = Paint().apply {
      shader = LinearGradient(0f, 0f, 0f, height.toFloat(), ROYAL, DEEP, Shader.TileMode.CLAMP)
    }
    c.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bg)

    val unit = minOf(width, height).toFloat()
    val cx = width / 2f
    val cy = height * 0.40f
    val r = unit * 0.16f
    // Glow rings, then the ball.
    for (i in 3 downTo 1) {
      c.drawCircle(cx, cy, r * (1f + i * 0.28f), Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PULSE
        style = Paint.Style.STROKE
        strokeWidth = unit * 0.006f
        alpha = 40 + (3 - i) * 35
      })
    }
    c.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PULSE })
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = DEEP
      style = Paint.Style.STROKE
      strokeWidth = r * 0.12f
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    c.drawPath(android.graphics.Path().apply {
      moveTo(cx - r * 0.62f, cy)
      lineTo(cx - r * 0.22f, cy)
      lineTo(cx - r * 0.05f, cy - r * 0.45f)
      lineTo(cx + r * 0.15f, cy + r * 0.42f)
      lineTo(cx + r * 0.3f, cy)
      lineTo(cx + r * 0.62f, cy)
    }, stroke)

    fun centered(text: String, y: Float, size: Float, color: Int, bold: Boolean, spacing: Float = 0f) {
      val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        textSize = size
        letterSpacing = spacing
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
      }
      c.drawText(ellipsize(text, p, width * 0.9f), cx, y, p)
    }

    centered("GAMEPULSE", cy + r * 2.0f, unit * 0.085f, ICE, bold = true, spacing = 0.18f)
    centered("@${request.username}", cy + r * 2.75f, unit * 0.065f, PULSE, bold = true)
    centered(request.tag?.let { "#$it" } ?: "Feel every Moment", cy + r * 3.35f, unit * 0.042f, ICE, bold = false)
    centered("Find them on GamePulse", height * 0.92f, unit * 0.036f, Color.argb(190, 169, 192, 224), bold = false)
    return bmp
  }

  private fun ellipsize(text: String, paint: Paint, maxWidth: Float): String {
    if (paint.measureText(text) <= maxWidth) return text
    var t = text
    while (t.length > 1 && paint.measureText("$t…") > maxWidth) t = t.dropLast(1)
    return "$t…"
  }
}
