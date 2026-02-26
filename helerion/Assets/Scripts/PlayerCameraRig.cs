using UnityEngine;

/// <summary>
/// Camera rig that follows the player and rotates from Look input. Toggle between 1st and 3rd person in the Inspector.
/// In 3rd person: camera behind and above; character facing follows camera yaw. In 1st person: camera at eye height, character forward = camera forward.
/// </summary>
public class PlayerCameraRig : MonoBehaviour
{
    public enum CameraMode
    {
        ThirdPerson,
        FirstPerson
    }

    [Header("References")]
    [Tooltip("The player transform to follow (usually the Paladin root).")]
    public Transform player;
    [Tooltip("The camera to control. If unset, uses Camera.main.")]
    public Camera cam;
    [Tooltip("Optional: mesh to hide in 1st person to avoid clipping (e.g. character body).")]
    public GameObject characterMeshToHideInFirstPerson;

    [Header("Mode")]
    [Tooltip("Third person = camera behind and above; First person = camera at eye height, mesh can be hidden.")]
    public CameraMode cameraMode = CameraMode.ThirdPerson;

    [Header("Third person")]
    [Tooltip("Offset from player root (back, up, right). +Z = behind in local forward.")]
    public Vector3 thirdPersonOffset = new Vector3(0f, 2.5f, -4f);
    [Tooltip("Minimum vertical angle (pitch down) in degrees.")]
    public float pitchMin = -30f;
    [Tooltip("Maximum vertical angle (pitch up) in degrees.")]
    public float pitchMax = 60f;

    [Header("First person")]
    [Tooltip("Offset from player root for eye height (X, Y, Z).")]
    public Vector3 firstPersonOffset = new Vector3(0f, 1.6f, 0f);

    [Header("Look")]
    [Tooltip("Mouse/touch sensitivity for Look.")]
    public float lookSensitivity = 0.15f;
    [Tooltip("Invert Y axis for look.")]
    public bool invertY;

    private PlayerInputReader _input;
    private float _yaw;   // degrees
    private float _pitch; // degrees

    private void Awake()
    {
        _input = player != null ? player.GetComponent<PlayerInputReader>() : GetComponent<PlayerInputReader>();
        if (cam == null)
            cam = Camera.main;
        if (player != null)
        {
            _yaw = player.eulerAngles.y;
            _pitch = 0f;
        }
    }

    private void Start()
    {
        ApplyCameraModeVisibility();
        if (player != null && cam != null)
        {
            var wasd = player.GetComponent<WASDPlayerMovement>();
            if (wasd != null)
                wasd.movementFacing = cam.transform;
        }
    }

    private void LateUpdate()
    {
        if (player == null)
            return;

        Vector2 look = _input != null ? _input.Look : Vector2.zero;
        _yaw += look.x * lookSensitivity;
        float pitchDelta = look.y * lookSensitivity;
        if (invertY) pitchDelta = -pitchDelta;
        _pitch = Mathf.Clamp(_pitch + pitchDelta, pitchMin, pitchMax);

        Quaternion rot = Quaternion.Euler(_pitch, _yaw, 0f);

        if (cameraMode == CameraMode.ThirdPerson)
        {
            Vector3 offset = rot * thirdPersonOffset;
            if (cam != null)
            {
                cam.transform.position = player.position + offset;
                cam.transform.rotation = rot;
            }
            player.rotation = Quaternion.Euler(0f, _yaw, 0f);
        }
        else
        {
            Vector3 pos = player.position + player.TransformDirection(firstPersonOffset);
            if (cam != null)
            {
                cam.transform.position = pos;
                cam.transform.rotation = rot;
            }
            player.rotation = Quaternion.Euler(0f, _yaw, 0f);
        }
    }

    private void OnValidate()
    {
        ApplyCameraModeVisibility();
    }

    private void ApplyCameraModeVisibility()
    {
        if (characterMeshToHideInFirstPerson != null)
            characterMeshToHideInFirstPerson.SetActive(cameraMode != CameraMode.FirstPerson);
    }

    /// <summary>
    /// Call from Inspector or UI to switch mode at runtime.
    /// </summary>
    public void SetCameraMode(CameraMode mode)
    {
        cameraMode = mode;
        ApplyCameraModeVisibility();
    }

    /// <summary>
    /// Current look rotation yaw (for movement facing). Used by WASD to make movement camera-relative.
    /// </summary>
    public Transform GetFacingTransform()
    {
        return cam != null ? cam.transform : transform;
    }
}
