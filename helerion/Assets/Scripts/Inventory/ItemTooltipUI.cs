using UnityEngine;
using UnityEngine.UI;
using System.Text;

/// <summary>
/// Shows tooltip for an item (name, description, stats). Can show comparison (e.g. current vs selected).
/// </summary>
public class ItemTooltipUI : MonoBehaviour
{
    [SerializeField] private Text nameText;
    [SerializeField] private Text descriptionText;
    [SerializeField] private Text statsText;
    [SerializeField] private RectTransform root;

    public void SetReferences(Text nameT, Text descT, Text statsT, RectTransform rootRt)
    {
        nameText = nameT;
        descriptionText = descT;
        statsText = statsT;
        root = rootRt;
    }

    public void Show(ItemDefinition definition, ItemDefinition compareTo = null)
    {
        if (root != null) root.gameObject.SetActive(definition != null);
        if (definition == null) return;

        if (nameText != null) nameText.text = definition.displayName;
        if (descriptionText != null) descriptionText.text = definition.description ?? "";

        var sb = new StringBuilder();
        if (definition.stats != null)
        {
            foreach (var s in definition.stats)
            {
                if (string.IsNullOrEmpty(s.statId)) continue;
                float val = s.value;
                string sign = val >= 0 ? "+" : "";
                sb.AppendLine($"{s.statId}: {sign}{val}");
                if (compareTo != null)
                {
                    float other = compareTo.GetStatValue(s.statId);
                    float diff = val - other;
                    if (Mathf.Abs(diff) > 0.001f)
                        sb.Append($"  (vs {compareTo.displayName}: {(diff >= 0 ? "+" : "")}{diff})");
                    sb.AppendLine();
                }
            }
        }
        if (definition is ConsumableItemDefinition consumable && consumable.effects != null)
        {
            foreach (var e in consumable.effects)
                sb.AppendLine($"Use: {e.statId} {e.value}");
        }
        if (statsText != null) statsText.text = sb.ToString();
    }

    public void Hide()
    {
        if (root != null) root.gameObject.SetActive(false);
    }
}
