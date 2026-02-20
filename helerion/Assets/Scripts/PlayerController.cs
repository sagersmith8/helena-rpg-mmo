using UnityEngine;

/// <summary>
/// Moves this GameObject with the virtual joystick (MobileInputProvider). Optional map reference for terrain height.
/// Attach to your player (e.g. Paladin). Add Mobile Control UI to the scene for the joystick.
/// </summary>
public class PlayerController : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Optional: used to sample terrain height so the character follows the map. Leave empty to keep current Y.")]
    public OSMMapDisplay mapDisplay;

    [Header("Movement")]
    [Tooltip("Move speed in world units per second. Tweak in the Inspector to slow down or speed up.")]
    [Range(0.5f, 20f)]
    public float moveSpeed = 4f;

    [Tooltip("Extra rotation in degrees around Y (e.g. 180 if the character faces the wrong way).")]
    [Range(-180f, 180f)]
    public float rotationOffsetY = 0f;

    [Header("Height")]
    [Tooltip("Height above the sampled terrain (Unity units).")]
    public float heightOffset = 0f;

    private Animator _animator;
    private static readonly int Speed = Animator.StringToHash("Speed");
    private static readonly int Punch = Animator.StringToHash("Punch");
    private bool _walkingClipSetToLoop;

    private void Awake()
    {
        _animator = GetComponentInChildren<Animator>();
        if (mapDisplay == null)
            mapDisplay = FindAnyObjectByType<OSMMapDisplay>();
    }

    private void Update()
    {
        Vector2 input = MobileInputProvider.Instance != null ? MobileInputProvider.Instance.MoveInput : Vector2.zero;
        Vector3 moveDir = new Vector3(input.x, 0f, input.y);
        if (moveDir.sqrMagnitude > 1f)
            moveDir.Normalize();

        Vector3 delta = moveDir * (moveSpeed * Time.deltaTime);
        Vector3 current = transform.position;
        Vector3 target = current + delta;

        if (mapDisplay != null)
            target.y = mapDisplay.SampleHeightAtWorld(target) + heightOffset;
        else
            target.y = current.y;

        transform.position = target;

        if (moveDir.sqrMagnitude > 0.0001f)
        {
            Vector3 lookDir = moveDir.normalized;
            Quaternion look = Quaternion.LookRotation(lookDir);
            if (Mathf.Abs(rotationOffsetY) > 0.01f)
                look = look * Quaternion.Euler(0f, rotationOffsetY, 0f);
            transform.rotation = look;
        }

        if (_animator != null)
        {
            _animator.SetFloat(Speed, moveDir.magnitude > 0.01f ? 1f : 0f);
            if (MobileInputProvider.Instance != null && MobileInputProvider.Instance.Ability3Down)
                _animator.SetTrigger(Punch);
            EnsureWalkingClipLoopsOnce();
        }
    }

    private void EnsureWalkingClipLoopsOnce()
    {
        if (_walkingClipSetToLoop) return;
        if (!_animator.GetCurrentAnimatorStateInfo(0).IsName("Walking")) return;

        var clipInfo = _animator.GetCurrentAnimatorClipInfo(0);
        if (clipInfo.Length > 0 && clipInfo[0].clip != null)
        {
            clipInfo[0].clip.wrapMode = WrapMode.Loop;
            _walkingClipSetToLoop = true;
        }
    }
}
