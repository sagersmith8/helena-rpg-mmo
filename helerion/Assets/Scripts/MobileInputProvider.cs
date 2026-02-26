using UnityEngine;

/// <summary>
/// Central provider for mobile touch input: virtual joystick movement and ability buttons.
/// Read from this in your player/combat scripts. MobileControlUI and related scripts write into it.
/// </summary>
public class MobileInputProvider : MonoBehaviour
{
    public static MobileInputProvider Instance { get; private set; }

    [SerializeField] private Vector2 moveInput;
    [SerializeField] private bool ability1Down;
    [SerializeField] private bool ability2Down;
    [SerializeField] private bool ability3Down;
    [SerializeField] private bool ultimateDown;

    private bool _ability1Held;
    private bool _ability2Held;
    private bool _ability3Held;
    private bool _ultimateHeld;

    /// <summary> Virtual joystick movement. (-1,-1) to (1,1). </summary>
    public Vector2 MoveInput => moveInput;

    /// <summary> True the frame the button was pressed. </summary>
    public bool Ability1Down => ability1Down;
    public bool Ability2Down => ability2Down;
    public bool Ability3Down => ability3Down;
    public bool UltimateDown => ultimateDown;

    /// <summary> True while the button is held. </summary>
    public bool Ability1Held => _ability1Held;
    public bool Ability2Held => _ability2Held;
    public bool Ability3Held => _ability3Held;
    public bool UltimateHeld => _ultimateHeld;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    private void OnDestroy()
    {
        if (Instance == this)
            Instance = null;
    }

    private void LateUpdate()
    {
        // Reset one-shot state each frame so scripts see clean down state
        ability1Down = false;
        ability2Down = false;
        ability3Down = false;
        ultimateDown = false;
    }

    public void SetMoveInput(Vector2 value) => moveInput = value;

    public void SetAbility1(bool down)
    {
        if (down) ability1Down = true;
        _ability1Held = down;
    }
    public void SetAbility2(bool down)
    {
        if (down) ability2Down = true;
        _ability2Held = down;
    }
    public void SetAbility3(bool down)
    {
        if (down) ability3Down = true;
        _ability3Held = down;
    }
    public void SetUltimate(bool down)
    {
        if (down) ultimateDown = true;
        _ultimateHeld = down;
    }
}
