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

## Project layout

- **Assets/Scripts/Config** – `GameConfig` (API URL, OSRM, world scale).
- **Assets/Scripts/API** – `ApiClient`, DTOs (Character, Item, Inventory, Ability) for PostgREST.
- **Assets/Scripts/Services** – `LocationService` (GPS / mock), `OsrmService` (road routes).
- **Assets/Scripts/World** – `WorldOrigin` (lat/lng ↔ world XZ).
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
