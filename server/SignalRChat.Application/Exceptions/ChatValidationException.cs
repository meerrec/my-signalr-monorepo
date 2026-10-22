namespace SignalRChat.Application.Exceptions;

public sealed class ChatValidationException(string message) : Exception(message);
