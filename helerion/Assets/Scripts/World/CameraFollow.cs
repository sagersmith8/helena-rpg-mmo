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
        [Tooltip("Offset from target (e.g. above and behind for 3rd person, or (0,50,0) for top-down).")]
        public Vector3 offset = new Vector3(0f, 40f, 0f);
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

            Vector3 desired = target.position + offset;
            transform.position = smoothSpeed <= 0f
                ? desired
                : Vector3.Lerp(transform.position, desired, smoothSpeed * Time.deltaTime);

            if (lookAtTarget)
                transform.LookAt(target.position + Vector3.up * 0f);
        }
    }
}
