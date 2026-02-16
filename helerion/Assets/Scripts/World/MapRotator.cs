using UnityEngine;

namespace Helerion.World
{
    /// <summary>
    /// Rotates the map (this transform) around Y only when the user drags. Add to a parent of MapGround.
    /// Important: this GameObject must NOT be a child of the Player, or the map will spin with the character.
    /// </summary>
    [AddComponentMenu("Helerion/Map Rotator")]
    public class MapRotator : MonoBehaviour
    {
        [Tooltip("Degrees per pixel of drag. Tune for touch (e.g. 0.15) or mouse (e.g. 0.3).")]
        public float sensitivity = 0.15f;
        [Tooltip("Invert horizontal drag direction.")]
        public bool invert = false;
        [Tooltip("Ignore drags smaller than this (pixels) to avoid drift from touch jitter.")]
        public float deadZonePixels = 2f;

        private void Start()
        {
            var p = transform.parent;
            while (p != null)
            {
                if (p.GetComponent<Helerion.Character.PlayerController>() != null)
                {
                    Debug.LogWarning("[MapRotator] Map is under the Player - the map will spin with the character. Move MapPivot to the scene root (not under Player).");
                    break;
                }
                p = p.parent;
            }
        }

        private void Update()
        {
            float delta = 0f;

#if UNITY_EDITOR || UNITY_STANDALONE
            if (Input.GetMouseButton(0))
                delta = Input.GetAxis("Mouse X");
#else
            if (Input.touchCount == 1)
            {
                Touch t = Input.GetTouch(0);
                if (t.phase == TouchPhase.Moved)
                    delta = t.deltaPosition.x;
            }
#endif
            if (Mathf.Abs(delta) < deadZonePixels) return;

            float sign = invert ? -1f : 1f;
            float add = sign * delta * sensitivity;
            transform.Rotate(0f, add, 0f, Space.World);
        }

        /// <summary>
        /// Set map rotation angle (degrees around Y). Use from UI or other input.
        /// </summary>
        public void SetRotationAngle(float angleY)
        {
            var e = transform.eulerAngles;
            transform.eulerAngles = new Vector3(e.x, angleY, e.z);
        }

        /// <summary>
        /// Add rotation (degrees). Positive = rotate map counter-clockwise (north goes left).
        /// </summary>
        public void AddRotation(float degrees)
        {
            transform.Rotate(0f, degrees, 0f, Space.World);
        }
    }
}
