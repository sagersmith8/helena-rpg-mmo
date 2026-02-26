# Helerion setup: OSM map, player, Mixamo animations

## Pink materials (URP vs Built-in)

This project uses **Universal Render Pipeline (URP)**. The Mega Fantasy Props Pack and NatureStarterKit2 assets use the **Built-in** Standard shader, so their materials show up **bright pink** until they are converted.

**Fix (one-time):**

1. In the Project window, go to **Assets/Mega Fantasy Props Pack** and **Assets/NatureStarterKit2** (or use **Tools → Select Asset Pack Materials** to select all their materials).
2. In the menu: **Edit → Rendering → Materials → Convert Selected Built-in Materials to URP** (or **Convert All Built-in Materials to URP** to convert the whole project).
3. Reimport or refresh if thumbnails stay pink; the scene view should update.

**Alternative:** **Window → Rendering → Render Pipeline Converter** → choose "Built-in to URP", enable **Material Upgrade**, then **Initialize and Convert**.

---

## 1. Add the OSM map to the scene

1. In the Hierarchy: **Right‑click → Create Empty**. Name it `Map`.
2. With `Map` selected, **Add Component → OSM Map Display** (script).
3. Set **Center Latitude** and **Center Longitude** to your play area (e.g. your city).
4. Set **Zoom Level** (16 is good for streets).
5. Press Play. The script will download tiles and create a child plane with the map.

**Note:** The default tile server is OpenStreetMap. Use their tiles responsibly (cache, User-Agent, and attribution — see OSM tile usage policy).

---

## 2. Add your Mixamo character (Paladin) to the scene

1. In the Project window go to **Assets → Characters**.
2. Drag **Paladin** into the Hierarchy (onto the scene root, not under Map).
3. Position the Paladin at (0, 0, 0) for now; the Player Controller (with joystick) will move it.

---

## 3. Set up the Animator (Idle and Walking)

Your **PlayerAnimator** controller is still empty. Wire it to your Mixamo clips:

1. **Open the Animator window:** **Window → Animation → Animator**.
2. In the Project window go to **Assets → Characters → Animations**.
3. Select **PlayerAnimator** (the controller). In the Animator window you should see an empty graph.
4. **Add a parameter:** In the Animator window, left side, click **+ → Float**. Name it **Speed**.
5. **Add Idle state:** Drag **Idle** from the Project (from `Characters/Animations/`) into the Animator graph. It becomes the first state (orange = default).
6. **Add Walking state:** Drag **Walking** into the graph.
7. **Transitions:**  
   - Right‑click **Idle → Make Transition** → click **Walking**.  
   - Right‑click **Walking → Make Transition** → click **Idle**.
8. **Conditions:**  
   - Click the **Idle → Walking** transition. In the Inspector, under **Conditions** click **+** and choose **Speed**, set **Greater** than **0.1**.  
   - Click the **Walking → Idle** transition. Add condition **Speed**, **Less** than **0.1**.
9. **Assign the controller to the character:**  
   - Select **Paladin** in the Hierarchy.  
   - In the Inspector find the **Animator** component.  
   - Set **Controller** to **PlayerAnimator** (drag it from `Assets/Characters/Animations/`).

Now when the **Player Controller** script sets **Speed** (from movement), the character will switch between Idle and Walking.

---

## 4. Hook up player movement

1. Select **Paladin** in the Hierarchy.
2. **Add Component → Player Controller** (script).
3. Optionally drag the **Map** GameObject (with **OSM Map Display**) into **Map Display** so the character follows terrain height; leave empty to keep a fixed Y.
4. Set **Move Speed** (e.g. `8`) and **Height Offset** if the character is sinking (e.g. `1` or `1.5`).
5. Add the **Mobile Control UI** (see section 7) so the virtual joystick appears; the character moves with the joystick.

---

## 5. Optional: Terrain, OSM 3D (roads, buildings, water), and overlay

To add elevation from DEM data, 3D roads/buildings/water from OSM, and drape the OSM map texture on the terrain:

1. On the **Map** GameObject, add these components (order doesn’t matter):
   - **DEM Terrain Builder** – fetches elevation (Open-Elevation by default) and builds a Terrain aligned with the map. Optionally set **Terrain Height Scale** and **Heightmap Resolution**.
   - **OSM Overpass Client** – fetches OSM vector data (roads, buildings, water) for the map bbox. Uses the public Overpass API.
   - **OSM 3D Builder** – builds 3D meshes from that data (road strips, extruded buildings, flat water) and optionally samples terrain height. Set **Build Delay Seconds** so the map and terrain load first (e.g. 5).

