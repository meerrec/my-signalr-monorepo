using SignalRChat.Application.Abstractions;
using SignalRChat.Domain.Entities;

namespace SignalRChat.Infrastructure.Persistence;

/// <summary>
/// In-memory реализация порта IChatStore для dev-сценария.
/// </summary>
public sealed class InMemoryChatStore : IChatStore
{
    private readonly object sync = new();
    private readonly Dictionary<string, RoomState> roomsByCode = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> roomIdByConnection = new(StringComparer.Ordinal);
    private readonly Dictionary<string, ChatUser> usersByConnection = new(StringComparer.Ordinal);

    public InMemoryChatStore()
    {
        SeedRoom("general", "Общий");
        SeedRoom("random", "Флуд");
        SeedRoom("support", "Поддержка");
    }

    public IReadOnlyList<RoomSnapshot> GetRooms()
    {
        lock (sync)
        {
            return roomsByCode.Values
                .Select(room => room.ToSnapshot())
                .OrderBy(room => room.Name, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }

    public RoomSnapshot? GetRoom(string roomId)
    {
        lock (sync)
        {
            return roomsByCode.TryGetValue(roomId, out var room) ? room.ToSnapshot() : null;
        }
    }

    public ChatUser? GetUser(string connectionId)
    {
        lock (sync)
        {
            return usersByConnection.GetValueOrDefault(connectionId);
        }
    }

    public string? GetRoomId(string connectionId)
    {
        lock (sync)
        {
            return roomIdByConnection.GetValueOrDefault(connectionId);
        }
    }

    public ChatUser SetName(string connectionId, string name)
    {
        lock (sync)
        {
            var user = new ChatUser(connectionId, name);
            usersByConnection[connectionId] = user;

            if (roomIdByConnection.TryGetValue(connectionId, out var roomId) &&
                roomsByCode.TryGetValue(roomId, out var room))
            {
                room.Members[connectionId] = user;
            }

            return user;
        }
    }

    public JoinOutcome Join(string connectionId, string roomId, string userName)
    {
        lock (sync)
        {
            var room = GetOrCreateRoomLocked(roomId);

            RoomSnapshot? previousRoom = null;
            if (roomIdByConnection.TryGetValue(connectionId, out var currentRoomId) &&
                currentRoomId != roomId &&
                roomsByCode.TryGetValue(currentRoomId, out var previous))
            {
                previous.Members.Remove(connectionId);
                previousRoom = previous.ToSnapshot();
            }

            var user = new ChatUser(connectionId, userName);
            usersByConnection[connectionId] = user;
            room.Members[connectionId] = user;
            roomIdByConnection[connectionId] = roomId;

            return new JoinOutcome(room.ToSnapshot(), user, previousRoom);
        }
    }

    public LeaveOutcome? Leave(string connectionId, string? expectedRoomId = null)
    {
        lock (sync)
        {
            if (!roomIdByConnection.TryGetValue(connectionId, out var roomId))
            {
                return null;
            }

            if (expectedRoomId is not null && !string.Equals(expectedRoomId, roomId, StringComparison.Ordinal))
            {
                return null;
            }

            roomIdByConnection.Remove(connectionId);

            var user = usersByConnection.GetValueOrDefault(connectionId)
                ?? new ChatUser(connectionId, "Гость");

            if (!roomsByCode.TryGetValue(roomId, out var room))
            {
                return null;
            }

            room.Members.Remove(connectionId);
            return new LeaveOutcome(room.ToSnapshot(), user);
        }
    }

    public void Forget(string connectionId)
    {
        lock (sync)
        {
            usersByConnection.Remove(connectionId);
        }
    }

    public ChatMessage AddMessage(string connectionId, string roomId, string text)
    {
        lock (sync)
        {
            var user = usersByConnection.GetValueOrDefault(connectionId)
                ?? throw new InvalidOperationException("Нет пользователя для соединения.");

            if (!roomsByCode.TryGetValue(roomId, out var room))
            {
                room = GetOrCreateRoomLocked(roomId);
            }

            var message = new ChatMessage(
                Guid.NewGuid().ToString("N"),
                roomId,
                user.Id,
                user.Name,
                text,
                DateTimeOffset.UtcNow);

            room.Messages.Add(message);
            return message;
        }
    }

    public IReadOnlyList<ChatMessage> GetHistory(string roomId)
    {
        lock (sync)
        {
            if (!roomsByCode.TryGetValue(roomId, out var room))
            {
                return Array.Empty<ChatMessage>();
            }

            return room.Messages
                .OrderBy(message => message.SentAt)
                .ThenBy(message => message.Id, StringComparer.Ordinal)
                .ToArray();
        }
    }

    private void SeedRoom(string id, string name)
    {
        roomsByCode[id] = new RoomState(id, name);
    }

    private RoomState GetOrCreateRoomLocked(string roomId)
    {
        if (roomsByCode.TryGetValue(roomId, out var existing))
        {
            return existing;
        }

        var created = new RoomState(roomId, roomId);
        roomsByCode[roomId] = created;
        return created;
    }

    private sealed class RoomState(string id, string name)
    {
        public string Id { get; } = id;
        public string Name { get; } = name;
        public List<ChatMessage> Messages { get; } = [];
        public Dictionary<string, ChatUser> Members { get; } = new(StringComparer.Ordinal);

        public RoomSnapshot ToSnapshot() => new(Id, Name, Members.Count);
    }
}
