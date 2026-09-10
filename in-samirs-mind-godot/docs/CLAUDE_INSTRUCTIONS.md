# CLAUDE HANDOFF

Rebuild In Samir's Mind in Godot 4 with GDScript.

DO NOT:
- recreate the old Three.js runtime
- wrap the old game in Electron
- reuse the broken old menu/save state machine
- load every chapter at startup
- claim a target was tested unless it actually ran on that target

Required final outputs:
1. Windows EXE
2. Android local APK
3. iPhone/iPad Web/PWA build

Use the four supplied asset ZIPs as authoritative source material.

Start with the vertical slice and prove export/performance on all three targets before expanding.

In every progress report separate:
- implemented
- statically verified
- run/tested on Windows
- run/tested on Android
- run/tested on iPhone Safari/PWA
