using Microsoft.AspNetCore.SignalR;
using SignalRChat.Application.Abstractions;
using SignalRChat.Application.Exceptions;
using SignalRChat.Application.Services;
using SignalRChat.Server.Contracts;
using SignalRChat.Server.Mapping;

namespace SignalRChat.Server.Hubs;

/// <summary>
/// Хаб чата. Контракт: openapi/signalr.json, route — /hubs/chat.
/// </summary>
public sealed class ChatHub(ChatService chat) : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Клиент не имеет отдельного метода получения списка комнат:
        // отдаём стартовый список через RoomUpdated на каждую комнату.
        foreach (var room in chat.GetRooms())
        {
            await Clients.Caller.SendAsync("RoomUpdated", room.ToDto());
        }

        await base.OnConnectedAsync();
    }

    public Task<ChatMessageDto> SendMessage(SendMessageRequest request) =>
        ExecuteAsync(async () =>
        {
            var outcome = chat.SendMessage(Context.ConnectionId, request.RoomId, request.Text);

            if (outcome.Joined is not null)
            {
                await BroadcastJoinAsync(outcome.Joined);
            }

            var message = outcome.Message.ToDto();
            await Clients.Group(message.RoomId).SendAsync("ReceiveMessage", message);
            return message;
        });

    public Task<JoinRoomResultDto> JoinRoom(JoinRoomRequest request) =>
        ExecuteAsync(async () =>
        {
            var outcome = chat.JoinRoom(Context.ConnectionId, request.RoomId, request.UserName);
            await BroadcastJoinAsync(outcome);
            return new JoinRoomResultDto(outcome.Room.ToDto(), outcome.User.ToDto());
        });

    public Task<ChatUserDto> SetName(SetNameRequest request) =>
        ExecuteAsync(async () =>
        {
            var (user, roomId) = chat.SetName(Context.ConnectionId, request.Name);

            if (roomId is not null)
            {
                // Отдельного события обновления пользователя в контракте нет:
                // клиент обновляет usersByIdAtom по UserJoined.
                await Clients.Group(roomId).SendAsync(
                    "UserJoined",
                    new UserJoinedEventDto(roomId, user.ToDto()));
            }

            return user.ToDto();
        });

    public Task LeaveRoom(LeaveRoomRequest request) =>
        ExecuteAsync(async () =>
        {
            var outcome = chat.LeaveRoom(Context.ConnectionId, request.RoomId);
            if (outcome is null)
            {
                return;
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, outcome.Room.Id);
            await Clients.Group(outcome.Room.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.Room.Id, outcome.User.Id));
            await Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto());
        });

    public Task<MessageHistoryDto> GetHistory(GetHistoryRequest request) =>
        Execute(() =>
        {
            var messages = chat.GetHistory(request.RoomId)
                .Select(message => message.ToDto())
                .ToArray();

            return new MessageHistoryDto(request.RoomId, messages);
        });

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var outcome = chat.Disconnect(Context.ConnectionId);

        if (outcome is not null)
        {
            await Clients.Group(outcome.Room.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.Room.Id, outcome.User.Id));
            await Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto());
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task BroadcastJoinAsync(JoinOutcome outcome)
    {
        if (outcome.PreviousRoom is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, outcome.PreviousRoom.Id);
            await Clients.Group(outcome.PreviousRoom.Id).SendAsync(
                "UserLeft",
                new UserLeftEventDto(outcome.PreviousRoom.Id, outcome.User.Id));
            await Clients.All.SendAsync("RoomUpdated", outcome.PreviousRoom.ToDto());
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, outcome.Room.Id);
        await Clients.Group(outcome.Room.Id).SendAsync(
            "UserJoined",
            new UserJoinedEventDto(outcome.Room.Id, outcome.User.ToDto()));
        await Clients.All.SendAsync("RoomUpdated", outcome.Room.ToDto());
    }

    private static async Task<T> ExecuteAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (ChatValidationException exception)
        {
            throw new HubException(exception.Message);
        }
    }

    private static async Task ExecuteAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (ChatValidationException exception)
        {
            throw new HubException(exception.Message);
        }
    }

    private static Task<T> Execute<T>(Func<T> action)
    {
        try
        {
            return Task.FromResult(action());
        }
        catch (ChatValidationException exception)
        {
            return Task.FromException<T>(new HubException(exception.Message));
        }
    }
}
