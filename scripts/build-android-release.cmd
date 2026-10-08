@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "NODE_ENV=production"
cd /d "C:\Users\adyem\Desktop\gamepulse\android"
echo MODULE-COMPILE-OK> "C:\Users\adyem\Desktop\gamepulse-build.log"
call "C:\Users\adyem\Desktop\gamepulse\android\gradlew.bat" assembleRelease bundleRelease --no-daemon --max-workers=2 --console=plain -PreactNativeArchitectures=arm64-v8a,armeabi-v7a -Pkotlin.compiler.execution.strategy=in-process "-Dorg.gradle.internal.repository.max.retries=10" "-Dorg.gradle.internal.repository.initial.backoff=2000" "-Dorg.gradle.internal.http.connectionTimeout=120000" "-Dorg.gradle.internal.http.socketTimeout=120000" >> "C:\Users\adyem\Desktop\gamepulse-build.log" 2>&1
if %ERRORLEVEL%==0 (copy /Y "C:\Users\adyem\Desktop\gamepulse\android\app\build\outputs\apk\release\app-release.apk" "C:\Users\adyem\Desktop\GamePulse-1.1.0.apk" >nul & copy /Y "C:\Users\adyem\Desktop\gamepulse\android\app\build\outputs\bundle\release\app-release.aab" "C:\Users\adyem\Desktop\GamePulse-1.1.0-v5.aab" >nul & echo BUILD-DONE-OK>> "C:\Users\adyem\Desktop\gamepulse-build.log") else (echo BUILD-DONE-FAILED>> "C:\Users\adyem\Desktop\gamepulse-build.log")
