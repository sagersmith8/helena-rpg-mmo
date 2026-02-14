# Helerion – Step-by-step setup (first time in Unity)

This guide assumes you’ve never used Unity before. Do the steps in order.

---

## Part 1: Game Config

The game needs a **Game Config** asset so it knows your backend URL.

1. In Unity, look at the **Project** window (usually at the bottom). It shows folders like `Assets`, `Packages`.
2. In the Project window, **right‑click** on the `Assets` folder (or inside it).
3. In the menu, click **Create → Helerion → Game Config**.
   - If you don’t see **Helerion**, the scripts may still be compiling. Wait a few seconds and try again, or make sure the project opened without errors.
4. A new asset appears (e.g. “GameConfig”). **Click it** once.
5. In the **Inspector** (right side), you’ll see:
   - **Api Base Url** – set this to your backend, e.g. `http://localhost:3000` (same as Helena).
   - You can leave OSRM and World as they are for now.
6. **Rename** the asset to `GameConfig` if you like (slow double‑click on the name in the Project window).

You’ll assign this asset to the GameManager in the scene in Part 2.

---

## Part 2: Main scene and objects

We’ll build the minimum scene so you can press Play.

### 2.1 New scene

1. **File → New Scene**.
2. Choose **Basic (Built-in)** or **Basic 3D** (depending on your Unity version). Leave the default lighting/camera.

### 2.2 GameManager

1. In the **Hierarchy** (left), **right‑click** → **Create Empty**. A “GameObject” appears.
2. Click it and rename it to **GameManager** (press Enter or click elsewhere).
3. With GameManager selected, in the **Inspector** click **Add Component**.
4. Search for **Game Manager** (our script). Click **Game Manager (Script)** to add it.
5. In the same Inspector, find the **Game Config** field (under “Dependencies”). Drag your **GameConfig** asset from the Project window into that slot. If you don’t assign it, the game will still run but use default URLs.

### 2.3 WorldOrigin

1. Hierarchy → **right‑click** → **Create Empty**. Rename to **WorldOrigin**.
2. **Add Component** → search **World Origin** → add **World Origin (Script)**.
3. In the Inspector you can leave **Origin Latitude / Longitude** as default (or set them for a fixed test location).

### 2.4 CombatManager

1. Hierarchy → **right‑click** → **Create Empty**. Rename to **CombatManager**.
2. **Add Component** → search **Combat Manager** → add **Combat Manager (Script)**.

### 2.5 Player (simple: a Capsule)

We’ll use a **Capsule** first so you can test without Mixamo. You can replace it with a Mixamo character later.

1. Hierarchy → **right‑click** → **3D Object → Capsule**. Rename it to **Player**.
2. With **Player** selected:
   - **Add Component** → **Player Controller (Script)**.
   - **Add Component** → **Character Animator (Script)**.
   - **Add Component** → **Health (Script)**. In the Inspector set **Current** and **Max** to 10 (or any number).
3. **Tag**: at the top of the Inspector, find **Tag** (it may say “Untagged”). Click it and choose **Player**. (If “Player” doesn’t exist, leave Untagged for now; the spawner will still work, but the enemy won’t chase this object.)
4. **Assign WorldOrigin to GameManager**: Select **GameManager** in the Hierarchy. In the Inspector, find **World Origin**. Drag the **WorldOrigin** object from the Hierarchy into that slot.

### 2.6 Enemy prefab

1. Hierarchy → **right‑click** → **3D Object → Capsule**. Rename to **Enemy**.
2. With **Enemy** selected:
   - **Add Component** → **Enemy Controller (Script)**.
   - **Add Component** → **Character Animator (Script)**.
   - **Add Component** → **Health (Script)**. Set **Current** and **Max** to 10.
3. Turn this into a **prefab**: in the Project window, create a folder **Prefabs** (right‑click in Assets → Create → Folder). Then **drag the Enemy** from the Hierarchy **into** the Prefabs folder. Unity will ask “Create prefab?” – choose **Original Prefab**. You now have an “Enemy” prefab in the Project.
4. **Delete the Enemy** from the Hierarchy (right‑click → Delete). The spawner will create enemies from the prefab at runtime.

### 2.7 EnemySpawner

1. Hierarchy → **right‑click** → **Create Empty**. Rename to **EnemySpawner**.
2. **Add Component** → **Enemy Spawner (Script)**.
3. In the Inspector, find **Enemy Prefab**. Drag the **Enemy** prefab from the Project (from the Prefabs folder) into that slot.

### 2.8 Save the scene

1. **File → Save As**. Save into `Assets/Scenes/` as **Main** (Unity will add the `.unity` extension).
2. **File → Build Settings**. Click **Add Open Scenes** so **Main** is in the build list.

---

## Part 3: Press Play

1. Make sure your **backend** is running (same as Helena – Postgres + PostgREST on e.g. `http://localhost:3000`).
2. In Unity, press **Play** (top centre).
3. The game runs with a **Capsule** as the player. Location is mocked in the Editor (no real GPS), so the player may not move much unless you change the mock position in code or WorldOrigin. Enemies should spawn and move along road paths.

