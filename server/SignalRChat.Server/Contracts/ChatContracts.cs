namespace SignalRChat.Server.Contracts;

// Контракты соответствуют схемам openapi/rest.json и openapi/signalr.json.
public sealed record ChatUserDto(string Id, string Name);

public sealed record ChatRoomDto(string Id, string Name, int MemberCount);

public sealed record ChatMessageDto(
    string Id,
    string RoomId,
    string AuthorId,
    string AuthorName,
    string Text,
    DateTimeOffset SentAt);

public sealed record SendMessageRequest(string RoomId, string Text);

public sealed record JoinRoomRequest(string RoomId, string UserName);

public sealed record JoinRoomResultDto(ChatRoomDto Room, ChatUserDto User);

public sealed record SetNameRequest(string Name);

public sealed record LeaveRoomRequest(string RoomId);

public sealed record GetHistoryRequest(string RoomId);

public sealed record MessageHistoryDto(string RoomId, IReadOnlyList<ChatMessageDto> Messages);

public sealed record UserJoinedEventDto(string RoomId, ChatUserDto User);

public sealed record UserLeftEventDto(string RoomId, string UserId);
