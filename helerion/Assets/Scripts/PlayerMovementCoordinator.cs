using UnityEngine;

/// <summary>
/// Chooses between GPS movement (mobile) and WASD movement (editor/desktop testing).
/// When "Use Keyboard" is on, GPS is disabled and WASD runs; otherwise GPS runs.
/// </summary>
public class PlayerMovementCoordinator : MonoBehaviour
{
    [Header("Mode")]
    [Tooltip("When true, use WASD/keyboard movement; when false, use GPS. Default: keyboard in Editor, GPS on device. Override in Inspector to test either mode.")]
    public bool useKeyboard = true;

    [Header("Components")]
    [Tooltip("GPS movement component (e.g. GPSFlyingController on FlyingBeast). Disabled when useKeyboard is true.")]
    public MonoBehaviour gpsMovement;
    [Tooltip("WASD movement component. Disabled when useKeyboard is false.")]
    public MonoBehaviour wasdMovement;

    private void Start()
    {
        // Optionally override from Inspector already applied in Awake
        ApplyMode();
    }

    private void ApplyMode()
    {
        if (gpsMovement != null)
            gpsMovement.enabled = !useKeyboard;
        if (wasdMovement != null)
            wasdMovement.enabled = useKeyboard;
    }

    private void Awake()
    {
        if (gpsMovement == null)
            gpsMovement = GetComponent<GPSFlyingController>();
        if (wasdMovement == null)
            wasdMovement = GetComponent<WASDPlayerMovement>();
#if !UNITY_EDITOR
        if (Application.isMobilePlatform)
            useKeyboard = false;
#endif
        ApplyMode();
    }
}
