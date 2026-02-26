using UnityEngine;

/// <summary>
/// Moves the character with WASD (or Move action). For editor/desktop testing; on mobile the coordinator uses GPS instead.
/// Movement is relative to an optional "facing" transform (e.g. camera) so forward = camera forward. Drives Animator Speed for Idle/Walking.
/// </summary>
public class WASDPlayerMovement : MonoBehaviour
{
    [Header("Movement")]
    [Tooltip("Movement speed in world units per second.")]
    public float moveSpeed = 5f;
    [Tooltip("Optional: movement is relative to this transform's forward (e.g. Main Camera). If unset, uses world axes.")]
    public Transform movementFacing;

    [Header("Optional bounds (e.g. map)")]
    [Tooltip("If set, clamp position to this transform's bounds (e.g. Map with OSMMapDisplay). Uses map's tile grid and scale to estimate bounds.")]
    public OSMMapDisplay mapDisplay;
    [Tooltip("Optional terrain for height sampling. If unset, tries to use map's terrain or leaves Y unchanged.")]
    public Terrain terrainForHeight;

    private PlayerInputReader _input;
    private Animator _animator;
    private static readonly int SpeedHash = Animator.StringToHash("Speed");

    private void Awake()
    {
        _input = GetComponent<PlayerInputReader>();
        _animator = GetComponentInChildren<Animator>();
        if (terrainForHeight == null && mapDisplay != null)
        {
            var mapGo = mapDisplay.gameObject;
            terrainForHeight = mapGo.GetComponentInChildren<Terrain>();
        }
    }

    private void Update()
    {
        Vector2 moveInput = _input != null ? _input.Move : Vector2.zero;
        Vector3 moveDir = Vector3.zero;
        if (moveInput.sqrMagnitude > 0.01f)
        {
            Vector3 forward = movementFacing != null ? movementFacing.forward : transform.forward;
            Vector3 right = movementFacing != null ? movementFacing.right : transform.right;
            forward.y = 0f;
            right.y = 0f;
            forward.Normalize();
            right.Normalize();
            moveDir = (forward * moveInput.y + right * moveInput.x).normalized;
        }

        if (moveDir.sqrMagnitude > 0.01f)
        {
            Vector3 delta = moveDir * (moveSpeed * Time.deltaTime);
            Vector3 pos = transform.position + delta;

            if (mapDisplay != null && mapDisplay.IsMapReady)
            {
                float half = (mapDisplay.tileGridSize * mapDisplay.worldScalePerTile) * 0.5f;
                Vector3 mapCenter = mapDisplay.transform.position;
                pos.x = Mathf.Clamp(pos.x, mapCenter.x - half, mapCenter.x + half);
                pos.z = Mathf.Clamp(pos.z, mapCenter.z - half, mapCenter.z + half);
            }

            if (terrainForHeight != null)
                pos.y = terrainForHeight.SampleHeight(pos);

            transform.position = pos;
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(moveDir), Time.deltaTime * 10f);
        }

        float speedNorm = moveDir.magnitude * moveSpeed;
        if (_animator != null)
            _animator.SetFloat(SpeedHash, Mathf.Clamp01(speedNorm / 2f));
    }
}
