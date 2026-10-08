package expo.modules.gamepulsemedia

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.IOException

/** Puts a finished video in the phone's gallery, in a "GamePulse" album. */
object Gallery {
  private const val ALBUM = "GamePulse"

  /** Returns the saved video's content:// or file:// URI. */
  fun saveVideo(context: Context, file: File, name: String): String {
    val displayName = name.replace(Regex("[^A-Za-z0-9_.-]"), "_").take(80).ifEmpty { "GamePulse" } + ".mp4"

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // Android 10+: no storage permission needed for our own files in Movies/.
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/$ALBUM")
        put(MediaStore.Video.Media.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Couldn't create the file in your gallery")
      try {
        resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }
          ?: throw IOException("Couldn't write to your gallery")
        values.clear()
        values.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri.toString()
      } catch (e: Exception) {
        resolver.delete(uri, null, null)
        throw e
      }
    }

    // Android 7–9: needs the storage permission (the app asks before calling this).
    @Suppress("DEPRECATION")
    val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), ALBUM)
    if (!dir.exists() && !dir.mkdirs()) throw IOException("Couldn't create the GamePulse folder")
    val target = File(dir, displayName)
    file.copyTo(target, overwrite = true)
    MediaScannerConnection.scanFile(context, arrayOf(target.absolutePath), arrayOf("video/mp4"), null)
    return "file://${target.absolutePath}"
  }
}
