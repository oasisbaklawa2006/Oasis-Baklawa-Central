# WebView JS-interface objects need their public methods kept if any are ever
# added; the app currently exposes no @JavascriptInterface, but rules are kept
# ready so a future addition doesn't silently break under R8.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
