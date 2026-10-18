package com.fuzzhawk.thefeed;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "FeedNative")
public class FeedNativePlugin extends Plugin {

    @PluginMethod
    public void setImmersive(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).setImmersive(on);
            call.resolve();
        });
    }

    // Saves base64 image data to Pictures/The Feed through MediaStore (no permission needed on Android 10+).
    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name", "thefeed-" + System.currentTimeMillis());
        String mime = call.getString("mime", "image/png");
        if (data == null) { call.reject("no image data"); return; }
        if (Build.VERSION.SDK_INT < 29) { call.reject("Saving to the gallery needs Android 10 or newer"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Images.Media.MIME_TYPE, mime);
            v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/The Feed");
            v.put(MediaStore.Images.Media.IS_PENDING, 1);
            ContentResolver r = getContext().getContentResolver();
            Uri uri = r.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) { call.reject("could not create the image"); return; }
            try (OutputStream os = r.openOutputStream(uri)) { os.write(bytes); }
            v.clear();
            v.put(MediaStore.Images.Media.IS_PENDING, 0);
            r.update(uri, v, null, null);
            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage());
        }
    }
}
