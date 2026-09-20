# Kokoro / PocketTTS ONNX runtime and JNI bindings must not be renamed or stripped.
-keep class com.k2fsa.sherpa.onnx.** { *; }

# kotlinx.serialization models used for Claude API request/response bodies.
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class com.smr.storiesmadereal.data.claude.**$$serializer { *; }
-keepclassmembers class com.smr.storiesmadereal.data.claude.** {
    *** Companion;
}
-keepclasseswithmembers class com.smr.storiesmadereal.data.claude.** {
    kotlinx.serialization.KSerializer serializer(...);
}