2. **Flow:** On Play, the map loads tiles, the terrain builder requests elevation and creates the Terrain, then the OSM texture is applied to the terrain and the flat map plane is hidden. After the delay, the Overpass client fetches ways and the 3D builder creates road, building, and water meshes.

3. **Toggle OSM texture:** In **DEM Terrain Builder**, **Show OSM Texture** (default on) switches between the OSM map texture and a plain gray terrain. Toggle the checkbox in the Inspector at runtime, or call `SetShowOSMTexture(bool)` from another script/UI. The terrain uses a **Lit** shader (URP Lit when available) so it receives the Flying Beast's light; you don't need to assign a texture—the script creates both materials.

4. **Height:** The **Player Controller** uses the map’s **SampleHeightAtWorld** when **Map Display** is assigned, so the character follows the terrain. You can keep a small **Height Offset** to avoid clipping.

5. **Materials:** Leave Road/Building/Water materials unassigned to use built-in gray/tan/blue; or assign custom materials in **OSM 3D Builder**. For a more realistic look, assign **Road Material** from the Mega Fantasy Props Pack (e.g. cobblestone or dirt materials from `Assets/Mega Fantasy Props Pack/Materials/`).

6. **Attribution:** OSM data (Overpass) and raster tiles require OpenStreetMap attribution. USGS 3DEP (if you switch the elevation source) is public domain; Open-Elevation is a free service.

### Tuning terrain and buildings

If the terrain looks almost flat or buildings are hard to see, use these as a starting point:

| Component | Setting | Recommended | Why |
|-----------|---------|-------------|-----|
| **DEM Terrain Builder** | **Elevation Grid Size** | **33–65** | Number of elevation samples per side. 8 gives only 64 points for the whole map, so the terrain is very smooth. 33 or higher gives real contour detail (more API points, slightly slower). |
| **DEM Terrain Builder** | **Terrain Height Scale** | **50–150** | Vertical scale in Unity units. 5 makes real-world hills barely visible. 50–100 makes contours clearly visible. |
| **DEM Terrain Builder** | **Heightmap Resolution** | 257–513 | How smooth the terrain mesh is. 513 is fine; 257 is faster. |
| **OSM 3D Builder** | **Minimum Building Height** | **8–15** | Many OSM buildings have `building:levels=1`, so they would be 1 × Meters Per Level (e.g. 3 m). This forces every building to be at least this tall so they’re visible. |
| **OSM 3D Builder** | **Meters Per Level** | 3–5 | Height per OSM level. Raise to 4–5 so multi-level buildings stand out. |
| **OSM 3D Builder** | **Default Building Height** | 6–10 | Only used when OSM has no level/height tag. |
| **OSM 3D Builder** | **Build Delay Seconds** | 5–8 | Give the map and terrain time to load before fetching Overpass and building meshes. |

**Example for strong relief and visible buildings:**  
DEM: Elevation Grid Size **33**, Terrain Height Scale **80**, Heightmap Resolution **257**.  
OSM 3D: Minimum Building Height **10**, Meters Per Level **4**, Build Delay **5**.

### Asset-pack decoration (houses, scatter, nature)

OSM 3D Builder can use prefabs from **Mega Fantasy Props Pack** and **NatureStarterKit2** instead of plain cubes and empty terrain:

- **Building prefabs:** In OSM 3D Builder, enable **Use House Prefabs** and assign **House Prefabs** (e.g. `Mega Fantasy Props Pack/Prefabs/Houses/House.001`, `house.002`, `house.003`). Adjust **House Reference Size** if scaling looks wrong.
- **Road material:** Assign **Road Material** to a material from the Mega Fantasy Props Pack (e.g. cobblestone) for a more realistic road look.
- **Roadside / building scatter:** Assign **Road Side Decor Prefabs** (e.g. barrels, boxes, fences) and **Building Scatter Prefabs**; placement is deterministic from **Decoration Seed** (or **Seed From Map Center**).
- **Trees and bushes:** Assign **Tree Prefabs** and **Bush Prefabs** from NatureStarterKit2 (e.g. `NatureStarterKit2/Nature/tree01`–`tree04`, `bush01`–`bush06`). Tune **Nature Grid Step**, **Tree Probability**, and **Bush Probability** as needed.

---

## 6. Optional: camera follow

