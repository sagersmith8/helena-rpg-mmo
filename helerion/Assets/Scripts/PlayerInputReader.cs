using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// Reads from the Player action map (Move, Look, Attack, Previous, Next) and exposes values for movement, camera, and combat.
/// Assign the InputSystem_Actions asset in the Inspector. Enable this on the player so WASD, camera, and combat scripts can read input.
/// </summary>
public class PlayerInputReader : MonoBehaviour
{
    [Header("Input")]
    [Tooltip("Assign the InputSystem_Actions asset (InputSystem_Actions.inputactions).")]
    public InputActionAsset inputActions;

    private InputAction _moveAction;
    private InputAction _lookAction;
    private InputAction _attackAction;
    private InputAction _previousAction;
    private InputAction _nextAction;

    public Vector2 Move => _moveAction?.ReadValue<Vector2>() ?? Vector2.zero;
    public Vector2 Look => _lookAction?.ReadValue<Vector2>() ?? Vector2.zero;
    public bool AttackPressed => _attackAction?.WasPressedThisFrame() ?? false;
    public bool PreviousPressed => _previousAction?.WasPressedThisFrame() ?? false;
    public bool NextPressed => _nextAction?.WasPressedThisFrame() ?? false;

    private void Awake()
    {
        if (inputActions == null)
            return;

        var playerMap = inputActions.FindActionMap("Player");
        if (playerMap == null)
            return;

        _moveAction = playerMap.FindAction("Move");
        _lookAction = playerMap.FindAction("Look");
        _attackAction = playerMap.FindAction("Attack");
        _previousAction = playerMap.FindAction("Previous");
        _nextAction = playerMap.FindAction("Next");
    }

    private void OnEnable()
    {
        inputActions?.Enable();
    }

    private void OnDisable()
    {
        inputActions?.Disable();
    }
}
