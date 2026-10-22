using System.Threading.Channels;

namespace SignalRChat.Server.Queues;

/// <summary>
/// Очередь работ чата: единственный reader выполняет мутации состояния и рассылки строго
/// по одной, в порядке поступления. Bounded-канал даёт backpressure: когда он заполнен,
/// <see cref="EnqueueAsync{T}"/> ждёт свободного слота вместо потери работы.
/// </summary>
public sealed class ChatWorkQueue(ILogger<ChatWorkQueue> logger) : BackgroundService
{
    private const int Capacity = 1024;

    private readonly Channel<Func<CancellationToken, Task>> channel =
        Channel.CreateBounded<Func<CancellationToken, Task>>(
            new BoundedChannelOptions(Capacity)
            {
                SingleReader = true,
                SingleWriter = false,
                FullMode = BoundedChannelFullMode.Wait,
                AllowSynchronousContinuations = false,
            });

    /// <summary>Ставит работу в очередь и возвращает её результат.</summary>
    public async Task<T> EnqueueAsync<T>(Func<CancellationToken, Task<T>> work)
    {
        var completion = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);

        try
        {
            // WriteAsync, а не TryWrite: при заполненном канале ждём слота (backpressure).
            await channel.Writer.WriteAsync(Wrap(work, completion));
        }
        catch (ChannelClosedException)
        {
            // Очередь остановлена: работа не будет выполнена, но вызывающий не зависает.
            completion.TrySetCanceled();
        }

        return await completion.Task;
    }

    /// <summary>Ставит работу в очередь без результата.</summary>
    public async Task EnqueueAsync(Func<CancellationToken, Task> work)
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        try
        {
            await channel.Writer.WriteAsync(Wrap(work, completion));
        }
        catch (ChannelClosedException)
        {
            completion.TrySetCanceled();
        }

        await completion.Task;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // ReadAllAsync без токена: после TryComplete в StopAsync дочитываем остаток,
            // чтобы ожидающие TCS завершились, а не зависли.
            await foreach (var work in channel.Reader.ReadAllAsync())
            {
                // При штатном shutdown токен уже отменён: работа не выполняется,
                // обёртка сразу завершает её TCS как canceled.
                await work(stoppingToken);
            }
        }
        catch (Exception exception)
        {
            // Reader не должен умирать молча: фиксируем причину остановки очереди.
            logger.LogError(exception, "Очередь работ чата завершилась с ошибкой.");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        // Закрываем writer: новые работы отклоняются, reader дочитывает остаток и выходит.
        channel.Writer.TryComplete();
        await base.StopAsync(cancellationToken);
    }

    private static Func<CancellationToken, Task> Wrap<T>(
        Func<CancellationToken, Task<T>> work,
        TaskCompletionSource<T> completion) =>
        async cancellationToken =>
        {
            if (cancellationToken.IsCancellationRequested)
            {
                completion.TrySetCanceled(cancellationToken);
                return;
            }

            try
            {
                var result = await work(cancellationToken);
                completion.TrySetResult(result);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                completion.TrySetCanceled(cancellationToken);
            }
            catch (Exception exception)
            {
                // Тип исключения сохраняем: ChatValidationException Hub превращает в HubException.
                completion.TrySetException(exception);
            }
        };

    private static Func<CancellationToken, Task> Wrap(
        Func<CancellationToken, Task> work,
        TaskCompletionSource completion) =>
        async cancellationToken =>
        {
            if (cancellationToken.IsCancellationRequested)
            {
                completion.TrySetCanceled(cancellationToken);
                return;
            }

            try
            {
                await work(cancellationToken);
                completion.TrySetResult();
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                completion.TrySetCanceled(cancellationToken);
            }
            catch (Exception exception)
            {
                completion.TrySetException(exception);
            }
        };
}
