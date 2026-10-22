using SignalRChat.Domain.Entities;

namespace SignalRChat.Application.Abstractions;

public sealed record RoomSnapshot(string Id, string Name, int MemberCount);

public sealed record JoinOutcome(
    RoomSnapshot Room,
    ChatUser User,
    RoomSnapshot? PreviousRoom);

public sealed record LeaveOutcome(RoomSnapshot Room, ChatUser User);

public sealed record SendMessageOutcome(ChatMessage Message, JoinOutcome? Joined);

/// <summary>
/// Порт хранилища состояния чата. Реализация живёт в Infrastructure.
/// </summary>
public interface IChatStore
{
    IReadOnlyList<RoomSnapshot> GetRooms();

    RoomSnapshot? GetRoom(string roomId);

    ChatUser? GetUser(string connectionId);

    string? GetRoomId(string connectionId);

    ChatUser SetName(string connectionId, string name);

    JoinOutcome Join(string connectionId, string roomId, string userName);

    LeaveOutcome? Leave(string connectionId, string? expectedRoomId = null);

    void Forget(string connectionId);

    ChatMessage AddMessage(string connectionId, string roomId, string text);

    IReadOnlyList<ChatMessage> GetHistory(string roomId);
}
