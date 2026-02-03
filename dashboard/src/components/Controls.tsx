interface Status {
    status: 'running' | 'paused' | 'idle';
}

interface ControlsProps {
    status: Status | null;
    onPause: () => void;
    onResume: () => void;
    onRunOnce: () => void;
    onReload: () => void;
    onRefresh: () => void;
}

export default function Controls({
    status,
    onPause,
    onResume,
    onRunOnce,
    onReload,
    onRefresh,
}: ControlsProps) {
    const isPaused = status?.status === 'paused';
    const isRunning = status?.status === 'running';

    return (
        <div className="card" style={{ marginTop: 16 }}>
            <h2>Controls</h2>
            <div className="controls">
                {isPaused ? (
                    <button onClick={onResume} className="primary">
                        ▶ Resume
                    </button>
                ) : (
                    <button onClick={onPause} disabled={!status}>
                        ⏸ Pause
                    </button>
                )}

                <button onClick={onRunOnce} disabled={isRunning || !status}>
                    ⚡ Run Once
                </button>

                <button onClick={onReload} disabled={!status}>
                    🔄 Reload Config
                </button>

                <button onClick={onRefresh}>
                    ↻ Refresh
                </button>
            </div>
        </div>
    );
}