To have the camera follow the player:

1. Create a short script that in `LateUpdate()` sets the camera’s position to the player’s position + offset (e.g. behind and above), or use **Cinemachine** (Package Manager) and a Follow target set to the Paladin.

---

## 7. Mobile controls (joystick and ability buttons)

For a mobile-friendly layout in landscape: virtual joystick (bottom-left) and ability buttons (bottom-right).

1. **Create the mobile HUD:** In the Hierarchy, **Right-click → Create Empty**. Name it `MobileControls`.
2. **Add component:** **Add Component → Mobile Control UI** (script).
3. Ensure **Paladin** has **Player Controller** (section 4). Press Play; the script creates a Canvas at runtime with:
   - **Joystick** – bottom-left; drag to move the character.
   - **A1, A2, A3, ULT** – bottom-right; hook up your ability logic by reading `MobileInputProvider.Instance.Ability1Down`, `Ability2Down`, etc., or `Ability1Held` for held state.

**Reading input in your scripts:**

- `MobileInputProvider.Instance.MoveInput` – Vector2 from the joystick (-1..1).
- `MobileInputProvider.Instance.Ability1Down` / `Ability2Down` / `Ability3Down` / `UltimateDown` – true the frame the button is pressed.
- `MobileInputProvider.Instance.Ability1Held` (etc.) – true while the button is held.

**Layout:** The Canvas uses **Scale With Screen Size** (reference 1920×1080, match 0.5). Adjust **Joystick Margin X/Y**, **Button Margin X/Y**, **Button Size**, and **Button Spacing** on **Mobile Control UI** to tweak positions.

---

## 8. Building for mobile

- Configure **Edit → Project Settings → Player** for your target platform (Android/iOS).
- If you add location-based features later, enable the **Location** permission and usage description in Player settings.

---

## Quick checklist (base setup)

- [ ] Scene has a **Map** GameObject with **OSM Map Display**.
- [ ] **Paladin** is in the scene.
- [ ] **PlayerAnimator** has **Speed** (float), **Idle** and **Walking** states, and transitions with Speed &gt; 0.1 / &lt; 0.1.
- [ ] Paladin’s **Animator** component uses **PlayerAnimator** controller.
- [ ] Paladin has **Player Controller** (optionally with **Map Display** for terrain height).
- [ ] **Mobile controls:** Add **Mobile Control UI** to an empty GameObject for the virtual joystick and ability buttons.

If you add **Punch** or **Hit** later, add new states and trigger them with an Animator **Trigger** or **Bool** parameter from your game logic.

---

## 9. Second character (flying, GPS-driven, lights the world)

This character flies above the map and is driven by your **GPS location**. Its “magic” is the main light source; the rest of the world is kept mostly dark.

### 9.1 Make the world mostly dark

So that the flying character’s light is what “lights up” the world:

1. In the Hierarchy: **Right‑click → Create Empty**. Name it e.g. **Lighting** (or use **Map**).
2. **Add Component → Dark World Lighting** (script).
3. Leave defaults, or tune: **Directional Light Intensity** (0.1 = dim sun; 0 = off), **Ambient Intensity** (0.12), **Ambient Color**. Set **Flying Character Name** to **Flying Beast** so the script ensures it has a visible Point Light (min range 50, intensity 2.5) when Play is pressed.

On Play, the script dims the sun and ambient so the ground is dark and the Flying Beast's light is visible.

**Alternative (editor-only):** **Window → Rendering → Lighting** → **Environment** tab: set **Source** to **Color** and a dark **Ambient Color**, and lower **Ambient Intensity**. Then select **Directional Light** and reduce **Intensity** to 0.1–0.2 or disable it. The runtime script is recommended so it works regardless of Lighting window settings.

### 9.2 Add the flying character GameObject

1. In the Hierarchy: **Right‑click → Create Empty**. Name it **FlyingCharacter** (or e.g. **GPSLightCharacter**).
2. Position it at **(0, 10, 0)** or so for now (above the ground). A script will later set position from GPS; the Y can stay fixed at a “flying height” (e.g. 10–20 units).
3. **Optional (visual):** Add a child **3D Object → Sphere** (or a simple model), scale it down, and give it a glowing material so you can see where the character is. The planner can replace this with a proper flying character model/animations.

### 9.3 Add the “magic” light to the flying character

