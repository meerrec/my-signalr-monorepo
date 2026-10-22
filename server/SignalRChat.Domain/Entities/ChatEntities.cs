namespace SignalRChat.Domain.Entities;

public sealed record ChatUser(string Id, string Name);

public sealed record ChatRoom(string Id, string Name);

public sealed record ChatMessage(
    string Id,
    string RoomId,
    string AuthorId,
    string AuthorName,
    string Text,
    DateTimeOffset SentAt);
