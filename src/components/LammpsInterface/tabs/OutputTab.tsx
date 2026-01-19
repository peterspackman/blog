import React, { useRef, useEffect, useState, useMemo } from 'react';
import styles from '../LammpsInterface.module.css';
import { OutputLine, VfsFile } from '../types';
import { ThermoChart } from '../components/ThermoChart';
import { HistogramChart } from '../components/HistogramChart';

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
    <div className={styles.tabContent}>
      <div className={styles.outputWithChart}>
        {/* Console section */}
        <div className={styles.consoleSection}>
          <div className={styles.outputHeader}>
            <h4>Console Output</h4>
            <div className={styles.outputActions}>
              <button
                onClick={onClearOutput}
                className="button button--secondary button--sm"
              >
                Clear
              </button>
              <button
                onClick={onListFiles}
                disabled={!isReady}
                className="button button--secondary button--sm"
              >
                List Files
              </button>
            </div>
          </div>
          <div ref={outputRef} className={styles.output}>
            {output.length === 0 ? (
              'Waiting for LAMMPS to initialize...'
            ) : (
              output.map((line, index) => (
                <div
                  key={index}
                  className={line.isError ? styles.error : ''}
                >
                  {line.text}
                </div>
              ))
            )}
          </div>

          {/* Output Files */}
          {outputFiles.length > 0 && (
            <div className={styles.outputFilesSection}>
              <h4>Output Files</h4>
              <div className={styles.outputFilesList}>
                {outputFiles.map(file => (
                  <div key={file.name} className={styles.outputFileItem}>
                    <span className={styles.outputFileName}>
                      {file.name}
                      <span className={styles.fileSize}>
                        {file.size > 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${file.size} B`}
                      </span>
                    </span>
                    <button
                      className="button button--primary button--sm"
                      onClick={() => onDownloadFile(file.name)}
                      disabled={!isReady}
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart section with tabs */}
        <div className={styles.chartSection}>
          {/* Tab buttons */}
          <div className={styles.chartSectionTabs}>
            <button
              className={`${styles.chartTabButton} ${chartTab === 'thermo' ? styles.chartTabButtonActive : ''}`}
              onClick={() => setChartTab('thermo')}
            >
              Thermo
            </button>
            <button
              className={`${styles.chartTabButton} ${chartTab === 'data' ? styles.chartTabButtonActive : ''}`}
              onClick={() => setChartTab('data')}
              disabled={dataFiles.length === 0 && !onFetchFileContent}
            >
              Data {dataFiles.length > 0 && `(${dataFiles.length})`}
            </button>
          </div>

          {/* Chart content */}
          <div className={styles.chartContent}>
            {chartTab === 'thermo' ? (
              <ThermoChart output={output} isRunning={isRunning} />
            ) : (
              <>
                {/* Data file selector */}
                {dataFiles.length > 0 && (
                  <div className={styles.dataFileSelector}>
                    <label>File:</label>
                    <select
                      value={selectedDataFile}
                      onChange={(e) => setSelectedDataFile(e.target.value)}
                    >
                      {dataFiles.map(file => (
                        <option key={file.name} value={file.name}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <HistogramChart
                  data={dataFileContent}
                  filename={selectedDataFile}
                  isLoading={isLoadingData}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
