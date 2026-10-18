package com.fuzzhawk.thefeed;

import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean immersive = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FeedNativePlugin.class);
        super.onCreate(savedInstanceState);
        immersive = prefs().getBoolean("immersive", true);
        applyImmersive();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("thefeed", MODE_PRIVATE);
    }

    // Hides the navigation buttons; a swipe up from the bottom edge shows them briefly.
    void setFeedImmersive(boolean on) {
        immersive = on;
        prefs().edit().putBoolean("immersive", on).apply();
        applyImmersive();
    }

    private void applyImmersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        if (immersive) c.hide(WindowInsetsCompat.Type.navigationBars());
        else c.show(WindowInsetsCompat.Type.navigationBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }
}
