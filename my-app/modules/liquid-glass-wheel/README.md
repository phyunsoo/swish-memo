# Native wheel ring

App-local iOS view that draws a simple translucent ring with a real hole.
The inner path has reversed winding so the fill respects the ring shape.

Requires a development build after native source changes. On iOS 26+, the view
fades in the ring without fading its UIKit ancestors and hides it immediately when closed.
The ring uses a flat white fill at 60% opacity in both color schemes, without Liquid Glass refraction or a drawn stroke.
Android/web continue using the app's existing fallback. `visible` controls the native view.

The `LiquidGlassWheel` native identifier and file paths are retained for compatibility
with existing development builds. The view does not render Liquid Glass.

The inner diameter is 58% of the outer diameter, matching the wheel hit regions.
