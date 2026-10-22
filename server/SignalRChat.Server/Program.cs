using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using SignalR.OpenApi.Extensions;
using SignalRChat.Application.Abstractions;
using SignalRChat.Application.Services;
using SignalRChat.Infrastructure.Persistence;
using SignalRChat.Server.Hubs;
using SignalRChat.Server.Mapping;
using SignalRChat.Server.Queues;
using SignalRChat.Server.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddSignalR()
    .AddJsonProtocol(options =>
    {
        // Клиент ожидает camelCase-поля (типы из generated/rest.ts).
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                (uri.Host == "localhost" || uri.Host == "127.0.0.1"))
            .AllowAnyHeader()
            .AllowAnyMethod()
            // SignalR JS-клиент по умолчанию шлёт negotiate с credentials mode=include.
            .AllowCredentials());
});

builder.Services.AddSignalROpenApi();
builder.Services.AddSignalRSwaggerUi();

// Composition root: порт из Application, реализация из Infrastructure.
builder.Services.AddSingleton<IChatStore, InMemoryChatStore>();
builder.Services.AddSingleton<ChatService>();

// Очередь — singleton: hosted service резолвит тот же экземпляр (не AddHostedService<T>).
builder.Services.AddSingleton<ChatWorkQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ChatWorkQueue>());
builder.Services.AddSingleton<ChatRealtimeService>();

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Ok(new { name = "SignalR Chat server", hub = "/hubs/chat" }));
app.MapGet(
    "/api/rooms",
    (ChatService chat) => Results.Ok(chat.GetRooms().Select(room => room.ToDto()).ToArray()));
app.MapGet(
    "/api/rooms/{roomId}/messages",
    (string roomId, ChatService chat) => Results.Ok(
        chat.GetHistory(roomId).Select(message => message.ToDto()).ToArray()));
app.MapHub<ChatHub>(
    "/hubs/chat",
    options =>
    {
        // Единственный транспорт — long polling: WebSockets и SSE отключены.
        options.Transports = HttpTransportType.LongPolling;
    });
app.MapSignalROpenApi();
app.UseSignalRSwaggerUi();

app.Run();
