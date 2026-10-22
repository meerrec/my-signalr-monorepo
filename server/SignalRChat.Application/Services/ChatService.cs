using SignalRChat.Application.Abstractions;
using SignalRChat.Application.Exceptions;
using SignalRChat.Domain.Entities;

namespace SignalRChat.Application.Services;

/// <summary>
/// Use cases чата: валидация ввода и сценарии поверх порта IChatStore.
/// </summary>
public sealed class ChatService(IChatStore store)
{
    public IReadOnlyList<RoomSnapshot> GetRooms() => store.GetRooms();

    public JoinOutcome JoinRoom(string connectionId, string roomId, string userName) =>
        store.Join(
            connectionId,
            RequireText(roomId, "Комната"),
            RequireText(userName, "Имя"));

    public (ChatUser User, string? RoomId) SetName(string connectionId, string name)
    {
        var user = store.SetName(connectionId, RequireText(name, "Имя"));
        return (user, store.GetRoomId(connectionId));
    }

    public SendMessageOutcome SendMessage(string connectionId, string roomId, string text)
    {
        var normalizedRoomId = RequireText(roomId, "Комната");
        var body = RequireText(text, "Текст сообщения");

        var user = store.GetUser(connectionId)
            ?? throw new ChatValidationException("Сначала задайте имя или войдите в комнату.");

        JoinOutcome? joined = null;
        if (!string.Equals(store.GetRoomId(connectionId), normalizedRoomId, StringComparison.Ordinal))
        {
            joined = store.Join(connectionId, normalizedRoomId, user.Name);
        }

        var message = store.AddMessage(connectionId, normalizedRoomId, body);
        return new SendMessageOutcome(message, joined);
    }

    public LeaveOutcome? LeaveRoom(string connectionId, string roomId) =>
        store.Leave(connectionId, RequireText(roomId, "Комната"));

    public LeaveOutcome? Disconnect(string connectionId)
    {
        var outcome = store.Leave(connectionId);
        store.Forget(connectionId);
        return outcome;
    }

    public IReadOnlyList<ChatMessage> GetHistory(string roomId) =>
        store.GetHistory(RequireText(roomId, "Комната"));

    private static string RequireText(string? value, string field)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed)
            ? throw new ChatValidationException($"{field}: значение обязательно.")
            : trimmed;
    }
}
