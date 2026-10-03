import React, { useEffect, useRef, useState } from 'react';
import { ToggleSwitch } from '../shared/controls';
import styles from './LogOutput.module.css';

interface LogEntry {
  message: string;
  level: string;
  timestamp: Date;
}

interface LogOutputProps {
  logs: LogEntry[];
}

const LogOutput: React.FC<LogOutputProps> = ({ logs }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Calculation output</h3>
        <ToggleSwitch label="Auto-scroll" checked={autoScroll} onChange={setAutoScroll} />
      </div>

      <div ref={logContainerRef} className={styles.logOutput}>
        {logs.length === 0 ? (
          <div className={styles.noLogs}>No output yet. Run a calculation to see logs.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`${styles.logEntry} ${styles[`log-${log.level}`] ?? ''}`}>
              <span className={styles.timestamp}>[{formatTimestamp(log.timestamp)}]</span>
              <span className={styles.message}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogOutput;