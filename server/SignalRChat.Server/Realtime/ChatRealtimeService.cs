using Microsoft.AspNetCore.SignalR;
using SignalRChat.Application.Abstractions;
using SignalRChat.Application.Services;
using SignalRChat.Server.Contracts;
using SignalRChat.Server.Hubs;
using SignalRChat.Server.Mapping;
using SignalRChat.Server.Queues;

namespace SignalRChat.Server.Realtime;

/// <summary>
/// Realtime-сценарии чата: мутация <see cref="ChatService"/>, изменение групп и рассылка
/// события выполняются одной работой в <see cref="ChatWorkQueue"/> — строго последовательно,
/// без гонок между изменением состояния и broadcast.
/// </summary>
public sealed class ChatRealtimeService(
    ChatService chat,
    ChatWorkQueue queue,
    IHubContext<ChatHub> hub)
{
    public Task<ChatMessageDto> SendMessageAsync(string connectionId, SendMessageRequest request) =>
        queue.EnqueueAsync(async cancellationToken =>
        {
            var outcome = chat.SendMessage(connectionId, request.RoomId, request.Text);

            if (outcome.Joined is not null)
            {
                await BroadcastJoinAsync(connectionId, outcome.Joined, cancellationToken);
            }

            var message = outcome.Message.ToDto();
            await hub.Clients.Group(message.RoomId)
                .SendAsync("ReceiveMessage", message, cancellationToken);
            return message;
        });

    public Task<JoinRoomResultDto> JoinRoomAsync(string connectionId, JoinRoomRequest request) =>
        queue.EnqueueAsync(async cancellationToken =>
        {
            var outcome = chat.JoinRoom(connectionId, request.RoomId, request.UserName);
            await BroadcastJoinAsync(connectionId, outcome, cancellationToken);
            return new JoinRoomResultDto(outcome.Room.ToDto(), outcome.User.ToDto());
        });

    public Task<ChatUserDto> SetNameAsync(string connectionId, SetNameRequest request) =>
        queue.EnqueueAsync(async cancellationToken =>
        {
            var (user, roomId) = chat.SetName(connectionId, request.Name);

            if (roomId is not null)
            {
                // Отдельного события обновления пользователя в контракте нет:
                // клиент обновляет usersByIdAtom по UserJoined.
                await hub.Clients.Group(roomId).SendAsync(
                    "UserJoined",
                    new UserJoinedEventDto(roomId, user.ToDto()),
                    cancellationToken);
            }

            return user.ToDto();
        });

    public Task LeaveRoomAsync(string connectionId, LeaveRoomRequest request) =>
        queue.EnqueueAsync(async cancellationToken =>
        {
            var outcome = chat.LeaveRoom(connectionId, request.RoomId);
            if (outcome is null)
            {
                return;
            }

            await hub.Groups.RemoveFromGroupAsync(connectionId, outcome.Room.Id, cancellationToken);
            await hub.Clients.Group(outcome.Room.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.Room.Id, outcome.User.Id),
                cancellationToken);
            await hub.Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto(), cancellationToken);
        });

    public Task DisconnectAsync(string connectionId) =>
        queue.EnqueueAsync(async cancellationToken =>
        {
            var outcome = chat.Disconnect(connectionId);
            if (outcome is null)
            {
                return;
            }

            // Группу явно не удаляем: SignalR убирает соединение из групп сам.
            await hub.Clients.Group(outcome.Room.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.Room.Id, outcome.User.Id),
                cancellationToken);
            await hub.Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto(), cancellationToken);
        });

    private async Task BroadcastJoinAsync(
        string connectionId,
        JoinOutcome outcome,
        CancellationToken cancellationToken)
    {
        if (outcome.PreviousRoom is not null)
        {
            await hub.Groups.RemoveFromGroupAsync(connectionId, outcome.PreviousRoom.Id, cancellationToken);
            await hub.Clients.Group(outcome.PreviousRoom.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.PreviousRoom.Id, outcome.User.Id),
                cancellationToken);
            await hub.Clients.All.SendAsync("RoomUpdated", outcome.PreviousRoom.ToDto(), cancellationToken);
        }

        await hub.Groups.AddToGroupAsync(connectionId, outcome.Room.Id, cancellationToken);
        await hub.Clients.Group(outcome.Room.Id).SendAsync(
            "UserJoined",
            new UserJoinedEventDto(outcome.Room.Id, outcome.User.ToDto()),
            cancellationToken);
        await hub.Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto(), cancellationToken);
    }
}
