package com.trackstory.app.ui.reader

import android.os.Build
import android.webkit.WebView
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

internal object ReaderAppearance {
    private const val DARK_CSS = "html,body,#outer,#inner,#main,#workskin,.userstuff,.wrapper,.module,.preface,.afterword{background:#121212!important;color:#e0e0e0!important}a{color:#a8c7fa!important}input,select,textarea,button{background:#252525!important;color:#e0e0e0!important}"

    fun script(dark: Boolean) = """
        (function(){
          var id='trackstory-dark-style';
          var old=document.getElementById(id);
          if(old)old.remove();
          document.documentElement.style.colorScheme='${if (dark) "dark" else "light"}';
          ${if (dark) "var s=document.createElement('style');s.id=id;s.textContent='$DARK_CSS';(document.head||document.documentElement).appendChild(s);" else ""}
        })();
    """.trimIndent()

    fun apply(view: WebView, dark: Boolean) {
        view.setBackgroundColor(if (dark) 0xFF121212.toInt() else 0xFFFFFFFF.toInt())
        if (Build.VERSION.SDK_INT >= 33 && WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(view.settings, dark)
        }
        view.evaluateJavascript(script(dark), null)
    }
}
