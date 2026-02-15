using UnityEngine;
using Helerion.Game;

namespace Helerion.World
{
    /// <summary>
    /// Makes the camera follow the player. Assign the Player transform.
    /// Good for top-down or angled view so you see the character move on the map.
    /// </summary>
    [AddComponentMenu("Helerion/Camera Follow")]
    public class CameraFollow : MonoBehaviour
    {
        [Header("Target")]
        [Tooltip("Player transform to follow. If null, finds GameObject with tag Player.")]
        public Transform target;

        [Header("Position")]
        [Tooltip("Offset from target. With useLocalOffset, this is in the character's space (e.g. (0,40,-15) = above and behind).")]
        public Vector3 offset = new Vector3(0f, 40f, -15f);
        [Tooltip("If true, offset is applied in target's local space so camera stays behind when the character rotates (e.g. with heading).")]
        public bool useLocalOffset = true;
        [Tooltip("Smooth follow speed. 0 = instant.")]
        public float smoothSpeed = 5f;

        [Header("Look")]
        [Tooltip("If true, camera looks at target (good for top-down so you see the map).")]
        public bool lookAtTarget = true;

        private void Start()
        {
            if (target == null)
            {
                var go = GameObject.FindGameObjectWithTag("Player");
                if (go != null) target = go.transform;
            }
        }

        private void LateUpdate()
        {
            if (target == null) return;

            Vector3 worldOffset = useLocalOffset ? target.rotation * offset : offset;
            Vector3 desired = target.position + worldOffset;
            transform.position = smoothSpeed <= 0f
                ? desired
                : Vector3.Lerp(transform.position, desired, smoothSpeed * Time.deltaTime);

            if (lookAtTarget)
                transform.LookAt(target.position + Vector3.up * 0f);
        }
    }
}
