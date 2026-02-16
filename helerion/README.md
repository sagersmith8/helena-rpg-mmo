# Helerion

3D location-based RPG using the same backend as **Helena** (PostgREST / Supabase). Real-world position, OSRM road paths for enemies, combat, and inventory.

**Runs on macOS** (and Windows): Unity Editor and builds for iOS/Android.

---

**First time in Unity?** Use **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for step-by-step instructions: Game Config, scene setup, and optional Mixamo character/animations.

---

## Quick start (Mac)

1. **Install Unity**
   - [Unity Hub](https://unity.com/download) → install **Unity 2022.3 LTS** (or newer).
   - Add modules: **iOS Build Support**, **Android Build Support** if you want device builds.

2. **Open the project**
   - In Unity Hub: **Add** → select the `helerion` folder (this repo).
   - Open the project. Let Unity import and compile.

3. **Create a GameConfig asset**
   - Right-click in Project → Create → **Helerion** (you may need to create a folder and assign the script first).
   - Actually: add a **Config** subfolder under Assets, then Create → **Helerion > Game Config** (if the menu appears from `GameConfig` script).
   - Or: create an empty ScriptableObject and assign the `GameConfig` script; name it `GameConfig`.
   - Set **Api Base Url** to your backend (e.g. `http://localhost:3000` or your Supabase REST URL).

4. **First scene**
   - New Scene (File → New Scene → Basic 3D).
   - Add empty GameObject → name **GameManager** → add script **GameManager**.
   - Add empty GameObject → name **WorldOrigin** → add script **WorldOrigin** (set origin lat/lng for testing if you like).
   - Add empty GameObject → name **CombatManager** → add script **CombatManager**.
   - Create a **Player**: e.g. Capsule or your 3D character. Add **PlayerController**, **CharacterAnimator**, **Health**. Tag it **Player**.
   - Create an **Enemy** prefab: e.g. Capsule, add **EnemyController**, **Health**, **CharacterAnimator**. Save as prefab.
   - Add empty GameObject → name **EnemySpawner** → add **EnemySpawner**; assign the enemy prefab.
   - Assign **WorldOrigin** on GameManager if needed.
   - Save scene as **Main** in `Assets/Scenes/Main.unity`.

5. **Backend**
   - Use the same Postgres + PostgREST (or Supabase) as Helena. Same schema (`init.sql` in the parent repo).
   - Run the backend; set `apiBaseUrl` in GameConfig to match.

6. **Play**
   - Press Play. In Editor, location is mocked (edit `LocationService` or WorldOrigin origin for a fixed spot). On device, enable location and run a build.

---

## 3D characters and animations

- **Character model**: Use any humanoid 3D model (e.g. [Mixamo](https://www.mixamo.com) – free rigged characters and animations).
- **Animator**:
  - Create an **Animator Controller** (Right-click → Create → Animator Controller).
  - Add states: **Idle**, **Walk**, **Attack**, **Hit** (and **Death** if you like).
  - Add transitions (e.g. Idle ↔ Walk on bool `Move`, Attack/Hit on triggers).
  - In **CharacterAnimator**, the script uses:
    - **Move** (bool) – set true when moving.
    - **Attack** (trigger) – when performing melee attack.
    - **Hit** (trigger) – when receiving damage.
  - Assign the controller to your character’s **Animator** and wire the same parameter names in the Animator window.
- **Enemy**: Same idea – use a different model, same Animator setup, and assign the Animator to **EnemyController**’s **CharacterAnimator** reference.

---

## Procedural map and 3D props

The map can use **procedural tiles** (terrain texture + optional 3D props). To add **trees and rocks** as actual models:

1. **Add the decorator**  
   On the same GameObject as **MapGround** (or a child), add the **Procedural Map Decorator** component.

2. **Get prefabs** (no code required – drag into the Inspector):
   - **Trees**: One or more low-poly tree prefabs. Examples: Unity Asset Store “Low Poly Trees”, “Polygon - Nature Pack”, or free “Nature Starter Kit”. Prefer **pivot at the base** so they sit on the ground.
   - **Rocks**: Low-poly rock or boulder prefabs. Examples: “Low Poly Rocks”, “Polygon - Rock”. Keep poly count low; the decorator places many instances.

3. **Assign in Inspector**  
   Set **Tree Prefab** and/or **Rock Prefab** on the Procedural Map Decorator. Leave one null if you only want trees or only rocks.

4. **Match MapGround**  
   Keep **Tile Zoom** and **Tiles Per Side** the same as on MapGround so props align with the painted terrain. **Placement Grid Res** (default 8) controls density; lower = fewer props.

Placement uses the same procedural noise as the tile texture, so 3D trees appear in forest areas and rocks on rocky terrain. Roads stay texture-only (no road meshes).

---

## Build checklist (device)

- **WorldOrigin** – The scene must contain a GameObject with the **WorldOrigin** script (so map tiles and decorations can run). MapGround and Procedural Map Decorator will use `WorldOrigin.Instance` or find it in the scene if not assigned.
- **Map tiles** – Default is **Procedural with OSM fallback**: the game tries to load real-world OSM tiles (roads) first; if the request fails (e.g. no network), it falls back to procedural terrain. For real roads you need network access on device.
- **Trees and rocks** – On the object that has **Procedural Map Decorator**, assign **Tree Prefab** and **Rock Prefab** in the Inspector. If either is left empty, nothing is placed. Prefabs must be in the project and referenced from the scene so they’re included in the build.
- **Spinning character** – If the character spins on device, keep **Rotate When Idle** off on **PlayerController**. The default **Min Rotate Angle Deg** (3°) avoids tiny rotations from GPS/compass jitter.
- **Camera and map rotation** – **Camera Follow** uses world-space offset by default (camera does not orbit with the character; only the character rotates). To let the player rotate the map with touch: create an empty **MapPivot**, make **MapGround** a child of it, add **Map Rotator** to MapPivot; then drag horizontally to spin the map.

---

## Project layout

- **Assets/Scripts/Config** – `GameConfig` (API URL, OSRM, world scale).
- **Assets/Scripts/API** – `ApiClient`, DTOs (Character, Item, Inventory, Ability) for PostgREST.
- **Assets/Scripts/Services** – `LocationService` (GPS / mock), `OsrmService` (road routes).
- **Assets/Scripts/World** – `WorldOrigin` (lat/lng ↔ world XZ), `MapGround`, `MapRotator`, `ProceduralMapDecorator`, `CameraFollow`.
- **Assets/Scripts/Game** – `GameManager` (load/save character, inventory, state).
- **Assets/Scripts/Character** – `PlayerController`, `CharacterAnimator`.
- **Assets/Scripts/Enemies** – `EnemyController`, `EnemySpawner`.
- **Assets/Scripts/Combat** – `Health`, `CombatManager`.

---

## Optional: GameConfig in scene

If you don’t use a ScriptableObject asset, ensure `GameConfig.Instance` is set: e.g. add an empty GameObject with a script that creates a runtime `GameConfig` or set `ApiClient` and `OsrmService` base URLs in code. The scripts fall back to `http://localhost:3000` and the public OSRM server if `GameConfig.Instance` is null.

---

## Building for iOS / Android

- **File → Build Settings** → switch platform to iOS or Android → **Add Open Scenes** (Main) → **Build** (or Build And Run).
- On device, allow location when prompted. The game uses the same backend as Helena; create a character in the app or via the API first if you need one.
