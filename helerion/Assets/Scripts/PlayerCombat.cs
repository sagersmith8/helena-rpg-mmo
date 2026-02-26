using UnityEngine;

/// <summary>
/// Aim from camera/crosshair; cycle attack with Previous/Next; Attack triggers current attack (Punch) in aim direction.
/// Assign camera (for aim ray), animator, and optional crosshair UI. When the player takes damage, call TriggerHit().
/// </summary>
public class PlayerCombat : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Camera used for aim ray (through screen center or crosshair). If unset, uses Camera.main.")]
    public Camera aimCamera;
    [Tooltip("Animator on the character (for Punch/Hit triggers).")]
    public Animator animator;
    [Tooltip("Optional: crosshair RectTransform for aim point. If set, aim ray goes through this UI position; otherwise screen center.")]
    public RectTransform crosshairRect;

    [Header("Aim")]
    [Tooltip("Max ray distance for aim (e.g. melee range or beyond for projectiles).")]
    public float aimRayDistance = 50f;
    [Tooltip("LayerMask for aim ray (e.g. enemies, world).")]
    public LayerMask aimLayerMask = -1;

    [Header("Attack cycle")]
    [Tooltip("Names of Animator trigger parameters for each attack (e.g. Punch, Kick). First is default.")]
    public string[] attackTriggerNames = { "Punch" };

    private PlayerInputReader _input;
    private int _currentAttackIndex;
    private static readonly int HitHash = Animator.StringToHash("Hit");

    public Vector3 AimDirection { get; private set; }
    public Vector3 AimPoint { get; private set; }
    public int CurrentAttackIndex => _currentAttackIndex;

    private void Awake()
    {
        _input = GetComponent<PlayerInputReader>();
        if (aimCamera == null)
            aimCamera = Camera.main;
        if (animator == null)
            animator = GetComponentInChildren<Animator>();
    }

    private void Update()
    {
        UpdateAim();

        if (_input != null)
        {
            if (_input.PreviousPressed)
            {
                _currentAttackIndex = _currentAttackIndex - 1;
                if (_currentAttackIndex < 0)
                    _currentAttackIndex = attackTriggerNames.Length - 1;
            }
            if (_input.NextPressed)
            {
                _currentAttackIndex = (_currentAttackIndex + 1) % attackTriggerNames.Length;
            }
            if (_input.AttackPressed)
                TryPerformAttack();
        }
    }

    private void UpdateAim()
    {
        if (aimCamera == null)
            return;

        Vector2 screenPoint = GetCrosshairScreenPosition();
        Ray ray = aimCamera.ScreenPointToRay(screenPoint);
        if (Physics.Raycast(ray, out RaycastHit hit, aimRayDistance, aimLayerMask))
        {
            AimPoint = hit.point;
            AimDirection = (hit.point - aimCamera.transform.position).normalized;
        }
        else
        {
            AimPoint = aimCamera.transform.position + ray.direction * aimRayDistance;
            AimDirection = ray.direction;
        }
    }

    private Vector2 GetCrosshairScreenPosition()
    {
        if (crosshairRect != null && crosshairRect.gameObject.activeInHierarchy)
        {
            Canvas c = crosshairRect.GetComponentInParent<Canvas>();
            Camera cam = (c != null && c.renderMode == RenderMode.ScreenSpaceCamera) ? c.worldCamera : aimCamera;
            return RectTransformUtility.WorldToScreenPoint(cam != null ? cam : null, crosshairRect.TransformPoint(Vector3.zero));
        }
        return new Vector2(aimCamera != null ? aimCamera.pixelWidth * 0.5f : Screen.width * 0.5f,
            aimCamera != null ? aimCamera.pixelHeight * 0.5f : Screen.height * 0.5f);
    }

    private void TryPerformAttack()
    {
        if (animator == null || attackTriggerNames == null || attackTriggerNames.Length == 0)
            return;

        UpdateAim();
        string triggerName = attackTriggerNames[Mathf.Clamp(_currentAttackIndex, 0, attackTriggerNames.Length - 1)];
        int hash = Animator.StringToHash(triggerName);
        animator.SetTrigger(hash);
        // Optional: spawn hitbox, projectile, or apply damage at AimPoint / along AimDirection here.
    }

    /// <summary>
    /// Call when the player takes damage to play the Hit animation.
    /// </summary>
    public void TriggerHit()
    {
        if (animator != null)
            animator.SetTrigger(HitHash);
    }
}