You can stop here and explore. The rest is optional: adding a real 3D character and animations from Mixamo.

---

## Part 4: Mixamo (optional – 3D character and animations)

Mixamo gives you free **rigged characters** and **animations**. You only need a few.

### 4.1 What to download from Mixamo

1. Go to [mixamo.com](https://www.mixamo.com). Sign in (free Adobe account).
2. **Characters** tab: pick **one** character you like (e.g. “Knight”, “Y Bot”). Click **Download**. Choose **FBX for Unity (.fbx)**. Download. You’ll get one file, e.g. `Knight.fbx`.
3. **Animations** tab: search and download these as **FBX for Unity** (same format):
   - **Idle** – e.g. “Idle” or “Standing Idle”.
   - **Walking** – e.g. “Walking” or “Walking Forward”.
   - **Attack** – e.g. “Punching” or “Kicking” or “Sword Slash” (one short attack).
   - **Hit** – e.g. “Hit Reaction” or “Getting Hit” (character flinches).

You’ll end up with **1 character FBX** and **4 animation FBXs**.

### 4.2 Import into Unity

1. In Unity’s **Project** window, create a folder: **Assets/Art/Mixamo** (or any name).
2. Drag your **character FBX** (e.g. `Knight.fbx`) and the **4 animation FBXs** from your computer into that folder. Unity will import them.
3. Click the **character** FBX in the Project. In the **Inspector**, open **Rig**. Set **Animation Type** to **Humanoid**, then **Apply**. (This lets the same animations work on different humanoid characters.)
4. For **each animation FBX**: select it → Inspector → **Rig** tab. Set **Animation Type** to **Humanoid** and **Apply**. Then open the **Animation** tab (or **Import**); you can leave the rest as default and **Apply**.

### 4.3 Use the character as the Player

1. Drag the **character** FBX (e.g. Knight) from the Project **into the Hierarchy**. Rename it to **Player** (you can remove or disable the old Capsule Player, or rename the Capsule to “PlayerOld” and add the Knight as a child for now – simplest is: delete the old Player Capsule and put the Knight in its place, at position 0,0,0).
2. With the **Player** (Knight) selected in the Hierarchy:
   - **Add Component** → **Player Controller (Script)**.
   - **Add Component** → **Character Animator (Script)**.
   - **Add Component** → **Health (Script)**.
   - Set **Tag** to **Player**.
3. The Knight usually has an **Animator** component already. If not, **Add Component → Animator**. We’ll assign an Animator Controller to it next.

### 4.4 Animator Controller (which animation plays when)

1. In the Project window, **right‑click** (e.g. in `Assets/Art/Mixamo`) → **Create → Animator Controller**. Name it **PlayerAnimator**.
2. **Double‑click** **PlayerAnimator**. The **Animator** window opens (usually a tab with a grid and boxes).
3. **Drag your 4 animation clips** from the Project into the Animator:
   - Drag **Idle** → it becomes a state (orange = default).
   - Drag **Walking**.
   - Drag **Attack** (e.g. Punching).
   - Drag **Hit** (e.g. Hit Reaction).
4. **Parameters** (left of the Animator): click the **+** and add:
   - **Bool** named **Move**.
   - **Trigger** named **Attack**.
   - **Trigger** named **Hit**.
5. **Transitions** (right‑click a state → Make Transition):
   - **Idle → Walking**: click the transition arrow, in Inspector uncheck “Has Exit Time”, under **Conditions** add **Move** = true. Add another transition **Walking → Idle** with **Move** = false.
   - **Idle → Attack**: Add Condition **Attack** (trigger). Transition time can be short (e.g. 0.1s), and check **Has Exit Time** so it goes back to Idle after the attack plays.
   - **Idle → Hit**: Add Condition **Hit** (trigger). Same idea – after hit, return to Idle.
6. Assign the controller to the Player: select **Player** in the Hierarchy, find the **Animator** component, and in the **Controller** slot drag **PlayerAnimator**.

### 4.5 Hook up Character Animator script

1. With **Player** selected, find the **Character Animator (Script)** component.
2. There’s an **Animator** slot. If it’s empty, drag the **same** Player object into it (or the Animator component is on the same GameObject, so it can find it automatically in code – our script uses `GetComponent<Animator>()` if the slot is empty, so it should already work).

You’re done. Press **Play** again: the Knight should play Idle, and when the game sets “Move” to true (from movement), it should play Walking. Attack and Hit will play when combat triggers them.

### 4.6 Enemy with Mixamo (optional)

Same idea: pick a different Mixamo character (e.g. “Zombie”), download it and Idle/Walk/Attack/Hit. Import, create an **EnemyAnimator** controller with the same parameters (Move, Attack, Hit). Replace the **Enemy** prefab’s Capsule with that character and assign the Enemy Animator controller and **Character Animator (Script)**. The code already uses the same parameter names.

---

## Part 5: Testing on your phone

Your phone can’t use `localhost` – it needs to reach your backend over the network. Then build the app and run it on the device.

### 5.1 Point the game at a URL your phone can reach

1. **If the backend is on your computer** (e.g. PostgREST on your Mac):
   - Find your computer’s **local IP**: Mac → System Settings → Network → Wi‑Fi → Details (or run `ipconfig getifaddr en0` in Terminal). It’s usually like `192.168.1.5`.
   - Your phone and computer must be on the **same Wi‑Fi**.
   - In Unity: select your **GameConfig** asset → in the Inspector set **Api Base Url** to `http://192.168.1.5:3000` (use your IP, keep the port, e.g. `:3000`).
2. **If you use a hosted backend** (e.g. Supabase): set **Api Base Url** to your project’s REST URL (e.g. `https://xxxx.supabase.co/rest/v1` or whatever your backend expects).

Save the scene and the project before building.

### 5.2 Android

1. **Install Android Build Support** (if you haven’t): Unity Hub → **Installs** → click the **⋮** next to your Unity version → **Add Modules** → check **Android Build Support** (and **Android SDK & NDK Tools** if offered) → Done.
2. In Unity: **File → Build Settings**.
3. In the **Platform** list, select **Android**. Click **Switch Platform** and wait for it to finish.
4. (Optional) Click **Player Settings** and set **Company Name** and **Product Name** (e.g. “Helerion”). Under **Other Settings** you can set **Package Name** (e.g. `com.yourname.helerion`).
5. Connect your Android phone with a **USB cable**. On the phone: **Settings → Developer options** → turn on **USB debugging** (if you don’t see Developer options, search your phone’s help for “enable developer options”).
6. In Build Settings, click **Build And Run**. Choose a folder and a name (e.g. `Helerion.apk`). Unity will build and then install and launch the app on the phone.
7. On the phone, **allow location** when the app asks. The game will use your real location and the backend URL you set in GameConfig.

### 5.3 iOS

1. **Install iOS Build Support**: Unity Hub → Installs → Add Modules → **iOS Build Support**.
2. You need a **Mac** with **Xcode** installed (from the Mac App Store).
3. In Unity: **File → Build Settings** → select **iOS** → **Switch Platform**.
4. (Optional) **Player Settings** → set **Company Name**, **Product Name**, and under **Other Settings** set **Bundle Identifier** (e.g. `com.yourname.helerion`).
5. Click **Build** (not Build And Run). Choose a folder; Unity will create an **Xcode project** there.
6. **Open the generated Xcode project**: open the `.xcworkspace` file in that folder (not the `.xcodeproj`).
7. In Xcode: select the **Unity-iPhone** project in the left sidebar → **Signing & Capabilities** → choose your **Team** (Apple ID). Connect your iPhone and pick it as the run target, then press **Run** (▶). Xcode will build and install on the device.
8. On the iPhone: **Settings → General → VPN & Device Management** → trust your developer certificate if prompted. Allow **location** when Helerion asks.

### 5.4 Quick checklist

- [ ] GameConfig **Api Base Url** is something the phone can reach (your computer’s IP + port, or a hosted URL).
- [ ] Backend is running and phone is on the same Wi‑Fi (if using local backend).
- [ ] **Main** scene is in **Build Settings** (Scenes In Build list).
- [ ] On device you allowed **location** for the app.

---

## Troubleshooting

- **“Game Config” doesn’t appear under Create → Helerion**  
  Wait for scripts to compile (no red errors in the Console). If it still doesn’t appear, check that `Assets/Scripts/Config/GameConfig.cs` exists and has the line `[CreateAssetMenu(...)]`.

- **Player or enemy doesn’t move**  
  In the Editor there’s no real GPS. The player position is driven by mock location. You can change mock lat/lng in `GpsLocationService` (see script) or set **WorldOrigin**’s origin and move the player in the scene for testing.

- **Enemies don’t spawn**  
  Check that **EnemySpawner** has the **Enemy** prefab assigned, and that **GameManager** has a **World Origin** assigned. The spawner also needs **GameManager.Instance.HasCharacter** – so you need to have created a character (via the Helena app or API) and have its ID saved, or the game won’t spawn enemies. For a quick test you can temporarily give the game a fake character ID in code if you’re not using the backend yet.

- **Animations don’t play**  
  Make sure the Animator Controller has **parameters** named exactly **Move** (bool), **Attack** (trigger), **Hit** (trigger). Our **CharacterAnimator** script uses those names.

- **App on phone doesn’t load / “can’t connect”**  
  The phone must reach **Api Base Url**. Use your computer’s IP (e.g. `http://192.168.1.5:3000`), not `localhost`. Ensure phone and computer are on the same Wi‑Fi, and that your backend is listening on `0.0.0.0` (not just `127.0.0.1`) so it accepts connections from the network. On Mac, allow the app (e.g. Docker or your server) in **System Settings → Network → Firewall** if you use one.
