using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Virtual joystick: drag the handle to produce MoveInput. Assign to the joystick base (parent of handle).
/// Uses RectTransform; place in a Canvas. MobileInputProvider must exist in the scene.
/// </summary>
public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
{
    [Header("References")]
    [Tooltip("The handle that moves with input. If unset, uses first child RectTransform.")]
    public RectTransform handle;

    [Header("Settings")]
    [Tooltip("Max distance the handle can move from center (in rect units).")]
    public float radius = 80f;

    [Tooltip("If true, handle snaps back to center when released.")]
    public bool snapBack = true;

    private RectTransform _rect;
    private Vector2 _center;

    private void Awake()
    {
        _rect = GetComponent<RectTransform>();
        if (handle == null && transform.childCount > 0 && transform.GetChild(0).TryGetComponent(out RectTransform child))
            handle = child;
    }

    private void Start()
    {
        // Center of the joystick panel in its local space (panel has pivot 0,0 so origin is bottom-left)
        _center = new Vector2(_rect.rect.width * 0.5f, _rect.rect.height * 0.5f);
    }

    public void OnPointerDown(PointerEventData eventData)
    {
        // Start from center: don't jump handle to touch position
        if (handle != null)
            handle.anchoredPosition = Vector2.zero;
        OnDrag(eventData);
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(_rect, eventData.position, eventData.pressEventCamera, out Vector2 local))
        {
            Vector2 delta = local - _center;
            if (radius > 0.001f)
            {
                if (delta.sqrMagnitude > radius * radius)
                    delta = delta.normalized * radius;
                // Handle has anchor (0.5,0.5) so (0,0) is center; offset from center is just delta
                if (handle != null)
                    handle.anchoredPosition = delta;
            }
            Vector2 input = radius > 0.001f ? delta / radius : Vector2.zero;
            if (MobileInputProvider.Instance != null)
                MobileInputProvider.Instance.SetMoveInput(input);
        }
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        if (snapBack && handle != null)
            handle.anchoredPosition = Vector2.zero;
        if (MobileInputProvider.Instance != null)
            MobileInputProvider.Instance.SetMoveInput(Vector2.zero);
    }
}
