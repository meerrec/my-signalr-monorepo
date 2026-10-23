# syntax=docker/dockerfile:1

# --- build -------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

COPY server/SignalRChat.Domain/SignalRChat.Domain.csproj server/SignalRChat.Domain/
COPY server/SignalRChat.Application/SignalRChat.Application.csproj server/SignalRChat.Application/
COPY server/SignalRChat.Infrastructure/SignalRChat.Infrastructure.csproj server/SignalRChat.Infrastructure/
COPY server/SignalRChat.Server/SignalRChat.Server.csproj server/SignalRChat.Server/

RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore server/SignalRChat.Server/SignalRChat.Server.csproj

COPY server/ server/

RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet publish server/SignalRChat.Server/SignalRChat.Server.csproj \
        --configuration Release \
        --output /app/publish \
        --no-restore \
        /p:UseAppHost=false

# --- runtime -----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_NOLOGO=1

# curl нужен HEALTHCHECK: в образе aspnet его нет.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=app:app /app/publish .

USER app
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD curl -fsS -o /dev/null http://127.0.0.1:8080/

ENTRYPOINT ["dotnet", "SignalRChat.Server.dll"]
