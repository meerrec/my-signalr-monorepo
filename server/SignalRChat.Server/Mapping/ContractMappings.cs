using SignalRChat.Application.Abstractions;
using SignalRChat.Domain.Entities;
using SignalRChat.Server.Contracts;

namespace SignalRChat.Server.Mapping;

internal static class ContractMappings
{
    public static ChatRoomDto ToDto(this RoomSnapshot room) =>
        new(room.Id, room.Name, room.MemberCount);

    public static ChatUserDto ToDto(this ChatUser user) =>
        new(user.Id, user.Name);

    public static ChatMessageDto ToDto(this ChatMessage message) =>
        new(message.Id, message.RoomId, message.AuthorId, message.AuthorName, message.Text, message.SentAt);
}
