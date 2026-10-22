using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using SignalRChat.Application.Exceptions;
using SignalRChat.Application.Services;
using SignalRChat.Server.Contracts;
using SignalRChat.Server.Mapping;
using SignalRChat.Server.Realtime;

namespace SignalRChat.Server.Hubs;

/// <summary>
/// Хаб чата. Контракт: openapi/signalr.json, route — /hubs/chat.
/// Мутации и рассылки делегируются <see cref="ChatRealtimeService"/> через очередь работ.
/// </summary>
public sealed class ChatHub(
    ChatService chat,
    ChatRealtimeService realtime,
    ILogger<ChatHub> logger) : Hub
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

    public Task<ChatMessageDto> SendMessage(SendMessageRequest request)
    {
        // Захватываем строку: после возврата из метода Context уже недоступен.
        var connectionId = Context.ConnectionId;
        return ExecuteAsync(() => realtime.SendMessageAsync(connectionId, request));
    }

    public Task<JoinRoomResultDto> JoinRoom(JoinRoomRequest request)
    {
        var connectionId = Context.ConnectionId;
        return ExecuteAsync(() => realtime.JoinRoomAsync(connectionId, request));
    }

    public Task<ChatUserDto> SetName(SetNameRequest request)
    {
        var connectionId = Context.ConnectionId;
        return ExecuteAsync(() => realtime.SetNameAsync(connectionId, request));
    }

    public Task LeaveRoom(LeaveRoomRequest request)
    {
        var connectionId = Context.ConnectionId;
        return ExecuteAsync(() => realtime.LeaveRoomAsync(connectionId, request));
    }

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
        var connectionId = Context.ConnectionId;

        try
        {
            await realtime.DisconnectAsync(connectionId);
        }
        catch (OperationCanceledException cancelled)
        {
            // Штатная остановка сервера: очередь закрыта, работа отменена.
            logger.LogDebug(
                cancelled,
                "Disconnect для соединения {ConnectionId} отменён при остановке сервера.",
                connectionId);
        }
        catch (ChannelClosedException closed)
        {
            // Очередь уже закрыта — отключение при shutdown обрабатывать не нужно.
            logger.LogDebug(
                closed,
                "Очередь работ закрыта, Disconnect для соединения {ConnectionId} не выполнен.",
                connectionId);
        }
        finally
        {
            await base.OnDisconnectedAsync(exception);
        }
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
