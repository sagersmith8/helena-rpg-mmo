namespace Helerion.Game
{
    /// <summary>
    /// Static status strings for on-device debugging. MapGround and ProceduralMapDecorator
    /// set these; Status HUD displays them so you can see what's happening without logs.
    /// </summary>
    public static class GameplayStatus
    {
        public static string MapStatus { get; set; } = "-";
        public static string DecoratorStatus { get; set; } = "-";
        public static string WorldOriginStatus { get; set; } = "-";
        public static string ExtraLine { get; set; } = "";
    }
}
