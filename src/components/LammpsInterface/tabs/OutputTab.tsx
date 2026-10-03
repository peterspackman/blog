import React, { useRef, useEffect, useState, useMemo } from 'react';
import styles from '../LammpsInterface.module.css';
import { OutputLine, VfsFile } from '../types';
import { ThermoChart } from '../components/ThermoChart';
import { HistogramChart } from '../components/HistogramChart';
import { Select, SegmentedControl, VizButton } from '../../shared/controls';

interface OutputTabProps {
  output: OutputLine[];
  vfsFiles: VfsFile[];
  isReady: boolean;
  isRunning: boolean;
  onClearOutput: () => void;
  onListFiles: () => void;
  onDownloadFile: (filename: string) => void;
  onFetchFileContent?: (filename: string) => Promise<string | null>;
}

type ChartTab = 'thermo' | 'data';

export const OutputTab: React.FC<OutputTabProps> = ({
  output,
  vfsFiles,
  isReady,
  isRunning,
  onClearOutput,
  onListFiles,
  onDownloadFile,
  onFetchFileContent,
}) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const [chartTab, setChartTab] = useState<ChartTab>('thermo');
  const [selectedDataFile, setSelectedDataFile] = useState<string>('');
  const [dataFileContent, setDataFileContent] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const lastFetchedFileRef = useRef<string>('');
  const fetchInProgressRef = useRef<boolean>(false);
  const wasRunningRef = useRef<boolean>(false);

  // Reset histogram data when a new run starts
  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      // Run just started - reset histogram state
      setSelectedDataFile('');
      setDataFileContent(null);
      lastFetchedFileRef.current = '';
    }
    wasRunningRef.current = isRunning;
  }, [isRunning]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Find .dat files that could be plotted
  const dataFiles = useMemo(() => {
    return vfsFiles.filter(file =>
      !file.isDirectory &&
      (file.name.endsWith('.dat') || file.name.endsWith('.csv'))
    );
  }, [vfsFiles]);

  // Auto-select first data file when available
  useEffect(() => {
    if (dataFiles.length > 0 && !selectedDataFile) {
      setSelectedDataFile(dataFiles[0].name);
    }
  }, [dataFiles, selectedDataFile]);

  // Load data file content when selected - with debouncing and duplicate prevention
  useEffect(() => {
    if (!selectedDataFile || !onFetchFileContent) {
      return;
    }

    // Skip if already fetching
    if (fetchInProgressRef.current) {
      return;
    }

    // Skip if same file already fetched
    if (selectedDataFile === lastFetchedFileRef.current) {
      return;
    }

    let cancelled = false;
    fetchInProgressRef.current = true;
    setIsLoadingData(true);

    // Small delay to debounce rapid changes
    const timeoutId = setTimeout(() => {
      if (cancelled) {
        fetchInProgressRef.current = false;
        return;
      }

      onFetchFileContent(selectedDataFile)
        .then(content => {
          if (!cancelled) {
            setDataFileContent(content);
            lastFetchedFileRef.current = selectedDataFile;
            setIsLoadingData(false);
            fetchInProgressRef.current = false;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDataFileContent(null);
            setIsLoadingData(false);
            fetchInProgressRef.current = false;
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      fetchInProgressRef.current = false;
    };
  }, [selectedDataFile, onFetchFileContent]);


  const outputFiles = vfsFiles.filter(file => !file.isDirectory);

  return (
    <div className={styles.outputSplit}>
      <section className={styles.pane}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Console</h2>
          <div className={styles.paneActions}>
            <VizButton variant="ghost" size="sm" onClick={onClearOutput}>
              Clear
            </VizButton>
            <VizButton variant="ghost" size="sm" onClick={onListFiles} disabled={!isReady}>
              List files
            </VizButton>
          </div>
        </div>
        <div ref={outputRef} className={styles.console}>
          {output.length === 0 ? (
            <span className={styles.consoleIdle}>Waiting for LAMMPS to initialise…</span>
          ) : (
            output.map((line, index) => (
              <div key={index} className={line.isError ? styles.error : undefined}>
                {line.text}
              </div>
            ))
          )}
        </div>

        {outputFiles.length > 0 && (
          <div className={styles.outputFiles}>
            <h3 className={styles.paneSubtitle}>Output files</h3>
            <ul className={styles.outputFileList}>
              {outputFiles.map(file => (
                <li key={file.name} className={styles.outputFileItem}>
                  <span className={styles.outputFileName}>{file.name}</span>
                  <span className={styles.fileSize}>
                    {file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}
                  </span>
                  <VizButton variant="ghost" size="sm" onClick={() => onDownloadFile(file.name)} disabled={!isReady}>
                    Download
                  </VizButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.pane}>
        <div className={styles.paneHeader}>
          <SegmentedControl<ChartTab>
            aria-label="Chart"
            className={styles.chartTabs}
            value={chartTab}
            onChange={setChartTab}
            options={[
              { value: 'thermo', label: 'Thermo' },
              {
                value: 'data',
                label: dataFiles.length > 0 ? `Data files (${dataFiles.length})` : 'Data files',
                disabled: dataFiles.length === 0 && !onFetchFileContent,
              },
            ]}
          />
          {chartTab === 'data' && dataFiles.length > 0 && (
            <div className={styles.dataFileSelect}>
              <Select
                aria-label="Data file"
                value={selectedDataFile}
                onChange={setSelectedDataFile}
                options={dataFiles.map(file => ({ value: file.name, label: file.name }))}
              />
            </div>
          )}
        </div>
        {chartTab === 'thermo' ? (
          <ThermoChart output={output} isRunning={isRunning} />
        ) : (
          <HistogramChart data={dataFileContent} filename={selectedDataFile} isLoading={isLoadingData} />
        )}
      </section>
    </div>
  );
};