1. With **FlyingCharacter** selected: **Add Component → Light**.
2. Set **Mode** to **Realtime** (so it moves with the object each frame).
3. **Type**: **Point** (light spreads around the character) or **Spot** (cone downward). Point is simplest for “magic glow.”
4. **Range**: e.g. **40–80** (Unity units). Tune so it lights a nice area around your GPS position.
5. **Intensity**: e.g. **1–3** (or higher if the world is very dark).
6. **Color**: pick a magic feel (e.g. soft white, pale blue, or warm gold).
7. **Cast Shadows**: **On** if you want the character to cast shadows; **Off** if you prefer a soft glow only.

This Light component will move with **FlyingCharacter** when its position is updated from GPS.

### 9.4 Hook up GPS (Flying Beast)

1. Select your flying character GameObject (e.g. **Flying Beast**) in the Hierarchy.
2. **Add Component → GPS Flying Controller** (script).
3. Optionally assign **Map Display** to the Map GameObject (the one with **OSM Map Display**). Leave empty to auto-find.
4. Set **Flying Height** (world Y, e.g. 15). Tweak **Update Interval Seconds** (e.g. 0.5) to throttle GPS updates and reduce jitter; 0 = every frame.
5. **Permissions:** For mobile, **Edit → Project Settings → Player** must enable **Location** and set the usage description (e.g. “Used to show your position in the world”). This is mentioned in section 8.

On Play, the script starts the location service and moves the Flying Beast to your GPS position on the map. In the Editor, location may not be available; the script skips updates when the service is not running.

### 9.5 Quick checklist (flying GPS character)

- [ ] **Dark World Lighting** component on an empty GameObject (or Map); **Flying Character Name** = **Flying Beast** so the magic light is ensured at runtime.
- [ ] **Flying Beast** (or FlyingCharacter) empty GameObject (or with placeholder visual) at a flying height (e.g. Y = 10–20).
- [ ] **Light** on the flying character (added automatically if missing when Dark World Lighting runs; otherwise add Point Light, Range 50+, Intensity 2+).
- [ ] **GPS Flying Controller** script on the flying character; assign **Map Display** or leave empty to auto-find.
- [ ] **Map** (with **OSM Map Display**) exists in the scene.
- [ ] Location permission and usage description set in Player settings for mobile builds.

---

## 10. Inventory and equipment

Expandable character inventory with equipment slots (helmet, chest, gloves, bracers, boots, rings, amulet, main hand, off hand, ranged, 3 abilities), stackable consumables, and sortable/comparable items. No weight.

### 10.1 Add inventory to the player

1. Select **Paladin** (or your player) in the Hierarchy.
2. **Add Component → Character Stats** (script). Set **Max Health** and **Current Health** as desired.
3. **Add Component → Character Inventory** (script). Optionally set **Initial Capacity** (default 20) and **Capacity Increment** (default 10).
4. **Add Component → Ability Slot Trigger** (script). This wires the 3 ability equipment slots to A1/A2/A3; subscribe to `OnAbilityTriggered` for your ability logic.

### 10.2 Inventory UI and toggle

1. **Create an empty GameObject** (e.g. `InventoryUI`). **Add Component → Inventory Panel UI** (script). Leave **Inventory** empty to auto-find **Character Inventory** in the scene.
2. **Add Component → Inventory Toggle Button** (script) on the same object (or on **MobileControls**) to get an **Inv** button on the HUD. Press **I** (keyboard) or tap **Inv** to open/close the panel.
3. In the panel: use **Sort** (Name, Type, Armor, Damage), tap a slot to **Equip** / **Use** (consumable) / **Split** (stack), tap equipment to **Unequip**.

### 10.3 Create sample items

1. In the menu: **Helerion → Create Sample Inventory Assets**. This creates **Health Potion**, **Iron Helmet**, **Wooden Sword**, and **Fireball** ability in `Assets/Data/Items/`.
2. To give the player test items at runtime: from a script, get `CharacterInventory` and call `AddItem(definition, count)` with references to those ScriptableObjects.

### 10.4 New item types

- **Equipment:** **Assets → Create → Helerion → Equipment Item**. Set **Slot** (Helmet, MainHand, etc.) and **Stats** (e.g. Armor, Damage).
- **Consumable:** **Assets → Create → Helerion → Consumable Item**. Set **Max Stack Size** (e.g. 99) and **Effects** (e.g. Health +50).
- **Ability:** **Assets → Create → Helerion → Ability Item**. Set **Ability Id** for your ability logic; slot into Ability0/1/2 to trigger from A1/A2/A3.
