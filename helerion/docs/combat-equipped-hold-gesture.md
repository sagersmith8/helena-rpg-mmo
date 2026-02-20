# Combat: Equipped attacks + hold + gesture (plan addendum)

Replace **Section 3** in the main plan with this design.

---

## 3. Combat: equipped attacks + hold + gesture (any attack at any time)

**Design:** No cycling. Player has a set of **equipped** attacks (e.g. Left Melee, Right Melee, Left Kick, Right Kick, Bow). To use one: **hold** the corresponding button, then perform a **gesture**. Attacks are aimed with the camera/crosshair. **Swipe speed** (and for bow, **pull-back then release**) determines power. This is not "tap enemy"—you aim, then commit with a gesture.

**Feasibility (not too ambitious if phased):**
- Equipped slots + hold button: straightforward (UI buttons, track which is held).
- Gesture recognizer: track pointer/touch from pointer-down to pointer-up; compute swipe direction, distance, and speed (or for bow: pull distance/duration). Use a minimum swipe distance (or time) so camera-drag doesn't accidentally trigger attacks.
- Aim-directed melee: ray from camera through crosshair gives aim direction; left/right comes from which button is held (Left Melee vs Right Melee). Melee can use a short-range check or cone in front of the player; play left/right punch/kick animation accordingly. With only one Punch clip today, mirror or use one animation and add left/right variants when you have more clips.
- Swipe speed = power: compute velocity (delta over gesture) or peak speed; normalize to 0–1 for animation blend or damage scale.
- Bow: pointer down = start pull; track pull distance (e.g. drag "back" from center) or hold duration; pointer up = release arrow with that power. Reuse the same gesture pipeline with a "pull" mode instead of "swipe."

**Implementation outline:**

- **Aim:** Ray from camera through screen center (or crosshair UI position). Store world direction and optional hit point for melee/range. Crosshair = small fixed UI element (RPG-style) so "aim" = where you're looking.
- **Equipped-attack UI:** One button per equipped attack (e.g. 4–5: Left Melee, Right Melee, Left Kick, Right Kick, Bow). Buttons on-screen for mobile; on desktop, same or keys. "Hold" = pointer/touch down on that button (or key held). While holding, pointer movement is the **gesture**. **Gesture vs camera:** Only treat movement as a gesture when the pointer *started* on an attack button (pointer-down on "Left Melee," then drag = swipe for that attack; drag that started elsewhere = camera). So: pointer-down on attack button locks "this is the gesture"; record delta from that point until pointer-up for swipe direction/speed. Release without swipe = cancel. This avoids camera-drag being interpreted as attack.
- **Gesture recognizer:** On pointer-up (after pointer-down on an attack button), compute: swipe vector (or pull vector for bow), magnitude, and speed. Map to power 0–1. For bow: pull distance or hold time = power; release triggers fire.
- **Attack execution:** Given (attack type, aim direction, power): play the correct Animator trigger (Punch left/right, Kick left/right, Bow draw/release), apply hitbox or projectile in aim direction with power scaling. When the player takes damage, trigger **Hit** animation as before.
- **Animator:** Add Punch (and when available, left/right and kick variants), Hit, and later Bow states; trigger by name or hash from combat script. Mirror or single clip for left/right until you have more assets.

---

## Input variants

These can be implemented as options or combined so the same gesture pipeline supports multiple ways to express power and intent.

**1. Drag from button (path)**  
Touch down on an attack button, then **drag** (e.g. drag off the button in a direction). The path of that drag is the gesture: direction and length/speed feed into the attack. The gesture is always tied to the button, so there’s no ambiguity—movement that starts on the button is the attack gesture; movement that starts elsewhere is camera. Optionally show a trail or path on the UI for feedback. Aim direction can stay from camera/crosshair; the drag can add extra direction (e.g. drag left = lean left) or only power.

**2. Hold for power (charge)**  
**Hold duration** = charge. Tap = minimal power; hold 0.5s and release = medium; hold 1.5s = full charge. Release (with or without a drag) executes at that power. Good for attacks that don’t suit a swipe (e.g. bow: hold = draw, release = fire; power = hold time). UI: charge fill or ring on the button while holding.

**3. Combo (hold + drag)**  
Combine both: **hold** for base charge, **drag** on or from the button for extra power or path. Examples:
- Melee: touch button → (optional) hold to charge → drag off button → release. Power = f(hold time, drag speed or length). Aim from camera.
- Bow: touch button → hold (draw) → release. Power = hold duration; optionally add a “pull back” drag for extra power.
- UI: show charge fill for hold and/or a path preview when dragging.
