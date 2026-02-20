using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Assign to a Button or Image; reports pointer down/up to MobileInputProvider for ability or ultimate.
/// </summary>
public class AbilityButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
{
    public enum Ability { Ability1, Ability2, Ability3, Ultimate }

    public Ability ability = Ability.Ability1;

    public void OnPointerDown(PointerEventData eventData)
    {
        SetDown(true);
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        SetDown(false);
    }

    private void SetDown(bool down)
    {
        if (MobileInputProvider.Instance == null) return;
        switch (ability)
        {
            case Ability.Ability1: MobileInputProvider.Instance.SetAbility1(down); break;
            case Ability.Ability2: MobileInputProvider.Instance.SetAbility2(down); break;
            case Ability.Ability3: MobileInputProvider.Instance.SetAbility3(down); break;
            case Ability.Ultimate: MobileInputProvider.Instance.SetUltimate(down); break;
        }
    }
}
